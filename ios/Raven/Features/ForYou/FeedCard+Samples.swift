#if DEBUG
    import Foundation
    import RavenKit

    extension FeedCard {
        private static let adzuna = Attribution(label: "Jobs by Adzuna", url: URL(string: "https://www.adzuna.ca")!)

        private static func job(_ id: String, _ title: String, at org: String, why: String, posted: String) -> FeedCard {
            FeedCard(
                id: "job:\(id)", kind: .job, title: title, org: org, when: "\(posted)T09:00:00Z", where: "Calgary, Alberta", why: why,
                url: URL(string: "https://www.adzuna.ca/details/\(id)")!, source: "Adzuna", attribution: adzuna,
            )
        }

        private static func link(_ id: String) -> URL {
            URL(string: "https://example.org/\(id)")!
        }

        /// A mixed feed shaped like real results, for screenshots; the links point nowhere real.
        static let samples: [FeedCard] = [
            job("1", "Junior Data Analyst", at: "ATB Financial", why: "Fits your goal: Junior data analyst", posted: "2026-11-05"),
            job("2", "Data Analyst, Lending", at: "Servus", why: "Uses Python and SQL from your profile", posted: "2026-11-03"),
            FeedCard(
                id: "event:ai-tinkerers-calgary", kind: .event, title: "AI Tinkerers Calgary", org: "AI Tinkerers", when: "ongoing",
                where: "Platform Calgary", why: "Uses Python from your profile", url: link("ai-tinkerers"), source: "Curated",
            ),
            FeedCard(
                id: "hackathon:calgaryhacks-2027", kind: .hackathon, title: "CalgaryHacks 2027 registration opens",
                org: "UCalgary Computer Science Undergraduate Society", when: "2026-11-16", where: "University of Calgary",
                why: "In your field: computer science", url: link("calgaryhacks"), source: "Curated",
            ),
            job("3", "Business Intelligence Intern", at: "Enmax", why: "Uses SQL from your profile", posted: "2026-11-01"),
            FeedCard(
                id: "course:google-data-analytics", kind: .course, title: "Google Data Analytics Professional Certificate",
                org: "Google on Coursera", when: "ongoing", where: "Online", why: "Uses SQL from your profile",
                url: link("google-data-analytics"), source: "Curated", saved: true,
            ),
            FeedCard(
                id: "event:ucalgary-winter-career-fair-2027", kind: .event, title: "Winter Career Fair", org: "University of Calgary",
                when: "2027-01-26", where: "MacEwan Hall, University of Calgary", why: "Coming up Jan 26", url: link("career-fair"),
                source: "Curated",
            ),
            job("4", "Reporting Analyst (Co-op)", at: "Shaw Communications", why: "Near you in Calgary", posted: "2026-10-28"),
        ]
    }
#endif
