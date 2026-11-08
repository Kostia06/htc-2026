import Foundation
import Observation
import SkillitKit

/// One "tell Skillit how it went" conversation: typed or spoken, at most two clarifying questions, then the shared card.
@Observable
final class RecapModel {
    struct Message: Identifiable, Equatable {
        let id = UUID()
        let role: RecapMessage.Role
        let text: String
    }

    static let opening = "How did your interview go? Tell me like you'd tell a friend."

    let companySlug: String?
    private(set) var messages: [Message] = [Message(role: .skillit, text: RecapModel.opening)]
    /// Skillit is reading what was said; the purple typing indicator shows.
    private(set) var isThinking = false
    /// A voice recap is running; the mic button becomes a stop button.
    private(set) var isListening = false
    private(set) var result: RecapReply?
    var draft = ""
    var error: String?

    private let service: any RecapService
    private let voice: any RecapVoice
    private var call: Task<Void, Never>?

    init(companySlug: String?, service: any RecapService, voice: any RecapVoice) {
        self.companySlug = companySlug
        self.service = service
        self.voice = voice
    }

    var isFinished: Bool {
        result != nil
    }

    var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isThinking && !isListening && !isFinished
    }

    func sendDraft() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        await send(text)
    }

    func send(_ text: String) async {
        guard !isThinking, !isFinished else { return }
        let history = messages.map { RecapMessage(role: $0.role, text: $0.text) }
        messages.append(Message(role: .user, text: text))
        isThinking = true
        defer { isThinking = false }
        do {
            try await handle(service.recapTurn(RecapTurnRequest(companySlug: companySlug, message: text, history: history)))
        } catch {
            self.error = error.message
        }
    }

    /// Starts the spoken recap: every recognised line lands in the chat as it's said; when the call ends, the transcript goes to the server.
    func startVoice() {
        guard call == nil, !isFinished else { return }
        isListening = true
        error = nil
        call = Task { [weak self] in
            await self?.runVoice()
            self?.call = nil
        }
    }

    func stopVoice() {
        voice.stop()
    }

    private func runVoice() async {
        defer { isListening = false }
        let started: RecapVoiceStart
        do {
            started = try await service.startRecapVoice(companySlug: companySlug)
        } catch {
            self.error = error.message
            return
        }
        var transcript: [RecapTranscriptLine] = []
        for await line in voice.start(started.credentials) {
            transcript.append(line)
            guard !(line.speaker == .skillit && line.text == Self.opening && transcript.count == 1) else { continue }
            messages.append(Message(role: line.speaker == .user ? .user : .skillit, text: line.text))
        }
        guard transcript.contains(where: { $0.speaker == .user }) else {
            messages.append(Message(role: .skillit, text: "I couldn't hear you. Type it instead?"))
            return
        }
        isListening = false
        isThinking = true
        defer { isThinking = false }
        do {
            try await handle(service.finishRecapVoice(started.id, transcript: transcript))
        } catch {
            self.error = error.message
        }
    }

    private func handle(_ reply: RecapReply) {
        messages.append(Message(role: .skillit, text: reply.reply))
        if reply.done {
            result = reply
        }
    }
}
