import SkillitKit
import SwiftUI

/// The resume's finished steps folded into one card, so the path starts where the person is now.
struct ResumeStepsCard: View {
    let steps: [RoadmapStep]
    let onSelect: (RoadmapStep) -> Void
    @State private var isOpen = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Button {
                withAnimation(.snappy) { isOpen.toggle() }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: "doc.text")
                        .font(.headline)
                        .foregroundStyle(Theme.positive)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("From your resume").font(.headline)
                        Text("\(steps.count) already done").font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "chevron.down")
                        .rotationEffect(.degrees(isOpen ? 180 : 0))
                        .foregroundStyle(.secondary)
                }
                .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityHint(isOpen ? "Hides them" : "Shows them")

            if isOpen {
                ForEach(steps) { step in
                    Button { onSelect(step) } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "checkmark").font(.caption.weight(.bold)).foregroundStyle(Theme.positive)
                            Text(step.title).font(.subheadline).multilineTextAlignment(.leading)
                            Spacer(minLength: 0)
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(16)
        .skillitCard()
    }
}
