import Foundation
@testable import SkillitKit
import Testing

struct ResumeTests {
    static let sample = Resume(
        contact: .init(name: "Jordan Lee", email: "jordan@example.com"),
        summary: "Third-year computer science student",
        experience: [
            .init(role: "Co-op", org: "ATB Financial", start: "May 2026", end: "Aug 2026", bullets: ["Worked on an API", "Wrote SQL"]),
        ],
        projects: [.init(name: "Budget tracker", bullets: ["Built a budgeting app"])],
        skills: ["Python"]
    )

    static let emptyLists = #""experience":[],"education":[],"projects":[]"#
    static let blankContact = #""contact":{"name":"","email":"","phone":"","links":[]}"#

    @Test func `decodes the server's envelope with every list present`() throws {
        let json = #"{"resume":{"contact":{"name":"Jo","email":"","phone":"","links":[]},"summary":"Hi","#
            + Self.emptyLists + #","skills":["SQL"]},"saved":false}"#
        let saved = try JSONDecoder().decode(SavedResume.self, from: Data(json.utf8))
        #expect(saved.saved == false)
        #expect(saved.resume.contact.name == "Jo")
        #expect(saved.resume.skills == ["SQL"])
    }

    @Test func `reads the text a path points at`() {
        let resume = Self.sample
        #expect(resume.text(at: "summary") == "Third-year computer science student")
        #expect(resume.text(at: "experience[0].bullets[1]") == "Wrote SQL")
        #expect(resume.text(at: "projects[0].bullets[0]") == "Built a budgeting app")
        #expect(resume.text(at: "experience[4].bullets[0]") == nil)
        #expect(resume.text(at: "experience[0]") == nil)
        #expect(resume.text(at: "skills[0]") == nil)
    }

    @Test func `applies a suggestion where its path points and refuses a stale one`() {
        var resume = Self.sample
        let rewrite = ResumeSuggestion(path: "experience[0].bullets[0]", before: "Worked on an API", after: "Built a Flask API", why: "")
        let accepted = resume.apply(rewrite)
        #expect(accepted)
        #expect(resume.experience[0].bullets == ["Built a Flask API", "Wrote SQL"])
        let summaryAccepted = resume.apply(ResumeSuggestion(path: "summary", before: "", after: "Student", why: ""))
        #expect(summaryAccepted)
        #expect(resume.summary == "Student")
        let before = resume
        let staleAccepted = resume.apply(ResumeSuggestion(path: "projects[3].bullets[0]", before: "", after: "x", why: ""))
        let fieldAccepted = resume.apply(ResumeSuggestion(path: "education[0].school", before: "", after: "x", why: ""))
        #expect(!staleAccepted)
        #expect(!fieldAccepted)
        #expect(resume == before)
    }

    @Test func `labels a suggestion by the entry it changes`() {
        let resume = Self.sample
        #expect(resume.label(for: "summary") == "Summary")
        #expect(resume.label(for: "experience[0].bullets[1]") == "Experience · ATB Financial")
        #expect(resume.label(for: "projects[0].bullets[0]") == "Projects · Budget tracker")
        #expect(resume.label(for: "nonsense") == "Resume")
    }
}

extension StubbedNetworkTests {
    struct ResumeClientTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        @Test func `loads, saves and improves the resume`() async throws {
            let lists = ResumeTests.emptyLists
            let loadedJSON = #"{"resume":{"# + ResumeTests.blankContact + #","summary":"Hi","# + lists + #","skills":[]},"saved":false}"#
            let savedJSON = #"{"resume":{"contact":{"name":"Jo","email":"","phone":"","links":[]},"summary":"","# + lists
                + #","skills":[]},"saved":true}"#
            let improvedJSON = #"{"runId":"r1","suggestions":[{"path":"summary","before":"Hi","after":"Hello","why":"Warmer."}]}"#
            StubProtocol.routes.withLock {
                $0["GET /api/resume"] = (200, loadedJSON)
                $0["PUT /api/resume"] = (200, savedJSON)
                $0["POST /api/resume/improve"] = (200, improvedJSON)
            }
            let loaded = try await client.resume()
            #expect(loaded.resume.summary == "Hi")
            #expect(loaded.saved == false)

            let saved = try await client.saveResume(Resume(contact: .init(name: "Jo")))
            #expect(saved.contact.name == "Jo")
            let sentBody = try #require(StubProtocol.bodies.withLock { $0["PUT /api/resume"] })
            #expect(!sentBody.isEmpty)

            let suggestions = try await client.improveResume(section: .summary)
            #expect(suggestions == [ResumeSuggestion(path: "summary", before: "Hi", after: "Hello", why: "Warmer.")])
            let improveBody = try #require(StubProtocol.bodies.withLock { $0["POST /api/resume/improve"] })
            #expect(String(bytes: improveBody, encoding: .utf8) == #"{"section":"summary"}"#)
        }

        @Test func `downloads the file bytes in the chosen layout`() async throws {
            StubProtocol.routes.withLock {
                $0["GET /api/resume/pdf"] = (200, "%PDF-1.4 fake")
                $0["GET /api/resume/tailored/t1/docx"] = (200, "PK fake")
            }
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [StubProtocol.self]
            let session = URLSession(configuration: configuration)
            let data = try await client.resumeFile(.pdf, template: .plain, using: session)
            #expect(String(bytes: data, encoding: .utf8)?.hasPrefix("%PDF") == true)
            let word = try await client.tailoredResumeFile(id: "t1", .docx, template: .skillit, using: session)
            #expect(String(bytes: word, encoding: .utf8) == "PK fake")
        }
    }
}
