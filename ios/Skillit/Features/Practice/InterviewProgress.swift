import SwiftUI

/// "Question 2 of 6" over a thin bar, so the person knows how much interview is left.
struct InterviewProgress: View {
    /// Nil until the interviewer reaches the first planned question.
    let number: Int?
    let total: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .contentTransition(.numericText())
            ThinProgressBar(fraction: Double(number ?? 0) / Double(max(total, 1)))
        }
        .animation(.spring(duration: 0.5, bounce: 0.1), value: number)
        .accessibilityElement(children: .combine)
    }

    private var label: String {
        if let number {
            "Question \(number) of \(total)"
        } else {
            "\(total) questions"
        }
    }
}
