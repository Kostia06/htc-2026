import Foundation

extension SkillitClient: HeadsetCodeIssuer {
    public func offerHeadsetCode() async throws(SkillitError) -> HeadsetCode {
        let response: OfferResponse = try await send(authorized("POST", "api/pairing/offer"))
        guard let expiresAt = Self.serverDate(response.expiresAt) else { throw .unreadableResponse }
        return HeadsetCode(digits: response.code, expiresAt: expiresAt)
    }

    public func headsetCodeStatus(_ code: HeadsetCode) async throws(SkillitError) -> HeadsetCodeStatus {
        let response: StatusResponse = try await send(authorized("GET", "api/pairing/offer/\(code.digits)"))
        return response.status
    }

    /// The server writes `toISOString()`, which always has milliseconds; plain seconds are accepted too.
    private static func serverDate(_ text: String) -> Date? {
        (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(text))
            ?? (try? Date.ISO8601FormatStyle().parse(text))
    }
}

private struct OfferResponse: Decodable {
    let code: String
    let expiresAt: String
}

private struct StatusResponse: Decodable { let status: HeadsetCodeStatus }
