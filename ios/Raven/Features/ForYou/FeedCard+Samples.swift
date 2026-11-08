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

        /// Listings shaped like real Adzuna results, for screenshots; the links point nowhere real.
        static let samples: [FeedCard] = [
            job("1", "Junior Data Analyst", at: "ATB Financial", why: "Fits your goal: Junior data analyst", posted: "2026-11-05"),
            job("2", "Data Analyst, Lending", at: "Servus", why: "Uses Python and SQL from your profile", posted: "2026-11-03"),
            job("3", "Business Intelligence Intern", at: "Enmax", why: "Uses SQL from your profile", posted: "2026-11-01"),
            job("4", "Reporting Analyst (Co-op)", at: "Shaw Communications", why: "Near you in Calgary", posted: "2026-10-28"),
        ]
    }
#endif
