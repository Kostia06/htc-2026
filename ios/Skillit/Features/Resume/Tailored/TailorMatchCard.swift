import SkillitKit
import SwiftUI

/// The number the person opened this for: how much of the posting the tailored resume now shows, and what it can't.
struct TailorMatchCard: View {
    let match: TailorMatch

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text("\(match.covered.count) of \(match.total)")
                    .font(.largeTitle.bold().monospacedDigit())
                    .contentTransition(.numericText())
                Text(beforeLine)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if !match.covered.isEmpty {
                requirements("Shown on your resume", match.covered, symbol: "checkmark.circle.fill", isCovered: true)
            }
            if !match.missing.isEmpty {
                requirements("Still missing", match.missing, symbol: "circle", isCovered: false)
                Text("Skillit won't add what your resume and profile don't already show. Build these up on your roadmap.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .skillitCard()
    }

    private var beforeLine: String {
        guard match.total > 0 else { return "The posting listed no requirements" }
        return match.coveredBefore == match.covered.count
            ? "requirements shown, same as your base resume"
            : "requirements shown, up from \(match.coveredBefore)"
    }

    private func requirements(_ title: String, _ items: [TailorMatch.Requirement], symbol: String, isCovered: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            ForEach(items, id: \.self) { item in
                Label {
                    Text(item.required ? item.text : "\(item.text) (nice to have)")
                        .font(.subheadline)
                } icon: {
                    Image(systemName: symbol)
                        .foregroundStyle(isCovered ? Theme.positive : Color.secondary)
                }
                .accessibilityLabel("\(item.text), \(isCovered ? "shown" : "missing")")
            }
        }
    }
}

#if DEBUG
#Preview {
    TailorMatchCard(match: SampleTailoredResumes.tailored.match)
        .padding()
        .background(Theme.ground)
}
#endif
