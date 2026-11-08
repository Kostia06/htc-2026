import Foundation

public extension SkillitClient {
    /// One plain-words update. Skillit applies it, or asks the one question it needs first; send the conversation back with the answer.
    func quickUpdate(_ request: QuickUpdateRequest) async throws(SkillitError) -> QuickUpdateReply {
        try await send(authorized("POST", "api/updates", json: request))
    }

    /// Any document, any time (a transcript, certificate, resume, cover letter): Skillit reads it, applies what it states
    /// and forgets the file. The reply never asks a question back.
    func uploadUpdateFile(_ file: ResumeFile) async throws(SkillitError) -> QuickUpdateReply {
        var form = MultipartForm()
        form.addFile(field: "file", file: file)
        var request = try await authorized("POST", "api/updates/file")
        request.setValue(form.contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = form.encoded()
        return try await send(request)
    }
}
