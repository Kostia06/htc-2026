import Foundation

/// The one thing the Profile tab suggests doing next, chosen from what the app already has loaded.
/// Earlier cases win: without a target role nothing else can be judged, and a resume that's missing what a
/// job asks for costs more than an unproven skill.
public enum ProfileNextMove: Equatable, Sendable {
    case chooseRole
    /// A tailored resume still misses some of its posting's requirements; `topic` names the first one when known.
    case closeGap(tailoredId: String, company: String, topic: String?)
    /// A saved posting with no tailored resume yet.
    case tailor(postingId: String, company: String)
    case addExperience
    /// A skill listed with nothing behind it.
    case backUpSkill(String)

    public static func pick(
        profile: Profile,
        tailored: [TailoredResumeSummary],
        postings: [JobPosting],
        missingTopic: String? = nil,
    ) -> ProfileNextMove? {
        if profile.targetRoles.isEmpty {
            return .chooseRole
        }
        if let weakest = weakestTailored(tailored) {
            return .closeGap(tailoredId: weakest.id, company: weakest.company, topic: missingTopic)
        }
        let tailoredPostings = Set(tailored.map(\.postingId))
        if let posting = postings.first(where: { !tailoredPostings.contains($0.id) }) {
            return .tailor(postingId: posting.id, company: posting.company)
        }
        if profile.experience.isEmpty {
            return .addExperience
        }
        if let skill = profile.skills.first(where: { ($0.evidence ?? "").isEmpty }) {
            return .backUpSkill(skill.name)
        }
        return nil
    }

    /// The tailored resume covering the smallest share of its posting; on a tie, the most recent one (the list
    /// arrives newest first). Nil when every one covers everything.
    public static func weakestTailored(_ items: [TailoredResumeSummary]) -> TailoredResumeSummary? {
        let withGaps = items.filter { $0.total > 0 && $0.covered < $0.total }
        return withGaps.min { share($0) < share($1) }
    }

    private static func share(_ item: TailoredResumeSummary) -> Double {
        Double(item.covered) / Double(item.total)
    }
}
