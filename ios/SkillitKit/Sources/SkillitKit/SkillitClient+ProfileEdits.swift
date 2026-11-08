import Foundation

public extension SkillitClient {
    /// Merges the patch into the saved profile and returns what the server now holds.
    func updateProfile(_ patch: ProfilePatch) async throws(SkillitError) -> Profile {
        let response: ProfileResponse = try await send(authorized("PATCH", "api/me/profile", json: patch))
        return response.profile
    }

    /// Removes everything the server stores about this person. The session itself stays valid until the app signs out.
    func eraseMyData() async throws(SkillitError) {
        let _: ErasedResponse = try await send(authorized("DELETE", "api/me"))
    }
}

private struct ProfileResponse: Decodable { let profile: Profile }
private struct ErasedResponse: Decodable { let deleted: [String: Int] }
