#if DEBUG
    import Foundation
    import SkillitKit

    /// Realistic company research for screenshots and previews; nothing here touches the network.
    struct SampleCompanies: CompanyService {
        var researchRefusal: SkillitError?

        static let list: [CompanySummary] = [
            CompanySummary(slug: "atb", name: "ATB Financial", factCount: 14, reportedCount: 5, lastResearchedAt: iso(hoursAgo: 2)),
            CompanySummary(slug: "benevity", name: "Benevity", factCount: 9, reportedCount: 1, lastResearchedAt: iso(hoursAgo: 26)),
            CompanySummary(
                slug: "neo-financial", name: "Neo Financial", factCount: 11, reportedCount: 0, lastResearchedAt: iso(hoursAgo: 50),
            ),
            CompanySummary(slug: "helcim", name: "Helcim", factCount: 0, reportedCount: 0, lastResearchedAt: nil),
        ]

        static let atb = CompanyInsights(
            company: CompanyDetails(slug: "atb", name: "ATB Financial", website: "https://www.atb.com", lastResearchedAt: iso(hoursAgo: 2)),
            facts: [
                fact(
                    .about,
                    "Alberta-owned financial institution with about 5,000 team members and 800,000 customers.",
                    "https://www.atb.com/about",
                ),
                fact(
                    .hiring,
                    "Hiring a Junior Data Analyst for the lending analytics team in Calgary; SQL and Python listed as must-haves.",
                    "https://www.atb.com/careers",
                ),
                fact(
                    .hiring,
                    "Summer 2027 co-op postings open in January; applications go through the ATB careers site, not Indeed.",
                    "https://www.atb.com/careers/students",
                ),
                fact(
                    .interview,
                    "Behavioural round leans on STAR stories about working with people outside your team.",
                    "https://www.glassdoor.ca/Interview/ATB-Financial",
                ),
                fact(
                    .interviewProcess,
                    "Phone screen, then a take-home SQL exercise, then a 45-minute panel.",
                    "https://www.glassdoor.ca/Interview/ATB-Financial",
                ),
                fact(
                    .tech,
                    "Data platform runs on Google Cloud with BigQuery and dbt; dashboards in Looker.",
                    "https://www.atb.com/tech-blog",
                ),
                fact(.news, "Opened a new tech hub in downtown Calgary in October 2026.", "https://www.cbc.ca/news/canada/calgary"),
            ],
            reportCount: 5,
            questions: [
                ReportedQuestion(
                    text: "Tell me about a time you explained a technical result to someone non-technical.",
                    count: 4,
                    isExample: false,
                    lastReportedMonth: "2026-10",
                ),
                ReportedQuestion(
                    text: "Why ATB rather than one of the big five banks?", count: 3, isExample: false, lastReportedMonth: "2026-11",
                ),
                ReportedQuestion(text: "Write a query that finds customers with two late payments in a row.", count: 1, isExample: true),
            ],
        )

        func companies() async throws(SkillitError) -> [CompanySummary] {
            try? await Task.sleep(for: .milliseconds(400))
            return Self.list
        }

        func companyInsights(slug: String) async throws(SkillitError) -> CompanyInsights {
            try? await Task.sleep(for: .milliseconds(400))
            guard let company = Self.list.first(where: { $0.slug == slug }) else {
                throw .rejected(status: 404, message: "unknown company")
            }
            if slug == "atb" {
                return Self.atb
            }
            let details = CompanyDetails(slug: slug, name: company.name, lastResearchedAt: company.lastResearchedAt)
            return CompanyInsights(company: details, facts: [], reportCount: 0, questions: [])
        }

        func refreshResearch(slug _: String) async throws(SkillitError) -> ResearchRun {
            try? await Task.sleep(for: .seconds(2))
            if let researchRefusal {
                throw researchRefusal
            }
            return ResearchRun(status: "done", added: 3, summary: "Found three new facts.")
        }

        func submitExperience(_: ExperienceReport) async throws(SkillitError) {
            try? await Task.sleep(for: .milliseconds(600))
        }

        private static func fact(_ kind: CompanyFact.Kind, _ text: String, _ source: String) -> CompanyFact {
            CompanyFact(kind: kind, text: text, sourceURL: source)
        }

        private static func iso(hoursAgo: Double) -> String {
            Date.now.addingTimeInterval(-hoursAgo * 3600).formatted(.iso8601)
        }
    }
#endif
