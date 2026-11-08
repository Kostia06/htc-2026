import SwiftUI

/// A tiny line of session scores over time, drawn in once when it appears. Scores are out of 100, like the report.
struct ScoreSparkline: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drawn: CGFloat = 0

    let scores: [Double]
    var color: Color = Theme.action

    private static let range: ClosedRange<Double> = 0 ... 100

    var body: some View {
        GeometryReader { proxy in
            let points = points(in: proxy.size)
            ZStack {
                line(through: points)
                    .trim(from: 0, to: drawn)
                    .stroke(color, style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                if let last = points.last {
                    Circle()
                        .fill(color)
                        .frame(width: 8, height: 8)
                        .position(last)
                        .opacity(drawn == 1 ? 1 : 0)
                }
            }
        }
        .onAppear {
            if reduceMotion {
                drawn = 1
            } else {
                withAnimation(.easeOut(duration: 0.8)) { drawn = 1 }
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Score trend")
        .accessibilityValue(scores.map { $0.formatted(.number.precision(.fractionLength(0))) }.joined(separator: ", "))
    }

    private func points(in size: CGSize) -> [CGPoint] {
        guard scores.count > 1 else {
            return scores.map { CGPoint(x: size.width / 2, y: y(for: $0, in: size)) }
        }
        let step = size.width / CGFloat(scores.count - 1)
        return scores.enumerated().map { index, score in CGPoint(x: CGFloat(index) * step, y: y(for: score, in: size)) }
    }

    private func y(for score: Double, in size: CGSize) -> CGFloat {
        let clamped = min(max(score, Self.range.lowerBound), Self.range.upperBound)
        let unit = (clamped - Self.range.lowerBound) / (Self.range.upperBound - Self.range.lowerBound)
        // leave room for the stroke and the end dot at both edges
        return 4 + (size.height - 8) * (1 - unit)
    }

    private func line(through points: [CGPoint]) -> Path {
        var path = Path()
        guard let first = points.first else { return path }
        path.move(to: first)
        for (previous, next) in zip(points, points.dropFirst()) {
            let midX = (previous.x + next.x) / 2
            path.addCurve(to: next, control1: CGPoint(x: midX, y: previous.y), control2: CGPoint(x: midX, y: next.y))
        }
        return path
    }
}
