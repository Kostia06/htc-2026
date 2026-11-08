import Foundation
import SkillitKit

/// Where past sessions come from: the server in the app, sample data in previews and screenshots.
protocol PracticeHistoryService: Sendable {
    func practiceHistory(cursor: String?) async throws(SkillitError) -> PracticeHistoryPage
    func practiceSession(id: String) async throws(SkillitError) -> PracticeSessionDetail
}

extension SkillitClient: PracticeHistoryService {}

struct UnavailablePracticeHistory: PracticeHistoryService {
    func practiceHistory(cursor _: String?) async throws(SkillitError) -> PracticeHistoryPage {
        throw .offline
    }

    func practiceSession(id _: String) async throws(SkillitError) -> PracticeSessionDetail {
        throw .offline
    }
}

extension AppModel {
    var practiceHistoryService: any PracticeHistoryService {
        client ?? UnavailablePracticeHistory()
    }
}

/// The first page, kept on disk so the list opens at once; later pages always come from the server.
struct PracticeHistoryCache: Sendable {
    private let file: URL

    init(file: URL = URL.cachesDirectory.appending(path: "practice-history.json")) {
        self.file = file
    }

    func load() -> PracticeHistoryPage? {
        guard let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(PracticeHistoryPage.self, from: data)
    }

    func save(_ page: PracticeHistoryPage) {
        guard let data = try? JSONEncoder().encode(page) else { return }
        try? data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    /// On sign-out and delete-my-data, so the next person on this phone never sees these sessions.
    func clear() {
        try? FileManager.default.removeItem(at: file)
    }
}

#if DEBUG
    /// A fortnight of practice with an upward trend, for screenshots.
    struct SamplePracticeHistory: PracticeHistoryService {
        static let sessions: [PracticeSessionSummary] = [
            session("s1", .interview, company: ("atb", "ATB Financial"), daysAgo: 0.1, score: 4.2),
            session("s2", .interview, company: nil, daysAgo: 1.2, score: 3.9),
            session("s3", .interview, company: ("benevity", "Benevity"), daysAgo: 2.5, score: 3.4),
            session("s4", .interview, company: nil, daysAgo: 4, score: 3.6),
            session("s5", .interview, company: ("atb", "ATB Financial"), daysAgo: 6, score: 2.9),
            session("s6", .interview, company: nil, daysAgo: 9, score: 3.1),
            session("s7", .interview, company: nil, daysAgo: 12, score: 2.4),
        ]

        func practiceHistory(cursor _: String?) async throws(SkillitError) -> PracticeHistoryPage {
            try? await Task.sleep(for: .milliseconds(400))
            return PracticeHistoryPage(sessions: Self.sessions)
        }

        func practiceSession(id: String) async throws(SkillitError) -> PracticeSessionDetail {
            try? await Task.sleep(for: .milliseconds(300))
            let summary = Self.sessions.first { $0.id == id } ?? Self.sessions[0]
            return PracticeSessionDetail(
                id: id, mode: summary.mode, companySlug: summary.companySlug, status: .finished, createdAt: summary.createdAt,
                turns: [
                    PracticeTurn(
                        idx: 0,
                        question: "Tell me about a time you explained a technical result to someone non-technical.",
                        answer: "At my co-op I built a dashboard for the lending team. The managers didn't read SQL, so I walked them "
                            + "through three numbers that mattered and what each one meant for approvals. "
                            + "They ended up using it every Monday.",
                        scores: ["structure": 4.2, "relevance": 4.6, "specificity": 3.8],
                        delivery: .init(words: 52, fillerWords: 1, wordsPerMinute: 138),
                        tip: "Say what changed because of your work in one concrete number.",
                    ),
                    PracticeTurn(
                        idx: 1,
                        question: "Why ATB rather than one of the big five banks?",
                        answer: "Um, I think it's the scale. You can actually talk to the people who make decisions, "
                            + "and the Alberta focus means the work lands close to home.",
                        scores: ["structure": 3.1, "relevance": 4.0, "specificity": 2.8],
                        delivery: .init(words: 31, fillerWords: 2, wordsPerMinute: 162),
                        tip: "Name one thing ATB has done recently that made you want to work there.",
                    ),
                ],
            )
        }

        private static func session(
            _ id: String, _ mode: PracticeMode, company: (String, String)?, daysAgo: Double, score: Double,
        ) -> PracticeSessionSummary {
            let created = Date.now.addingTimeInterval(-daysAgo * 86400).formatted(.iso8601)
            return PracticeSessionSummary(
                id: id, mode: mode, companySlug: company?.0, companyName: company?.1, status: .finished, createdAt: created,
                finishedAt: created, score: score, turnCount: Int(score) + 1,
            )
        }
    }
#endif
