import Foundation
import Observation
import RavenKit

/// The postings the person saved, newest first.
@Observable
final class PostingsModel {
    private(set) var postings: [JobPosting] = []
    private(set) var hasLoaded = false

    /// Without a signed-in client (previews, screenshots) the list shows the sample posting.
    func load(using client: RavenClient?) async {
        guard let client else {
            postings = [.sample]
            hasLoaded = true
            return
        }
        if let loaded = try? await client.postings() {
            postings = loaded
        }
        hasLoaded = true
    }
}
