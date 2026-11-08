import Foundation
@testable import RavenKit
import Testing

struct PairingCodeTests {
    @Test(arguments: ["raven://pair?code=K7M2Q9XD", "K7M2-Q9XD", "k7m2q9xd"])
    func `reads a code from a link or typed text`(payload: String) throws {
        let code = try #require(PairingCode(scanned: payload))
        #expect(code.value == "K7M2Q9XD")
    }

    @Test(arguments: ["https://evil.example/pair?code=K7M2Q9XD", "K7M2Q9X", "K0M2Q9XD", "raven://other?code=K7M2Q9XD"])
    func `refuses anything that isn't a Raven pairing code`(payload: String) {
        #expect(PairingCode(scanned: payload) == nil)
    }
}

struct ProfileDecodingTests {
    @Test func `treats missing lists in a draft as empty`() throws {
        let json = Data(#"{"headline":"Student","skills":[{"name":"SQL","source":"self-reported"}]}"#.utf8)
        let profile = try JSONDecoder().decode(Profile.self, from: json)
        #expect(profile.skills == [.init(name: "SQL", source: .selfReported)])
        #expect(profile.targetRoles.isEmpty)
        #expect(!profile.isEmpty)
    }
}

struct MultipartFormTests {
    @Test func `wraps the file in a named part`() throws {
        var form = MultipartForm()
        form.addFile(field: "file", file: ResumeFile(name: "my \"cv\".pdf", data: Data("%PDF".utf8)))
        let body = try #require(String(data: form.encoded(), encoding: .utf8))
        #expect(body.contains(#"name="file"; filename="my cv.pdf""#))
        #expect(body.hasSuffix("--\(form.boundary)--\r\n"))
    }
}
