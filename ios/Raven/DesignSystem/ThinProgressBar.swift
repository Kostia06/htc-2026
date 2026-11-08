import SwiftUI

/// A 4-point capsule track with an accent fill, for progress that should be felt rather than read.
struct ThinProgressBar: View {
    let fraction: Double
    var tint: Color = Theme.action

    var body: some View {
        Capsule()
            .fill(Theme.chip)
            .frame(height: 4)
            .overlay {
                // scaled rather than measured, so the bar needs no geometry reader
                Capsule()
                    .fill(tint)
                    .scaleEffect(x: max(min(fraction, 1), 0.02), anchor: .leading)
            }
            .accessibilityElement()
            .accessibilityLabel("Progress")
            .accessibilityValue(Text(fraction, format: .percent.precision(.fractionLength(0))))
    }
}
