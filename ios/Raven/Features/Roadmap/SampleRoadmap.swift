#if DEBUG
    import Foundation
    import RavenKit

    /// An endless sample path for screenshots and previews; it never talks to the server.
    actor SampleRoadmap: RoadmapService {
        private let goal: String
        private var statuses: [String: RoadmapStep.Status] = [:]
        private var generated = 0

        init(goal: String) {
            self.goal = goal
            for id in ["s0-0", "s0-1", "s0-2"] {
                statuses[id] = .done
            }
        }

        func roadmap(cursor: String?) async throws(RavenError) -> RoadmapPage {
            let start = Int(cursor ?? "0") ?? 0
            if start > 0 {
                try? await Task.sleep(for: .seconds(1.2))
            }
            let count = start == 0 ? 3 : 2
            let units = (start ..< start + count).map(unit)
            generated = max(generated, start + count)
            let done = statuses.values.count { $0 == .done }
            let summary = RoadmapSummary(done: done, total: generated * 4, thisWeek: min(done, 2))
            return RoadmapPage(goal: goal, summary: summary, units: units, nextCursor: String(start + count))
        }

        func setStatus(_ status: RoadmapStep.Status, ofStep stepId: String) async throws(RavenError) {
            statuses[stepId] = status
        }

        private func unit(_ index: Int) -> RoadmapUnit {
            let blueprint = Self.blueprints[index % Self.blueprints.count]
            let steps = blueprint.steps.enumerated().map { offset, step in
                let id = "s\(index)-\(offset)"
                var copy = RoadmapStep(
                    id: id, kind: step.kind, title: step.title, why: step.why, label: step.label, estimate: step.estimate,
                )
                copy.status = statuses[id] ?? .todo
                return copy
            }
            return RoadmapUnit(index: index, title: blueprint.title, summary: blueprint.summary, source: .agent, steps: steps)
        }

        private struct Blueprint {
            let title: String
            let summary: String
            let steps: [RoadmapStep]

            init(_ title: String, _ summary: String, _ steps: [RoadmapStep]) {
                self.title = title
                self.summary = summary
                self.steps = steps
            }
        }

        private nonisolated static func step(
            _ kind: RoadmapStep.Kind, _ title: String, _ why: String, _ label: RoadmapStep.Label, _ estimate: String,
        ) -> RoadmapStep {
            RoadmapStep(id: "", kind: kind, title: title, why: why, label: label, estimate: estimate)
        }

        private nonisolated static let blueprints: [Blueprint] = [
            Blueprint("Analyst basics", "Turn the SQL you already write into proof.", [
                step(.networking, "Ask an ATB analyst for 15 minutes",
                     "You worked with the lending team; start there.", .readyNow, "1 hour"),
                step(.project, "Build a lending dashboard in SQL",
                     "Your Postgres reports are half of it already.", .readyNow, "2 weekends"),
                step(.course, "Learn Tableau basics",
                     "Most analyst postings in Calgary ask for it.", .stretch, "3 weeks"),
                step(.event, "Go to a Calgary data meetup",
                     "Analyst roles here fill through people.", .readyNow, "1 evening"),
            ]),
            Blueprint("Get seen", "Put your work where hiring teams look.", [
                step(.hackathon, "Build at a weekend data hackathon",
                     "A team build is the closest thing to the job.", .stretch, "1 weekend"),
                step(.project, "Write up your dashboard as a case study",
                     "It gives interviewers a story to ask about.", .readyNow, "2 hours"),
                step(.volunteering, "Clean data for a local non-profit",
                     "Real users make your Python experience count.", .stretch, "4 weeks"),
                step(.certification, "Earn the Google Data Analytics certificate",
                     "A quick filter many postings use.", .longTerm, "6 weeks"),
            ]),
            Blueprint("Go for it", "Apply with a story and rehearse it.", [
                step(.interviewPractice, "Do two mock SQL interviews",
                     "Thinking out loud with queries takes practice.", .stretch, "2 hours"),
                step(.application, "Apply to five junior analyst roles",
                     "Five tailored applications beat fifty generic ones.", .stretch, "1 week"),
                step(.networking, "Ask your co-op manager for a referral",
                     "A referral from ATB carries weight in Calgary.", .longTerm, "1 week"),
                step(.interviewPractice, "Practise your dashboard walkthrough",
                     "You'll be asked why you chose each chart.", .readyNow, "30 min"),
            ]),
        ]
    }
#endif
