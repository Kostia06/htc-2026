import SkillitKit
import SwiftUI

/// The code in big spaced digits inside a ring that empties as the code runs out.
struct CodeCountdownRing: View {
    let code: HeadsetCode
    /// how long a code lives on the server; used to turn the time left into a fraction
    private let lifetime: TimeInterval = 120

    @ScaledMetric(relativeTo: .largeTitle) private var scaledDigitSize: CGFloat = 64
    @ScaledMetric(relativeTo: .largeTitle) private var scaledDiameter: CGFloat = 272

    /// Past this the ring is wider than a phone at accessibility text sizes; the digits are already huge by then.
    private var diameter: CGFloat { min(scaledDiameter, 300) }
    private var digitSize: CGFloat { min(scaledDigitSize, 72) }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let remaining = max(0, code.expiresAt.timeIntervalSince(context.date))
            ZStack {
                Circle()
                    .stroke(Theme.hairline, lineWidth: 8)
                Circle()
                    .trim(from: 0, to: min(1, remaining / lifetime))
                    .stroke(Theme.action, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1), value: remaining)
                VStack(spacing: 8) {
                    // one Text per digit: spacing between them keeps the code centred, where tracking would trail
                    HStack(spacing: digitSize * 0.2) {
                        ForEach(Array(code.digits.enumerated()), id: \.offset) { _, digit in
                            Text(String(digit))
                        }
                    }
                    .font(.system(size: digitSize, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .lineLimit(1)
                    .contentTransition(.numericText())
                    Text(Duration.seconds(remaining.rounded(.up)), format: .time(pattern: .minuteSecond))
                        .font(.subheadline.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                .minimumScaleFactor(0.5)
                .padding(20)
            }
            .frame(width: diameter, height: diameter)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Code \(code.digits.map(String.init).joined(separator: " "))")
    }
}
