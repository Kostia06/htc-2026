import Foundation
import Observation
import SkillitKit

/// One "what's new?" chat: each update is applied at once, or answered with one question and then applied.
/// A pasted job posting goes the same way and comes back as a posting card under the reply.
@Observable
final class QuickUpdateModel: ChatDraftModel {
    typealias Message = RecapModel.Message

    static let opening = "What's new? One line is enough, I'll update your road and profile."
    static let placeholder = "What's new? Or paste a job"

    private(set) var messages: [Message]
    /// What each of Skillit's replies changed, by message id; only replies that applied something have an entry.
    private(set) var appliedAfter: [UUID: [AppliedChange]] = [:]
    /// The posting a reply imported, by message id.
    private(set) var postingAfter: [UUID: JobPosting] = [:]
    private(set) var isThinking = false
    private(set) var isListening = false
    var draft = ""
    var error: String?

    private let service: any QuickUpdateService
    private let dictation: any Dictation
    private let onApplied: ([AppliedChange]) -> Void
    /// Where the current update began: an answered update starts the next one clean, so Skillit may ask again.
    private var turnStart = 1
    private var listening: Task<Void, Never>?
    /// Set when the chat closes mid-dictation, so what was heard is dropped instead of sent.
    private var discardsHeard = false
    private let focusStepID: String?

    /// With a `focus` the chat is about one roadmap step: Skillit opens by asking what they did for it, and every
    /// update names the step, so the server marks it done without having to guess which one is meant.
    init(
        service: any QuickUpdateService, dictation: any Dictation, focus: RoadmapStep? = nil,
        onApplied: @escaping ([AppliedChange]) -> Void,
    ) {
        self.service = service
        self.dictation = dictation
        self.onApplied = onApplied
        focusStepID = focus?.id
        if let focus {
            messages = [Message(role: .skillit, text: "What did you do for \u{201C}\(focus.title)\u{201D}? Type it or tap the mic.")]
            turnStart = 0
        } else {
            messages = [Message(role: .skillit, text: Self.opening)]
        }
    }

    var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isThinking && !isListening
    }

    /// Skillit's latest line, once the person has said something; the opening line is not a reply.
    var lastReply: Message? {
        messages.count > 1 ? messages.last { $0.role == .skillit } : nil
    }

    func sendDraft() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        // checked before clearing the draft: a send while Skillit is still answering would otherwise lose the text
        guard !text.isEmpty, !isThinking else { return }
        draft = ""
        await send(text)
    }

    func send(_ text: String) async {
        guard !isThinking else { return }
        let conversation = messages[turnStart...].map { QuickUpdateLine(speaker: $0.role == .user ? .user : .skillit, text: $0.text) }
        messages.append(Message(role: .user, text: text))
        error = nil
        isThinking = true
        defer { isThinking = false }
        do {
            if let posting = PostingDetection.detect(text) {
                try await handle(service.importPosting(posting))
            } else {
                let request = QuickUpdateRequest(message: text, conversation: conversation, focusStepID: focusStepID)
                try await handle(service.quickUpdate(request))
            }
        } catch {
            self.error = error.message
        }
    }

    /// Listens until `stopListening`; the words land in the draft as they're heard and go out as one update when the mic stops.
    func startListening() {
        guard listening == nil, !isThinking else { return }
        isListening = true
        discardsHeard = false
        error = nil
        listening = Task { [weak self] in
            await self?.listen()
            self?.listening = nil
        }
    }

    func stopListening() {
        dictation.stop()
    }

    func toggleListening() {
        if isListening {
            stopListening()
        } else {
            startListening()
        }
    }

    /// Ends dictation without sending, for when the chat is closed mid-sentence.
    func cancelListening() {
        guard isListening else { return }
        discardsHeard = true
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
        guard !discardsHeard else { return }
        guard !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            error = "I couldn't hear you. Type it instead?"
            return
        }
        isListening = false
        await sendDraft()
    }

    private func handle(_ reply: QuickUpdateReply) {
        let line = Message(role: .skillit, text: reply.reply)
        messages.append(line)
        guard !reply.needsAnswer else { return }
        turnStart = messages.count
        guard !reply.applied.isEmpty else { return }
        appliedAfter[line.id] = reply.applied
        onApplied(reply.applied)
    }

    // a posting is its own receipt: the card says what was read, the applied list what was set up from it
    private func handle(_ posting: JobPosting) {
        let line = Message(role: .skillit, text: "Got it: \(posting.title) at \(posting.company). You have \(posting.requirementsLine).")
        messages.append(line)
        turnStart = messages.count
        postingAfter[line.id] = posting
        let applied = posting.prefilled.appliedChanges
        guard !applied.isEmpty else { return }
        appliedAfter[line.id] = applied
        onApplied(applied)
    }
}
