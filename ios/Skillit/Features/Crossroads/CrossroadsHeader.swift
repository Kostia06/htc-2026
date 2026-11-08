import SkillitKit
import SwiftUI

/// What this screen is, in one sentence, then the privacy promise in small print.
struct RoadHeader: View {
    let goal: String
    let minPeople: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("What people on the road to \(Text(goal).foregroundStyle(Theme.action)) learned, and where you match.")
                .font(.title3.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Image(systemName: "lock.fill").accessibilityHidden(true)
                Text("Only you see your notes. Counts show once \(minPeople) people share something.")
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// Three short steps on a first visit, then gone for good once dismissed.
struct CrossroadsExplainer: View {
    let goal: String
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text("How Crossroads works").font(.headline)
                Spacer()
                Button("Dismiss", systemImage: "xmark", action: onDismiss)
                    .labelStyle(.iconOnly)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(.rect)
            }
            step(1, "lock.fill", "Your notes stay private", "What you practise and finish is saved for you only.")
            step(2, "person.3.fill", "We match them to people like you", "Others heading to \(goal) shared what happened.")
            step(3, "hand.tap.fill", "Act on what fits", "Say \u{201C}That's me too\u{201D}, add a tip to your road, or ask below.")
            Button("Got it", action: onDismiss)
                .buttonStyle(.raised)
        }
        .padding(16)
        .background(Theme.raised, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Theme.agent.opacity(0.35)))
    }

    private func step(_ number: Int, _ symbol: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.onAction)
                .frame(width: 32, height: 32)
                .background(Theme.action, in: .circle)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(detail).font(.footnote).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(number): \(title). \(detail)")
    }
}
