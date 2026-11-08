import Foundation
import Observation
import RavenKit

/// One "what's new?" chat: each update is applied at once, or answered with one question and then applied.
/// Bubbles are the recap's; the extra piece is the "Applied" card under the reply that changed something.
@Observable
final class QuickUpdateModel {
    typealias Message = RecapModel.Message

    static let opening = "What's new? One line is enough, I'll update your roadmap and profile."

    private(set) var messages: [Message]
    /// What each of Raven's replies changed, by message id; only replies that applied something have an entry.
    private(set) var appliedAfter: [UUID: [AppliedChange]] = [:]
    private(set) var isThinking = false
    private(set) var isListening = false
    var draft = ""
    var error: String?

    private let service: any QuickUpdateService
    private let dictation: any Dictation
    private let onApplied: ([AppliedChange]) -> Void
    /// Where the current update began: an answered update starts the next one clean, so Raven may ask again.
    private var turnStart = 1
    private var listening: Task<Void, Never>?

    /// With a `focusTitle` the chat is about one roadmap step: Raven opens by asking what they did for it, and that
    /// question goes to the server with the first answer, so it knows which step is meant without asking.
    init(
        service: any QuickUpdateService, dictation: any Dictation, focusTitle: String? = nil,
        onApplied: @escaping ([AppliedChange]) -> Void,
    ) {
        self.service = service
        self.dictation = dictation
        self.onApplied = onApplied
        if let focusTitle {
            messages = [Message(role: .raven, text: "What did you do for \u{201C}\(focusTitle)\u{201D}? Type it or tap the mic.")]
            turnStart = 0
        } else {
            messages = [Message(role: .raven, text: Self.opening)]
        }
    }

    var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isThinking && !isListening
    }

    func sendDraft() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        await send(text)
    }

    func send(_ text: String) async {
        guard !isThinking else { return }
        let conversation = messages[turnStart...].map { QuickUpdateLine(speaker: $0.role == .user ? .user : .raven, text: $0.text) }
        messages.append(Message(role: .user, text: text))
        error = nil
        isThinking = true
        defer { isThinking = false }
        do {
            try await handle(service.quickUpdate(QuickUpdateRequest(message: text, conversation: conversation)))
        } catch {
            self.error = error.message
        }
    }

    /// Listens until `stopListening`; the words land in the draft as they're heard and go out as one update when the mic stops.
    func startListening() {
        guard listening == nil, !isThinking else { return }
        isListening = true
        error = nil
        draft = ""
        listening = Task { [weak self] in
            await self?.listen()
            self?.listening = nil
        }
    }

    func stopListening() {
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
        guard !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            error = "I couldn't hear you. Type it instead?"
            return
        }
        isListening = false
        await sendDraft()
    }

    private func handle(_ reply: QuickUpdateReply) {
        let line = Message(role: .raven, text: reply.reply)
        messages.append(line)
        guard !reply.needsAnswer else { return }
        turnStart = messages.count
        guard !reply.applied.isEmpty else { return }
        appliedAfter[line.id] = reply.applied
        onApplied(reply.applied)
    }
}
