import Foundation
import RavenKit

/// Where private memories come from: the server in the app, sample data in previews and screenshots.
protocol MemoryService: Sendable {
    func memories() async throws(RavenError) -> [PrivateMemory]
    func forgetMemory(id: String) async throws(RavenError)
    func shareMemory(id: String, companySlug: String, role: String) async throws(RavenError)
    /// The companies a note can be shared against.
    func companies() async throws(RavenError) -> [CompanySummary]
}

extension RavenClient: MemoryService {}

struct UnavailableMemories: MemoryService {
    func memories() async throws(RavenError) -> [PrivateMemory] {
        throw .offline
    }

    func forgetMemory(id _: String) async throws(RavenError) {
        throw .offline
    }

    func shareMemory(id _: String, companySlug _: String, role _: String) async throws(RavenError) {
        throw .offline
    }

    func companies() async throws(RavenError) -> [CompanySummary] {
        throw .offline
    }
}

extension AppModel {
    var memoryService: any MemoryService {
        client ?? UnavailableMemories()
    }
}

#if DEBUG
    struct SampleMemories: MemoryService {
        static let memories: [PrivateMemory] = [
            memory("m1", .goal, "Land a junior data analyst role in Calgary by spring 2027", daysAgo: 12, uses: 9),
            memory("m2", .skill, "Comfortable with SQL joins and window functions", daysAgo: 12, uses: 4),
            memory("m3", .skill, "Built a Flask API used by 2,000 people at a co-op", daysAgo: 10, uses: 3),
            memory("m4", .weakness, "Answers trail off without a result; practise closing with the outcome", daysAgo: 3, uses: 2),
            memory("m5", .preference, "Prefers short practice sessions in the evening", daysAgo: 8, uses: 5),
            memory("m6", .note, "ATB phone screen asked about a time I disagreed with a manager", daysAgo: 1, uses: 0),
            memory("m7", .note, "Benevity recruiter said the take-home takes about three hours", daysAgo: 6, uses: 1),
        ]

        func memories() async throws(RavenError) -> [PrivateMemory] {
            try? await Task.sleep(for: .milliseconds(400))
            return Self.memories
        }

        func forgetMemory(id _: String) async throws(RavenError) {
            try? await Task.sleep(for: .milliseconds(300))
        }

        func shareMemory(id _: String, companySlug _: String, role _: String) async throws(RavenError) {
            try? await Task.sleep(for: .milliseconds(600))
        }

        func companies() async throws(RavenError) -> [CompanySummary] {
            SampleCompanies.list
        }

        private static func memory(_ id: String, _ kind: PrivateMemory.Kind, _ text: String, daysAgo: Double, uses: Int) -> PrivateMemory {
            let created = Date.now.addingTimeInterval(-daysAgo * 86400).formatted(.iso8601)
            return PrivateMemory(id: id, kind: kind, text: text, createdAt: created, uses: uses)
        }
    }
#endif
