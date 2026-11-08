import Foundation
import Observation
import SkillitKit

/// The Ask bar under Crossroads: one question at a time, typed or spoken, answered from the person's own items and
/// their road. Each answer hands its cites to `onCites` so the screen can light up what it leaned on.
@Observable
final class CrossroadsAskModel: ChatDraftModel {
    static let placeholder = "Ask how your road lines up"

    private(set) var reply: String?
    private(set) var isThinking = false
    private(set) var isListening = false
    var draft = ""
    var error: String?

    private let service: any CrossroadsService
    private let dictation: any Dictation
    private let onCites: ([CrossroadsCite]) -> Void
    private var conversation: [QuickUpdateLine] = []
    private var listening: Task<Void, Never>?

    init(service: any CrossroadsService, dictation: any Dictation, onCites: @escaping ([CrossroadsCite]) -> Void) {
        self.service = service
        self.dictation = dictation
        self.onCites = onCites
    }

    var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isThinking && !isListening
    }

    func sendDraft() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isThinking else { return }
        draft = ""
        await send(text)
    }

    func send(_ text: String) async {
        guard !isThinking else { return }
        error = nil
        isThinking = true
        defer { isThinking = false }
        do {
            let answer = try await service.askCrossroads(QuickUpdateRequest(message: text, conversation: conversation))
            reply = answer.reply
            onCites(answer.cites)
            // a question keeps the thread so the answer to it has context; an answer starts the next question clean
            let asked: [QuickUpdateLine] = [.init(speaker: .user, text: text), .init(speaker: .skillit, text: answer.reply)]
            conversation = answer.needsAnswer ? conversation + asked : []
        } catch {
            self.error = error.message
        }
    }

    func toggleListening() {
        if isListening {
            dictation.stop()
            return
        }
        guard listening == nil, !isThinking else { return }
        isListening = true
        error = nil
        listening = Task { [weak self] in
            await self?.listen()
            self?.listening = nil
        }
    }

    func cancelListening() {
        guard isListening else { return }
        draft = ""
        dictation.stop()
    }

    private func listen() async {
        defer { isListening = false }
        do {
            for try await heard in dictation.start() {
                draft = heard
            }
        } catch {
            self.error = error.localizedDescription
            return
        }
        isListening = false
        await sendDraft()
    }
}
