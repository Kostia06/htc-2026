import Foundation
@testable import RavenKit
import Testing

struct ProfileEditTests {
    let coop = Profile.Experience(role: "Co-op", org: "ATB", start: "May 2026")
    let degree = Profile.Education(school: "UCalgary", program: "BSc CS")

    var profile: Profile {
        Profile(
            headline: "CS student",
            targetRoles: ["Data analyst"],
            skills: [.init(name: "Python", source: .resume)],
            education: [degree],
            experience: [coop, .init(role: "Tutor", org: "UCalgary")],
        )
    }

    @Test func `adds a chip once and trims it`() {
        var edited = profile
        #expect(edited.apply(.addSkill("  SQL ")) == ProfilePatch(skills: [.init(name: "SQL", source: .selfReported)]))
        #expect(edited.skills.map(\.name) == ["Python", "SQL"])
        #expect(edited.apply(.addSkill("python")) == nil)
        #expect(edited.apply(.addTargetRole("   ")) == nil)
    }

    @Test func `removes a chip by name regardless of case`() {
        var edited = profile
        #expect(edited.apply(.removeSkill("PYTHON")) == ProfilePatch(remove: .init(skills: ["PYTHON"])))
        #expect(edited.skills.isEmpty)
        #expect(edited.apply(.removeTargetRole("Nurse")) == nil)
    }

    @Test func `editing a row keeps its place and tells the server which row it replaced`() {
        var edited = profile
        let fixed = Profile.Experience(role: "Developer Co-op", org: "ATB", start: "May 2026")
        let patch = edited.apply(.saveExperience(fixed, replacing: coop))
        #expect(patch == ProfilePatch(experience: [fixed], remove: .init(experience: [coop])))
        #expect(edited.experience.map(\.role) == ["Developer Co-op", "Tutor"])
    }

    @Test func `a new row is appended and blank fields are dropped`() {
        var edited = profile
        let row = Profile.Education(school: " SAIT ", program: "", year: "First-year")
        let expected = ProfilePatch(education: [.init(school: "SAIT", year: "First-year")])
        #expect(edited.apply(.saveEducation(row, replacing: nil)) == expected)
        #expect(edited.education.count == 2)
        #expect(edited.apply(.saveExperience(.init(role: "", org: "ATB"), replacing: nil)) == nil)
    }

    @Test func `removing a row and an unchanged save are no-ops for the server when nothing changes`() {
        var edited = profile
        #expect(edited.apply(.removeEducation(degree)) == ProfilePatch(remove: .init(education: [degree])))
        #expect(edited.education.isEmpty)
        #expect(edited.apply(.saveExperience(coop, replacing: coop)) == nil)
        #expect(edited.apply(.setHeadline("CS student")) == nil)
        #expect(edited.apply(.setHeadline("Fourth-year")) == ProfilePatch(headline: "Fourth-year"))
    }

    @Test func `the patch encodes only what it carries`() throws {
        let data = try JSONEncoder().encode(ProfilePatch(remove: .init(skills: ["SQL"])))
        let json = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(json.keys.sorted() == ["remove"])
        #expect((json["remove"] as? [String: [String]]) == ["skills": ["SQL"]])
    }
}

extension StubbedNetworkTests {
    struct ProfileEditClientTests {
        let client = RavenClientTests.client(accessToken: { "t0k" })

        @Test func `patches the profile and decodes the result`() async throws {
            let saved = #"{"profile":{"skills":[{"name":"SQL","source":"self-reported"}]}}"#
            StubProtocol.routes.withLock { $0["PATCH /api/me/profile"] = (200, saved) }
            let profile = try await client.updateProfile(ProfilePatch(skills: [.init(name: "SQL", source: .selfReported)]))
            #expect(profile.skills.map(\.name) == ["SQL"])
            let body = try #require(StubProtocol.bodies.withLock { $0["PATCH /api/me/profile"] })
            #expect(try #require(String(data: body, encoding: .utf8)).contains(#""source":"self-reported""#))
        }

        @Test func `erases everything with one call`() async throws {
            StubProtocol.routes.withLock { $0["DELETE /api/me"] = (200, #"{"deleted":{"user_profiles":1}}"#) }
            try await client.eraseMyData()
            StubProtocol.routes.withLock { $0["DELETE /api/me"] = (500, #"{"error":"db down"}"#) }
            await #expect(throws: RavenError.rejected(status: 500, message: "db down")) { try await client.eraseMyData() }
        }
    }
}
