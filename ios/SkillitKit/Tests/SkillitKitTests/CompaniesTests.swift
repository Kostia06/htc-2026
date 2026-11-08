import Foundation
@testable import SkillitKit
import Testing

struct CompanyInsightsDecodingTests {
    @Test func `decodes the snake_case insights payload`() throws {
        let json = #"""
        {"company":{"id":"c1","slug":"atb","name":"ATB Financial","website":"https://atb.com",
                    "last_researched_at":"2026-11-07T08:00:00.000Z"},
         "facts":[{"kind":"interview_process","text":"Two rounds","source_url":"https://atb.com/careers",
                   "fetched_at":"2026-11-07T08:00:00.000Z"}],
         "reportCount":2,
         "questions":[{"text":"Why ATB?","count":4,"example":false,"last_reported_at":"2026-10"},
                      {"text":"Tell me about a bug","count":1,"example":true,"last_reported_at":null}]}
        """#
        let insights = try JSONDecoder().decode(CompanyInsights.self, from: Data(json.utf8))
        #expect(insights.company.name == "ATB Financial")
        #expect(insights.company.lastResearchedAt == "2026-11-07T08:00:00.000Z")
        #expect(insights.facts.first?.kind == .interviewProcess)
        #expect(insights.facts.first?.sourceURL == "https://atb.com/careers")
        #expect(insights.reportCount == 2)
        #expect(insights.questions.map(\.isExample) == [false, true])
        #expect(insights.questions.first?.lastReportedMonth == "2026-10")
    }

    @Test func `a research run with only a status still decodes`() throws {
        let run = try JSONDecoder().decode(ResearchRun.self, from: Data(#"{"runId":"r1","status":"done","toolCalls":3}"#.utf8))
        #expect(run == ResearchRun(status: "done", added: 0, summary: ""))
    }
}

struct ExperienceReportTests {
    @Test func `cleaning drops blank questions and empty optionals`() {
        let report = ExperienceReport(
            companySlug: "atb", role: " Analyst ", questions: ["  Why us? ", "", "   "], format: "", outcome: "  ", tips: " Breathe ",
        )
        let cleaned = report.cleaned
        #expect(cleaned.role == "Analyst")
        #expect(cleaned.questions == ["Why us?"])
        #expect(cleaned.format == nil)
        #expect(cleaned.outcome == nil)
        #expect(cleaned.tips == "Breathe")
        #expect(report.isComplete)
    }

    @Test func `a report needs a role and at least one question`() {
        #expect(!ExperienceReport(companySlug: "atb", role: "", questions: ["Q"]).isComplete)
        #expect(!ExperienceReport(companySlug: "atb", role: "Dev", questions: ["", " "]).isComplete)
        #expect(!ExperienceReport(companySlug: "atb", role: "Dev", questions: [String(repeating: "x", count: 501)]).isComplete)
    }
}

extension StubbedNetworkTests {
    struct CompaniesClientTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        @Test func `lists companies`() async throws {
            StubProtocol.routes.withLock {
                $0["GET /api/companies"] = (
                    200,
                    #"{"companies":[{"slug":"atb","name":"ATB Financial","factCount":12,"reportedCount":3,"lastResearchedAt":null}]}"#,
                )
            }
            let companies = try await client.companies()
            let expected = CompanySummary(slug: "atb", name: "ATB Financial", factCount: 12, reportedCount: 3, lastResearchedAt: nil)
            #expect(companies == [expected])
        }

        @Test func `a research cooldown comes back as a rejection the screen can show`() async {
            StubProtocol.routes.withLock { $0["POST /api/research/atb"] = (429, #"{"error":"researched recently, try again later"}"#) }
            await #expect(throws: SkillitError.rejected(status: 429, message: "researched recently, try again later")) {
                try await client.refreshResearch(slug: "atb")
            }
        }

        @Test func `submits a cleaned experience report as JSON`() async throws {
            StubProtocol.routes.withLock { $0["POST /api/experiences"] = (201, #"{"ok":true}"#) }
            let report = ExperienceReport(companySlug: "atb", role: "Dev", questions: ["Why us?", ""], format: "technical", outcome: "")
            try await client.submitExperience(report)
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/experiences"] })
            let sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
            #expect(sent["questions"] as? [String] == ["Why us?"])
            #expect(sent["format"] as? String == "technical")
            #expect(sent["outcome"] == nil)
        }
    }
}
