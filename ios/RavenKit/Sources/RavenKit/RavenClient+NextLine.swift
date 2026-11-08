import Foundation

/// One line of the spoken conversation so far, as the server reads it to decide what comes next.
public struct TranscriptLine: Codable, Equatable, Sendable {
    public enum Speaker: String, Codable, Sendable {
        case interviewer, candidate
    }

    public let speaker: Speaker
    public let text: String

    public init(speaker: Speaker, text: String) {
        self.speaker = speaker
        self.text = text
    }
}

/// What the interviewer says after an answer: a quick follow-up, the next planned question, or goodbye.
public struct NextLine: Decodable, Equatable, Sendable {
    public enum Kind: String, Decodable, Sendable {
        case followUp = "follow_up"
        case question
        case wrapUp = "wrap_up"
    }

    public let say: String
    public let kind: Kind

    public init(say: String, kind: Kind) {
        self.say = say
        self.kind = kind
    }
}

private struct NextLineRequest: Encodable {
    let answer: String
    let transcript: [TranscriptLine]
}

public extension RavenClient {
    func nextLine(after answer: String, transcript: [TranscriptLine], in sessionId: String) async throws(RavenError) -> NextLine {
        let body = NextLineRequest(answer: answer, transcript: transcript)
        return try await send(authorized("POST", "api/voice/sessions/\(sessionId)/next", json: body))
    }
}

/// The conversation without a server: each planned line once, in order, then goodbye. No follow-ups.
public struct ScriptedConversation: Sendable {
    public let lines: [String]
    public let wrapUp: String

    public init(lines: [String], wrapUp: String = "That's everything from me. Thanks so much, you'll hear from us soon.") {
        self.lines = lines
        self.wrapUp = wrapUp
    }

    public func nextLine(after transcript: [TranscriptLine]) -> NextLine {
        let said = Set(transcript.filter { $0.speaker == .interviewer }.map(\.text))
        guard let upcoming = lines.first(where: { !said.contains($0) }) else {
            return NextLine(say: wrapUp, kind: .wrapUp)
        }
        return NextLine(say: upcoming, kind: .question)
    }
}
