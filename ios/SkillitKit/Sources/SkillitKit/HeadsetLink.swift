import Foundation

/// A headset that paired with this account and stays signed in until it's removed here.
public struct HeadsetDevice: Identifiable, Equatable, Sendable {
    public let id: String
    public let name: String
    public let createdAt: Date
    public let lastSeenAt: Date
    /// polled for launches in the last half minute: the page is open on the headset
    public let isConnected: Bool

    public init(id: String, name: String, createdAt: Date, lastSeenAt: Date, isConnected: Bool) {
        self.id = id
        self.name = name
        self.createdAt = createdAt
        self.lastSeenAt = lastSeenAt
        self.isConnected = isConnected
    }
}

public struct HeadsetStatus: Equatable, Sendable {
    public let isConnected: Bool
    public let devices: [HeadsetDevice]

    public init(isConnected: Bool, devices: [HeadsetDevice]) {
        self.isConnected = isConnected
        self.devices = devices
    }
}

/// What the phone asks the headset to start: the same fields a voice session takes, plus the roadmap step it came from.
public struct HeadsetLaunch: Encodable, Equatable, Sendable {
    public var mode: PracticeMode
    public var companySlug: String?
    public var role: String?
    public var stepID: String?
    public var postingID: String?
    public var difficulty: PracticeDifficulty?
    public var length: InterviewLength?
    /// Opens this past session's review in the headset instead of starting an interview.
    public var reviewSessionID: String?

    public init(
        mode: PracticeMode, companySlug: String? = nil, role: String? = nil, stepID: String? = nil, reviewSessionID: String? = nil,
    ) {
        self.mode = mode
        self.companySlug = companySlug
        self.role = role
        self.stepID = stepID
        self.reviewSessionID = reviewSessionID
    }

    /// The interview the phone would have started, sent to the headset instead.
    public init(_ request: VoiceSessionRequest, stepID: String? = nil) {
        self.init(mode: request.mode, companySlug: request.companySlug, role: request.role, stepID: stepID)
        postingID = request.postingId
        difficulty = request.difficulty
        length = request.length
    }

    private enum CodingKeys: String, CodingKey {
        case mode, companySlug, role, difficulty, length
        case stepID = "stepId"
        case postingID = "postingId"
        case reviewSessionID = "reviewSessionId"
    }
}

/// The server's answer to a launch: it waits two minutes for the headset to pick it up.
public struct LaunchReceipt: Equatable, Sendable {
    public let expiresAt: Date
    public let isConnected: Bool

    public init(expiresAt: Date, isConnected: Bool) {
        self.expiresAt = expiresAt
        self.isConnected = isConnected
    }
}

/// What the Start button and the pairing screen need from the server, so previews and screenshots can run without one.
public protocol HeadsetLinkService: Sendable {
    func headsetStatus() async throws(SkillitError) -> HeadsetStatus
    func sendToHeadset(_ launch: HeadsetLaunch) async throws(SkillitError) -> LaunchReceipt
    func revokeHeadset(id: String) async throws(SkillitError)
}
