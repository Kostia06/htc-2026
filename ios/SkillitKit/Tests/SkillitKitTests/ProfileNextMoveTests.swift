@testable import SkillitKit
import Testing

struct ProfileNextMoveTests {
    private let ready = Profile(
        targetRoles: ["Data analyst"],
        skills: [.init(name: "SQL", source: .resume, evidence: "Weekly sales report")],
        experience: [.init(role: "Intern", org: "ATB")],
    )

    private func summary(_ id: String, covered: Int, total: Int, posting: String = "p1") -> TailoredResumeSummary {
        .init(id: id, postingId: posting, title: "Analyst", company: "Co \(id)", covered: covered, total: total, updatedAt: "")
    }

    @Test func noRoleComesFirst() {
        let move = ProfileNextMove.pick(profile: .empty, tailored: [summary("a", covered: 1, total: 4)], postings: [])
        #expect(move == .chooseRole)
    }

    @Test func weakestTailoredResumeWins() {
        let items = [summary("a", covered: 3, total: 4), summary("b", covered: 1, total: 4), summary("c", covered: 2, total: 2)]
        let move = ProfileNextMove.pick(profile: ready, tailored: items, postings: [], missingTopic: "SQL")
        #expect(move == .closeGap(tailoredId: "b", company: "Co b", topic: "SQL"))
    }

    @Test func tieGoesToTheMostRecent() {
        let items = [summary("new", covered: 1, total: 2), summary("old", covered: 2, total: 4)]
        #expect(ProfileNextMove.weakestTailored(items)?.id == "new")
    }

    @Test func fullyCoveredAndEmptyPostingsAreNotGaps() {
        let items = [summary("a", covered: 4, total: 4), summary("b", covered: 0, total: 0)]
        #expect(ProfileNextMove.weakestTailored(items) == nil)
    }

    @Test func untailoredPostingIsSuggestedNext() {
        let postings = [
            JobPosting(id: "p1", title: "Analyst", company: "ATB"),
            JobPosting(id: "p2", title: "Analyst", company: "Shopify"),
        ]
        let move = ProfileNextMove.pick(profile: ready, tailored: [summary("a", covered: 4, total: 4, posting: "p1")], postings: postings)
        #expect(move == .tailor(postingId: "p2", company: "Shopify"))
    }

    @Test func thenExperienceThenUnprovenSkills() {
        var profile = ready
        profile.experience = []
        #expect(ProfileNextMove.pick(profile: profile, tailored: [], postings: []) == .addExperience)

        profile = ready
        profile.skills.append(.init(name: "Tableau", source: .selfReported))
        #expect(ProfileNextMove.pick(profile: profile, tailored: [], postings: []) == .backUpSkill("Tableau"))
    }

    @Test func nothingToSuggestWhenEverythingIsInPlace() {
        #expect(ProfileNextMove.pick(profile: ready, tailored: [], postings: []) == nil)
    }
}
