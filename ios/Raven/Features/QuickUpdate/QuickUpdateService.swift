import Foundation
import RavenKit

/// The one server call a quick update makes, so the sheet can also run with no account for screenshots and previews.
protocol QuickUpdateService {
    func quickUpdate(_ request: QuickUpdateRequest) async throws(RavenError) -> QuickUpdateReply
}

extension RavenClient: QuickUpdateService {}

/// No server: asks one question when the update is vague, otherwise pretends to mark a step done.
struct OfflineQuickUpdateService: QuickUpdateService {
    func quickUpdate(_ request: QuickUpdateRequest) async throws(RavenError) -> QuickUpdateReply {
        try? await Task.sleep(for: .milliseconds(700))
        if request.conversation.isEmpty, request.message.split(separator: " ").count < 4 {
            return QuickUpdateReply(reply: "Which one: the Flask dashboard or the portfolio site?", needsAnswer: true)
        }
        return QuickUpdateReply(
            reply: "Nice, the Flask dashboard is done.",
            needsAnswer: false,
            applied: [AppliedChange(type: "complete_step", summary: "Marked \"Build a Flask dashboard\" done")]
        )
    }
}
