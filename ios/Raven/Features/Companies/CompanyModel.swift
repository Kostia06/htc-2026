import Foundation
import Observation
import RavenKit

/// One company's research, and the state of a refresh the person asked for.
@Observable
final class CompanyModel {
    enum Phase: Equatable {
        case loading
        case ready(CompanyInsights)
        case failed(String)
    }

    enum Research: Equatable {
        case idle
        case running
        /// The server refused (usually the 30-minute cooldown) or the run failed; shown briefly under the button.
        case refused(String)
        case done(added: Int)
    }

    private(set) var phase: Phase = .loading
    private(set) var research: Research = .idle

    let slug: String
    private let service: any CompanyService

    init(slug: String, service: any CompanyService) {
        self.slug = slug
        self.service = service
    }

    var insights: CompanyInsights? {
        if case let .ready(insights) = phase {
            insights
        } else {
            nil
        }
    }

    /// Facts in the order the sections should appear; kinds with nothing to show are left out.
    var factGroups: [(kind: CompanyFact.Kind, facts: [CompanyFact])] {
        guard let insights else { return [] }
        return CompanyFact.Kind.allCases.compactMap { kind in
            let facts = insights.facts.filter { $0.kind == kind }
            return facts.isEmpty ? nil : (kind, facts)
        }
    }

    func load() async {
        if insights == nil {
            phase = .loading
        }
        do {
            phase = try await .ready(service.companyInsights(slug: slug))
        } catch {
            if insights == nil {
                phase = .failed(error.message)
            }
        }
    }

    /// Runs the research agent, then reloads so the new facts land on screen.
    func refreshResearch() async {
        guard research != .running else { return }
        research = .running
        do {
            let run = try await service.refreshResearch(slug: slug)
            await load()
            research = .done(added: run.added)
        } catch let .rejected(status, message) where status == 429 {
            research = .refused(message.isEmpty ? "Researched recently. Try again in a little while." : message)
        } catch {
            research = .refused(error.message)
        }
        try? await Task.sleep(for: .seconds(4))
        if research != .running {
            research = .idle
        }
    }
}

extension CompanyFact.Kind {
    var title: String {
        switch self {
        case .about: "About"
        case .hiring: "Hiring"
        case .interview: "Interviews"
        case .interviewProcess: "Interview process"
        case .tech: "Tech"
        case .news: "News"
        }
    }

    var symbol: String {
        switch self {
        case .about: "building.2"
        case .hiring: "person.badge.plus"
        case .interview: "bubble.left.and.bubble.right"
        case .interviewProcess: "list.number"
        case .tech: "cpu"
        case .news: "newspaper"
        }
    }
}
