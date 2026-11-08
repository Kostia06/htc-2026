#if DEBUG
    import Foundation
    import SkillitKit
    import UIKit

    /// Sample resume and coach replies for screenshots and previews; never talks to the server.
    struct SampleResume: ResumeService {
        static let resume = Resume(
            contact: .init(name: "Jordan Lee", email: "jordan.lee@ucalgary.ca", phone: "403-555-0100", links: ["github.com/jordanlee"]),
            summary: "Third-year computer science student looking for a junior data analyst role.",
            experience: [
                .init(
                    role: "Software Developer Co-op",
                    org: "ATB Financial",
                    start: "May 2026",
                    end: "Aug 2026",
                    bullets: [
                        "Worked on a Python Flask API for internal users",
                        "Wrote SQL reports in Postgres for the lending team",
                        "Helped with code reviews and testing",
                    ]
                ),
            ],
            education: [.init(school: "University of Calgary", program: "BSc Computer Science", year: "April 2028")],
            projects: [
                .init(
                    name: "Budget tracker",
                    bullets: ["Built a budgeting app with SwiftUI and SwiftData"],
                    link: "github.com/jordanlee/budget"
                ),
            ],
            skills: ["Python", "SQL", "Flask", "Postgres", "SwiftUI", "Git"]
        )

        static let suggestions = [
            ResumeSuggestion(
                path: "experience[0].bullets[0]",
                before: "Worked on a Python Flask API for internal users",
                after: "Built and maintained a Python Flask API serving [add number] internal users",
                why: "Names what you did and leaves room for the scale."
            ),
            ResumeSuggestion(
                path: "experience[0].bullets[1]",
                before: "Wrote SQL reports in Postgres for the lending team",
                after: "Delivered Postgres SQL reports the lending team used to track [add number] accounts",
                why: "Ties the reports to a result the team relied on."
            ),
            ResumeSuggestion(
                path: "experience[0].bullets[2]",
                before: "Helped with code reviews and testing",
                after: "Reviewed teammates' pull requests and wrote tests that caught issues before release",
                why: "Specific actions read stronger than 'helped with'."
            ),
        ]

        func resume() async throws(SkillitError) -> SavedResume {
            try? await Task.sleep(for: .milliseconds(600))
            return SavedResume(resume: Self.resume, saved: true)
        }

        func saveResume(_ resume: Resume) async throws(SkillitError) -> Resume {
            var saved = resume
            saved.updatedAt = Date.now.ISO8601Format()
            return saved
        }

        func improveResume(section _: Resume.Section?) async throws(SkillitError) -> [ResumeSuggestion] {
            try? await Task.sleep(for: .seconds(1.2))
            return Self.suggestions
        }

        func resumeFileData(_ format: ResumeFileFormat, template _: ResumeTemplate) async throws(SkillitError) -> Data {
            // only the server writes Word files; samples have nothing real to hand over
            guard format == .pdf else { throw .rejected(status: 501, message: "Word files need the server.") }
            // a real one-page PDF: the viewer rejects files PDFKit can't open, as a hand-written stub would be
            let page = CGRect(x: 0, y: 0, width: 612, height: 792)
            return UIGraphicsPDFRenderer(bounds: page).pdfData { context in
                context.beginPage()
                let name = NSAttributedString(string: Self.resume.contact.name, attributes: [.font: UIFont.boldSystemFont(ofSize: 24)])
                name.draw(at: CGPoint(x: 54, y: 54))
                let summary = NSAttributedString(string: Self.resume.summary, attributes: [.font: UIFont.systemFont(ofSize: 12)])
                summary.draw(in: CGRect(x: 54, y: 94, width: 504, height: 60))
            }
        }
    }
#endif
