import Foundation

/// An installed text-to-speech voice, reduced to what matters for picking one.
public struct VoiceCandidate: Equatable, Sendable {
    public enum Quality: Int, Comparable, Sendable {
        case compact = 1, enhanced, premium

        public static func < (lhs: Quality, rhs: Quality) -> Bool {
            lhs.rawValue < rhs.rawValue
        }
    }

    public let identifier: String
    public let language: String
    public let quality: Quality
    /// Novelty and personal voices are never a sensible interviewer.
    public let isNovelty: Bool

    public init(identifier: String, language: String, quality: Quality, isNovelty: Bool = false) {
        self.identifier = identifier
        self.language = language
        self.quality = quality
        self.isNovelty = isNovelty
    }
}

public enum VoiceRanking {
    /// The most natural English voice installed: premium over enhanced over compact, then the preferred accent.
    public static func best(of candidates: [VoiceCandidate], preferring language: String = "en-US") -> VoiceCandidate? {
        candidates
            .filter { $0.language.hasPrefix("en") && !$0.isNovelty }
            .max { lhs, rhs in
                if lhs.quality != rhs.quality {
                    return lhs.quality < rhs.quality
                }
                return lhs.language != language && rhs.language == language
            }
    }

    /// Compact voices are the robotic ones; worth one line pointing at the free download.
    public static func shouldSuggestDownload(for voice: VoiceCandidate?) -> Bool {
        (voice?.quality ?? .compact) == .compact
    }
}
