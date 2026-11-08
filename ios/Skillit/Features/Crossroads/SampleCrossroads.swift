#if DEBUG
    import Foundation
    import SkillitKit

    /// A data-analyst road for previews and screenshots: two overlaps, real and example lines, a fact,
    /// two trails, and a road with two of the first trail's five steps done.
    struct SampleCrossroads: CrossroadsService {
        static let view = Crossroads(
            road: .init(goal: "Junior data analyst", lane: "data", laneName: "data"),
            you: [
                YourItem(id: "m1", kind: .weakness, text: "Froze on SQL joins in the Arcurve screen without autocomplete"),
                YourItem(id: "m2", kind: .note, text: "Recruiter said every junior posting wants 2 years of experience"),
                YourItem(id: "m3", kind: .goal, text: "Land a data role in Calgary by spring"),
                YourItem(id: "profile_skill_0", kind: .skill, text: "Excel", source: .profile),
            ],
            everyone: [
                RoadLine(
                    id: "e1", kind: .struggle, text: "Knew pandas from courses but froze writing SQL joins without autocomplete.",
                    people: 7,
                ),
                RoadLine(
                    id: "e2", kind: .tip, text: "Practising SQL window functions daily for two weeks made the screen easy.",
                    people: 4, meToo: true,
                ),
                RoadLine(
                    id: "e3", kind: .struggle, text: "Every posting asked for 2 years of experience, even junior ones.", example: true,
                ),
                RoadLine(id: "e4", kind: .interview, text: "A metric dropped 20% overnight. How would you figure out why?", example: true),
                RoadLine(id: "e5", kind: .win, text: "An internal reporting role was the way in; analytics followed.", example: true),
            ],
            research: [
                ResearchFact(
                    id: "f1", company: "Arcurve", slug: "arcurve", kind: "hiring",
                    text: "Hires junior developers and data people through a spring intake.",
                    sourceUrl: "https://www.arcurve.com/careers", sourceHost: "arcurve.com", ageDays: 3
                ),
            ],
            links: [
                CrossroadsLink(you: "m1", everyone: "e1", score: 0.86),
                CrossroadsLink(you: "m2", everyone: "e3", score: 0.8),
                CrossroadsLink(you: "m1", everyone: "f1", score: 0.74),
            ],
            trails: [
                Trail(
                    id: "t1", role: "Junior Data Analyst", people: 5,
                    steps: [.course, .project, .volunteering, .interviewPractice, .application], skills: ["sql", "excel"],
                ),
                Trail(
                    id: "t2", role: "Business Intelligence Analyst", example: true,
                    steps: [.course, .project, .networkingPractice, .application],
                ),
            ],
            yourRoad: YourRoad(done: [.course, .project]),
        )

        func crossroads() async throws(SkillitError) -> Crossroads {
            try? await Task.sleep(for: .milliseconds(400))
            return Self.view
        }

        func askCrossroads(_: QuickUpdateRequest) async throws(SkillitError) -> CrossroadsAnswer {
            try? await Task.sleep(for: .milliseconds(700))
            return CrossroadsAnswer(
                reply: "You're not alone: 7 people on this road froze on SQL joins too. "
                    + "4 of them say two weeks of daily window-function practice fixed it.",
                needsAnswer: false,
                cites: [.init(type: .you, id: "m1"), .init(type: .everyone, id: "e1"), .init(type: .everyone, id: "e2")]
            )
        }

        func standBehind(lineID: String, _ behind: Bool) async throws(SkillitError) -> RoadLine? {
            guard var line = Self.view.everyone.first(where: { $0.id == lineID }) else { return nil }
            line.meToo = behind
            line.people = line.people.map { $0 + (behind ? 1 : -1) }
            return line
        }

        func addToRoad(lineID _: String) async throws(SkillitError) {}

        func forgetMemory(id _: String) async throws(SkillitError) {}
    }
#endif
