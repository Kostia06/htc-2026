import Foundation
@testable import SkillitKit
import Testing

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
