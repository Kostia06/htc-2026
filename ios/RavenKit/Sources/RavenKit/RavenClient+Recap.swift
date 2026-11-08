import Foundation

public extension RavenClient {
    /// One typed turn of "tell Raven how it went". Send the full history each time.
    func recapTurn(_ request: RecapTurnRequest) async throws(RavenError) -> RecapReply {
        try await send(authorized("POST", "api/recap", json: request))
    }

    /// Starts a spoken recap and returns what the voice engine needs to connect.
    func startRecapVoice(companySlug: String? = nil) async throws(RavenError) -> RecapVoiceStart {
        try await send(authorized("POST", "api/recap/voice", json: RecapVoiceBody(companySlug: companySlug)))
    }

    /// Hands the finished call's transcript in; the server reads it the same way as a typed recap.
    func finishRecapVoice(_ sessionId: String, transcript: [RecapTranscriptLine]) async throws(RavenError) -> RecapReply {
        try await send(authorized("POST", "api/recap/voice/\(sessionId)/finish", json: RecapTranscriptBody(transcript: transcript)))
    }
}

private struct RecapVoiceBody: Encodable { let companySlug: String? }
private struct RecapTranscriptBody: Encodable { let transcript: [RecapTranscriptLine] }
