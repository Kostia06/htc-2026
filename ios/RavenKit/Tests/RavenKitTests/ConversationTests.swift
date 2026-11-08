import Foundation
@testable import RavenKit
import Testing

struct TurnDetectorTests {
    @Test func `ends the turn 700 ms after the person stops talking`() {
        var detector = TurnDetector()
        detector.hearWords(at: .seconds(1))
        detector.hear(level: 0.6, at: .milliseconds(1500))
        #expect(!detector.isFinished(at: .milliseconds(2100)))
        #expect(detector.isFinished(at: .milliseconds(2200)))
    }

    @Test func `noise before any words never ends the turn early`() {
        var detector = TurnDetector()
        detector.hear(level: 0.9, at: .milliseconds(200))
        #expect(!detector.isFinished(at: .seconds(3)))
        #expect(detector.isFinished(at: .seconds(15)))
    }

    @Test func `a long answer is cut off eventually`() {
        var detector = TurnDetector(longest: .seconds(10))
        detector.hearWords(at: .milliseconds(9900))
        #expect(detector.isFinished(at: .seconds(10)))
    }

    @Test func `two words cut in, one does not`() {
        #expect(!TurnDetector.isInterruption("um"))
        #expect(TurnDetector.isInterruption("sorry, I"))
    }
}

struct VoiceRankingTests {
    @Test func `prefers premium, then enhanced, then the US accent`() {
        let voices = [
            VoiceCandidate(identifier: "compact-us", language: "en-US", quality: .compact),
            VoiceCandidate(identifier: "enhanced-gb", language: "en-GB", quality: .enhanced),
            VoiceCandidate(identifier: "enhanced-us", language: "en-US", quality: .enhanced),
            VoiceCandidate(identifier: "premium-fr", language: "fr-FR", quality: .premium),
            VoiceCandidate(identifier: "novelty", language: "en-US", quality: .premium, isNovelty: true),
        ]
        #expect(VoiceRanking.best(of: voices)?.identifier == "enhanced-us")
        let withPremium = voices + [VoiceCandidate(identifier: "premium-au", language: "en-AU", quality: .premium)]
        #expect(VoiceRanking.best(of: withPremium)?.identifier == "premium-au")
    }

    @Test func `suggests a download only when every English voice is compact`() {
        #expect(VoiceRanking.shouldSuggestDownload(for: VoiceCandidate(identifier: "a", language: "en-US", quality: .compact)))
        #expect(VoiceRanking.shouldSuggestDownload(for: nil))
        #expect(!VoiceRanking.shouldSuggestDownload(for: VoiceCandidate(identifier: "b", language: "en-US", quality: .enhanced)))
    }
}

struct ScriptedConversationTests {
    @Test func `asks each planned line once, then says goodbye`() {
        let script = ScriptedConversation(lines: ["Q1", "Q2"], wrapUp: "Bye")
        var transcript = [TranscriptLine(speaker: .interviewer, text: "Hi"), TranscriptLine(speaker: .candidate, text: "Hey")]
        #expect(script.nextLine(after: transcript) == NextLine(say: "Q1", kind: .question))
        transcript += [TranscriptLine(speaker: .interviewer, text: "Q1"), TranscriptLine(speaker: .candidate, text: "Q2")]
        #expect(script.nextLine(after: transcript) == NextLine(say: "Q2", kind: .question))
        transcript.append(TranscriptLine(speaker: .interviewer, text: "Q2"))
        #expect(script.nextLine(after: transcript) == NextLine(say: "Bye", kind: .wrapUp))
    }
}

extension StubbedNetworkTests {
    struct NextLineTests {
        @Test func `sends the transcript and reads a follow-up`() async throws {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [StubProtocol.self]
            let client = try RavenClient(
                baseURL: #require(URL(string: "https://api.test")),
                accessToken: { "t0k" },
                session: URLSession(configuration: configuration),
            )
            StubProtocol.routes.withLock {
                $0["POST /api/voice/sessions/vs_1/next"] = (200, #"{"say":"What was your part?","kind":"follow_up"}"#)
            }
            let transcript = [
                TranscriptLine(speaker: .interviewer, text: "Tell me about Starfish."),
                TranscriptLine(speaker: .candidate, text: "I did research."),
            ]
            let line = try await client.nextLine(after: "I did research.", transcript: transcript, in: "vs_1")

            #expect(line == NextLine(say: "What was your part?", kind: .followUp))
            let body = try #require(StubProtocol.bodies.withLock { $0["POST /api/voice/sessions/vs_1/next"] })
            let sent = try #require(JSONSerialization.jsonObject(with: body) as? [String: Any])
            #expect(sent["answer"] as? String == "I did research.")
            #expect((sent["transcript"] as? [[String: String]])?.first?["speaker"] == "interviewer")
        }
    }
}
