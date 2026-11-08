import Foundation

public extension ResumeDraft {
    /// for sample data in the app's debug screens; real drafts come from the server
    init(documentId: String, draft: Profile, summary: String = "", missing: [String] = [], droppedClaims: Int = 0) {
        self.init(documentId: documentId, summary: summary, draft: draft, missing: missing, droppedClaims: droppedClaims)
    }
}
