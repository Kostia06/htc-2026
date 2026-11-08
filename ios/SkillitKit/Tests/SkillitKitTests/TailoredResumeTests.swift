import Foundation
@testable import SkillitKit
import Testing

struct TailoredResumeDecodingTests {
    private static let resume = #"{"contact":{"name":"J","email":"","phone":"","links":[]},"summary":"","experience":[],"#
        + #""education":[],"projects":[],"skills":["SQL","Python"]}"#
    private static let skillsChange = #"{"id":"c1","kind":"reorder","section":"skills","basedOn":"skills","before":"Python, SQL","#
        + #""after":"SQL, Python","why":"Moves SQL to the front.","requirement":"Strong SQL","accepted":true,"skills":["SQL","Python"]}"#
    private static let trimChange = #"{"id":"c2","kind":"trim","section":"experience","basedOn":"experience[0].bullets[2]","#
        + #""before":"Helped with testing","after":"","why":"Less relevant here.","requirement":null,"accepted":false}"#
    private static let match = #"{"covered":[{"text":"Strong SQL","topic":"SQL","required":true}],"#
        + #""missing":[{"text":"Tableau","topic":"Tableau","required":false}],"coveredBefore":1}"#
    private let json = Data((#"{"id":"tr_1","postingId":"po_1","title":"Junior Data Analyst","company":"Acme","#
            + #""base":\#(resume),"resume":\#(resume),"changes":[\#(skillsChange),\#(trimChange)],"match":\#(match),"#
            + #""editedByHand":false,"createdAt":"2026-11-08T10:00:00.000Z","updatedAt":"2026-11-08T10:00:00.000Z"}"#).utf8)

    @Test func `reads a tailored resume with its change log and match`() throws {
        let tailored = try JSONDecoder().decode(TailoredResume.self, from: json)
        #expect(tailored.resume.skills == ["SQL", "Python"])
        #expect(tailored.changes.map(\.kind) == [.reorder, .trim])
        #expect(tailored.changes[1].requirement == nil)
        #expect(tailored.changes[1].sectionTitle == "Experience")
        #expect(tailored.match.total == 2)
    }

    @Test func `a list row says how much of the posting it covers`() {
        let row = TailoredResumeSummary(id: "tr_1", postingId: "po_1", title: "A", company: "B", covered: 3, total: 5, updatedAt: "")
        #expect(row.matchLine == "3 of 5 requirements")
        let empty = TailoredResumeSummary(id: "x", postingId: "p", title: "A", company: "B", covered: 0, total: 0, updatedAt: "")
        #expect(empty.matchLine == "No requirements listed")
    }
}

extension StubbedNetworkTests {
    struct TailoredResumeClientTests {
        let client = SkillitClientTests.client(accessToken: { "t0k" })

        @Test func `tailors for a saved posting or pasted text`() async throws {
            let resume = #"{"contact":{"name":"","email":"","phone":"","links":[]},"summary":"","experience":[],"#
                + #""education":[],"projects":[],"skills":[]}"#
            let reply = #"{"id":"tr_1","postingId":"po_1","title":"A","company":"B","resume":\#(resume),"changes":[],"#
                + #""match":{"covered":[],"missing":[],"coveredBefore":0},"editedByHand":false,"updatedAt":"t"}"#
            StubProtocol.routes.withLock { $0["POST /api/resume/tailored"] = (201, reply) }

            _ = try await client.tailorResume(for: .posting(id: "po_1"))
            var body = try #require(StubProtocol.bodies.withLock { $0["POST /api/resume/tailored"] })
            var sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
            #expect(sent["postingId"] as? String == "po_1")
            #expect(sent["text"] == nil)

            _ = try await client.tailorResume(for: .text("Analyst at Acme"))
            body = try #require(StubProtocol.bodies.withLock { $0["POST /api/resume/tailored"] })
            sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
            #expect(sent["text"] as? String == "Analyst at Acme")
            #expect(sent["postingId"] == nil)
        }

        @Test func `lists, toggles one change and deletes`() async throws {
            StubProtocol.routes.withLock {
                let row = #"{"id":"tr_1","postingId":"po_1","title":"A","company":"B","covered":1,"total":2,"updatedAt":"t"}"#
                $0["GET /api/resume/tailored"] = (200, #"{"tailored":[\#(row)]}"#)
                $0["DELETE /api/resume/tailored/tr_1"] = (200, #"{"deleted":true}"#)
                $0["PUT /api/resume/tailored/tr_1"] = (409, #"{"error":"edited by hand"}"#)
            }
            #expect(try await client.tailoredResumes().map(\.matchLine) == ["1 of 2 requirements"])
            try await client.deleteTailoredResume(id: "tr_1")
            await #expect(throws: SkillitError.rejected(status: 409, message: "edited by hand")) {
                try await client.setChange("c1", accepted: false, in: "tr_1")
            }
            let body = try #require(StubProtocol.bodies.withLock { $0["PUT /api/resume/tailored/tr_1"] })
            let sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: [[String: Any]]])
            #expect(sent["changes"]?.first?["id"] as? String == "c1")
            #expect(sent["changes"]?.first?["accepted"] as? Bool == false)
        }
    }
}
