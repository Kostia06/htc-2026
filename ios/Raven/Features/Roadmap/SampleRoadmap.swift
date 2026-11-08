#if DEBUG
    import Foundation
    import RavenKit

    /// A sample roadmap for screenshots and previews; it never talks to the server and pages forever.
    actor SampleRoadmap: RoadmapService {
        private var page: RoadmapPage
        private var generated = 0

        init(goal: String) {
            let days = Self.sampleDays()
            page = RoadmapPage(
                goal: goal,
                progress: RoadmapProgress(done: 3, total: 3 + Self.pageSize, streakDays: 2),
                next: Self.steps(from: 0, count: Self.pageSize),
                nextCursor: String(Self.pageSize),
                completed: days,
            )
            generated = Self.pageSize
        }

        func roadmap(cursor: String?, timeZone _: TimeZone) async throws(RavenError) -> RoadmapPage {
            let start = Int(cursor ?? "0") ?? 0
            guard start > 0 else { return page }
            try? await Task.sleep(for: .seconds(1.2))
            let more = Self.steps(from: generated, count: Self.pageSize)
            generated += Self.pageSize
            page.progress.total += Self.pageSize
            page.nextCursor = String(generated)
            return RoadmapPage(goal: page.goal, progress: page.progress, next: more, nextCursor: page.nextCursor, completed: page.completed)
        }

        func update(step stepId: String, status: RoadmapStep.Status, note: String?) async throws(RavenError) -> RoadmapStep {
            try? await Task.sleep(for: .milliseconds(300))
            if status == .done, let previous = page.complete(stepId, note: note) {
                var done = previous
                done.status = .done
                done.note = note
                done.completedAt = Date.now.ISO8601Format()
                return done
            }
            throw .rejected(status: 404, message: "unknown step")
        }

        private nonisolated static let pageSize = 6

        private nonisolated static func steps(from: Int, count: Int) -> [RoadmapStep] {
            (from ..< from + count).map { index in
                let blueprint = blueprints[index % blueprints.count]
                let round = index / blueprints.count
                return RoadmapStep(
                    id: "s\(index)", kind: blueprint.kind, title: round == 0 ? blueprint.title : "\(blueprint.title), round \(round + 1)",
                    why: blueprint.why, detail: blueprint.detail, label: blueprint.label, estimate: blueprint.estimate,
                    action: blueprint.action,
                )
            }
        }

        private nonisolated static func sampleDays() -> [CompletedDay] {
            let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: .now) ?? .now
            let earlier = Calendar.current.date(byAdding: .day, value: -3, to: .now) ?? .now
            return [
                CompletedDay(day: RoadmapPage.dayKey(yesterday), steps: [
                    done("d0", .project, "Build a lending dashboard in SQL", "github.com/kostia/lending-dash", yesterday),
                    done("d1", .networkingPractice, "Practise asking an ATB analyst for 15 minutes",
                         "Clear intro; ask one sharper question next time.", yesterday),
                ]),
                CompletedDay(day: RoadmapPage.dayKey(earlier), steps: [
                    done("d2", .event, "Go to a Calgary data meetup", "Met two people from Benevity.", earlier),
                ]),
            ]
        }

        private nonisolated static func done(
            _ id: String, _ kind: RoadmapStep.Kind, _ title: String, _ note: String, _ date: Date,
        ) -> RoadmapStep {
            RoadmapStep(
                id: id, kind: kind, title: title, why: "", detail: "", label: .readyNow, estimate: "",
                status: .done, completedAt: date.ISO8601Format(), note: note,
            )
        }

        private struct Blueprint {
            let kind: RoadmapStep.Kind
            let title: String
            let why: String
            let detail: String
            let label: RoadmapStep.Label
            let estimate: String
            var action: RoadmapAction?
        }

        private nonisolated static let blueprints: [Blueprint] = [
            Blueprint(
                kind: .interviewPractice, title: "Mock analyst interview: walk through your dashboard",
                why: "You'll be asked why you chose each chart.",
                detail: "Explain the lending dashboard out loud: the question it answers, one hard choice, what you'd change. Two minutes.",
                label: .readyNow, estimate: "15 min", action: .init(type: .interview, role: "Junior data analyst"),
            ),
            Blueprint(
                kind: .project, title: "Write up the dashboard as a one-page case study",
                why: "It gives interviewers a story to ask about.",
                detail: "Problem, the SQL you wrote, one screenshot, one thing you learned. Link it from your resume.",
                label: .readyNow, estimate: "2 hours",
            ),
            Blueprint(
                kind: .course, title: "Learn Tableau basics with the lending data",
                why: "Most analyst postings in Calgary ask for it.",
                detail: "Rebuild two of your Postgres charts in Tableau Public and publish the workbook.",
                label: .stretch, estimate: "3 weeks",
            ),
            Blueprint(
                kind: .networkingPractice, title: "Practise asking your co-op manager for a referral",
                why: "A referral from ATB carries weight in Calgary.",
                detail: "Rehearse the ask: what you've done since the co-op, the role you're after, and the one-line favour.",
                label: .readyNow, estimate: "15 min", action: .init(type: .networking, role: "Junior data analyst"),
            ),
            Blueprint(
                kind: .application, title: "Apply to five junior analyst roles",
                why: "Five tailored applications beat fifty generic ones.",
                detail: "Echo each posting's words in your first resume line and attach the case study.",
                label: .stretch, estimate: "1 week",
            ),
            Blueprint(
                kind: .certification, title: "Earn the Google Data Analytics certificate",
                why: "A quick filter many postings use.",
                detail: "Two modules a week; book the final assessment date now so it has a deadline.",
                label: .longTerm, estimate: "6 weeks",
            ),
        ]
    }
#endif
