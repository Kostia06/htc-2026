import Foundation

/// What the agent drafted from an uploaded resume. Nothing is saved until the person confirms it.
public struct ResumeDraft: Codable, Equatable, Sendable {
    public var documentId: String
    public var summary: String
    public var draft: Profile
    public var missing: [String]
    public var droppedClaims: Int
}

public struct ResumeFile: Sendable {
    public var name: String
    public var data: Data

    public init(name: String, data: Data) {
        self.name = name
        self.data = data
    }
}
