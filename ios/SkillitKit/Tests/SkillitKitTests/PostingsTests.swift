import Foundation
@testable import SkillitKit
import Testing

struct PostingDetectionTests {
    @Test func `a single pasted link is a posting`() {
        let detected = PostingDetection.detect("  https://acme.com/careers/123 ")
        #expect(detected == PostingImportRequest(url: URL(string: "https://acme.com/careers/123")!))
        #expect(PostingDetection.detect("ftp://acme.com/x") == nil)
        #expect(PostingDetection.detect("see https://acme.com/careers/123 please") == nil)
    }

    @Test func `long text, or shorter text that reads like a job ad, is a posting`() {
        let long = String(repeating: "We build dashboards. ", count: 40)
        #expect(PostingDetection.detect(long) == PostingImportRequest(text: long.trimmingCharacters(in: .whitespaces)))
        let adLike = "Junior Data Analyst at Acme. " + String(repeating: "Great team. ", count: 20) + "Requirements: SQL, Python."
        #expect(PostingDetection.detect(adLike) != nil)
        #expect(PostingDetection.detect("I finished the Flask dashboard project") == nil)
    }
}

struct JobPostingDecodingTests {
    private let json = Data("""
    {"id":"po_1","title":"Junior Data Analyst","company":"Acme","companySlug":"acme","location":"Calgary","seniority":null,
     "requirements":[{"text":"SQL","topic":"SQL","required":true,"have":true,"evidence":"Skill: SQL"},
                     {"text":"Tableau","topic":"Tableau","required":false,"have":false}],
     "responsibilities":["Build dashboards"],"skills":["SQL"],"sourceUrl":"https://acme.com/jobs/1",
     "prefilled":{"targetRole":"Junior Data Analyst","company":{"slug":"acme","name":"Acme","researchQueued":true},
                  "steps":["Build up Tableau"]},
     "createdAt":"2026-11-07T10:00:00.000Z"}
    """.utf8)

    @Test func `reads a posting and sums up what the person has`() throws {
        let posting = try JSONDecoder().decode(JobPosting.self, from: json)
        #expect(posting.haveCount == 1)
        #expect(posting.requirementsLine == "1 of 2 requirements")
        #expect(posting.sourceURL == URL(string: "https://acme.com/jobs/1"))
        let changes = posting.prefilled.appliedChanges
        #expect(changes.map(\.summary) == ["Added target role Junior Data Analyst", "Researching Acme", "Added step \"Build up Tableau\""])
        #expect(changes.map(\.type) == ["add_target_role", "add_company", "add_step"])
    }

