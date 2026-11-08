import Foundation

public enum AudioLevel {
    /// Maps a buffer's RMS amplitude to 0–1 on a decibel scale, so quiet speech still moves the bars.
    public static func normalized(rms: Float) -> Float {
        let decibels = 20 * log10(max(rms, 1e-7))
        return min(max((decibels - silence) / -silence, 0), 1)
    }

    private static let silence: Float = -50
}
