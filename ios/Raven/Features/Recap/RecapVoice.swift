import Foundation
import RavenKit

/// The spoken side of a recap. `start` connects with the provider credentials the server returned (`RecapVoiceStart.credentials`,
/// an ElevenLabs `{kind, signedUrl, overrides}`) and streams every recognised line, Raven's and the person's, as it happens.
/// The stream ends when the call is over or after `stop()`; the model then hands the transcript to the server.
///
/// Wiring note: the ElevenLabs engine lives in Features/Practice (`ElevenLabsVoiceEngine`). At merge, the parent adds a small adapter
/// that conforms it to this protocol and passes it to `RecapView`; until then `ScriptedRecapVoice.unavailable` stands in.
public protocol RecapVoice: AnyObject {
    func start(_ credentials: JSONValue) -> AsyncStream<RecapTranscriptLine>
    func stop()
}

/// Plays back a fixed transcript at a human pace. `unavailable` ends at once, which the model turns into a "type it instead" nudge.
public final class ScriptedRecapVoice: RecapVoice {
    private let lines: [RecapTranscriptLine]
    private let pace: Duration
    private var playback: Task<Void, Never>?

    public init(lines: [RecapTranscriptLine], pace: Duration = .seconds(1.6)) {
        self.lines = lines
        self.pace = pace
    }

    public static var unavailable: ScriptedRecapVoice {
        ScriptedRecapVoice(lines: [])
    }

    static var demo: ScriptedRecapVoice {
        ScriptedRecapVoice(lines: [
            .init(speaker: .raven, text: "How did your interview go? Tell me like you'd tell a friend."),
            .init(speaker: .user, text: "Pretty good I think. It was the technical round at ATB for the junior data analyst role."),
            .init(speaker: .user, text: "They asked me to explain a left join, then how I'd find a slow query. I froze on the second one."),
            .init(speaker: .raven, text: "That's a tough one to get cold. Thanks, I've got what I need."),
        ])
    }

    public func start(_: JSONValue) -> AsyncStream<RecapTranscriptLine> {
        let (stream, continuation) = AsyncStream.makeStream(of: RecapTranscriptLine.self)
        playback = Task { [lines, pace] in
            for line in lines {
                try? await Task.sleep(for: pace)
                guard !Task.isCancelled else { break }
                continuation.yield(line)
            }
            continuation.finish()
        }
        return stream
    }

    public func stop() {
        playback?.cancel()
        playback = nil
    }
}