    @Test func `a bare posting still decodes`() throws {
        let posting = try JSONDecoder().decode(JobPosting.self, from: Data(#"{"id":"po_2","title":"Clerk","company":"Shop"}"#.utf8))
        #expect(posting.requirementsLine == "No requirements listed")
        #expect(posting.prefilled.isEmpty)
    }
}

extension StubbedNetworkTests {
    struct PostingsClientTests {
        let client: SkillitClient

        init() {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [StubProtocol.self]
            client = SkillitClient(
                baseURL: URL(string: "https://api.test")!,
                accessToken: { "t0k" },
                session: URLSession(configuration: configuration)
            )
        }

        @Test func `sends the link, and reads the posting back`() async throws {
            StubProtocol.routes.withLock {
                $0["POST /api/postings"] = (201, #"{"id":"po_1","title":"Junior Data Analyst","company":"Acme","requirements":[]}"#)
            }
            let posting = try await client.importPosting(PostingImportRequest(url: URL(string: "https://acme.com/jobs/1")!))
            #expect(posting.title == "Junior Data Analyst")
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/postings"] })
            let sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
            #expect(sent["url"] as? String == "https://acme.com/jobs/1")
            #expect(sent["text"] == nil)
        }

        @Test func `a 422 asks for the text`() async throws {
            let message = "Skillit can't read that site. Paste the posting text instead."
            StubProtocol.routes.withLock {
                $0["POST /api/postings"] = (422, #"{"error":"\#(message)","needsText":true}"#)
            }
            await #expect(throws: SkillitError.rejected(status: 422, message: message)) {
                try await client.importPosting(PostingImportRequest(url: URL(string: "https://www.linkedin.com/jobs/1")!))
            }
            #expect(SkillitError.rejected(status: 422, message: "x").needsPostingText)
            #expect(!SkillitError.rejected(status: 502, message: "x").needsPostingText)
        }

        @Test func `lists postings`() async throws {
            StubProtocol.routes.withLock { $0["GET /api/postings"] = (200, #"{"postings":[{"id":"po_1","title":"A","company":"B"}]}"#) }
            #expect(try await client.postings().map(\.id) == ["po_1"])
        }
    }
}

struct InterviewTargetTests {
    @Test func `each target becomes the right session request`() {
        let fromPosting = InterviewTarget.posting(id: "po_1", title: "Analyst", company: "Acme").request(difficulty: .hard)
        #expect(fromPosting == VoiceSessionRequest(mode: .interview, difficulty: .hard, postingId: "po_1"))
        let fromCompany = InterviewTarget.company(slug: "acme", name: "Acme").request(difficulty: .easy)
        #expect(fromCompany == VoiceSessionRequest(mode: .interview, companySlug: "acme", difficulty: .easy))
        let fromRole = InterviewTarget.role("Junior analyst").request(difficulty: .standard)
        #expect(fromRole == VoiceSessionRequest(mode: .interview, role: "Junior analyst", difficulty: .standard))
        #expect(InterviewTarget.other("Barista").request(difficulty: .standard).role == "Barista")
    }

    @Test func `a roadmap step picks its posting first, then its company, then its role`() {
        let posting = JobPosting(id: "po_1", title: "Analyst", company: "Acme")
        let names: (String) -> String? = { $0 == "acme" ? "Acme" : nil }
        let withPosting = RoadmapAction(type: .interview, companySlug: "acme", role: "Analyst", postingId: "po_1")
        let picked = InterviewTarget(action: withPosting, postings: [posting], companyName: names)
        #expect(picked == .posting(id: "po_1", title: "Analyst", company: "Acme"))
        let postingGone = RoadmapAction(type: .interview, companySlug: "acme", role: "Analyst", postingId: "gone")
        #expect(InterviewTarget(action: postingGone, postings: [posting], companyName: names) == .company(slug: "acme", name: "Acme"))
        let roleOnly = RoadmapAction(type: .interview, role: "Analyst")
        #expect(InterviewTarget(action: roleOnly, postings: [], companyName: names) == .role("Analyst"))
        #expect(InterviewTarget(action: RoadmapAction(type: .interview), postings: [], companyName: names) == nil)
    }

    @Test func `a role can be practised for a local company, a posting or company can't take another`() {
        #expect(InterviewTarget.role("Analyst").canAddCompany)
        #expect(InterviewTarget.other("Barista").canAddCompany)
        #expect(!InterviewTarget.company(slug: "acme", name: "Acme").canAddCompany)
        #expect(!InterviewTarget.posting(id: "po_1", title: "Analyst", company: "Acme").canAddCompany)

        let atAcme = InterviewTarget.role("Analyst").request(difficulty: .standard, at: "acme")
        #expect(atAcme == VoiceSessionRequest(mode: .interview, companySlug: "acme", role: "Analyst", difficulty: .standard))
        let companyKeepsItsOwn = InterviewTarget.company(slug: "acme", name: "Acme").request(difficulty: .easy, at: "other")
        #expect(companyKeepsItsOwn.companySlug == "acme")
    }

    @Test func `round-trips through JSON so the last choice can be remembered`() throws {
        let target = InterviewTarget.company(slug: "acme", name: "Acme")
        let data = try JSONEncoder().encode(target)
        #expect(try JSONDecoder().decode(InterviewTarget.self, from: data) == target)
    }
}
