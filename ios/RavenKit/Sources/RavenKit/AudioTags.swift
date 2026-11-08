import Foundation

public extension String {
    /// The line without ElevenLabs v3 expression tags such as `[laughs]` or `[warmly]`.
    /// Anything in square brackets goes; the whitespace it leaves is collapsed so the sentence reads normally.
    var withoutAudioTags: String {
        replacing(/\[[^\]]*\]/, with: "")
            .replacing(/\s+/, with: " ")
            .replacing(/\s+(?=[,.!?;:])/, with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
