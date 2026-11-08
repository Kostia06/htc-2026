import RavenKit
import SwiftUI

/// One job in the Experience card. Tapping opens the editor.
struct ExperienceRow: View {
    let row: Profile.Experience
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 3) {
                Text(row.role).font(.headline)
                Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Edit")
    }

    private var subtitle: String {
        let dates = [row.start, row.end].compactMap(\.self).joined(separator: " to ")
        return dates.isEmpty ? row.org : "\(row.org) · \(dates)"
    }
}

/// One school in the Education card. Tapping opens the editor.
struct EducationRow: View {
    let row: Profile.Education
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 3) {
                Text(row.school).font(.headline)
                if !subtitle.isEmpty {
                    Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Edit")
    }

    private var subtitle: String {
        [row.program, row.year, row.expectedGraduation.map { "Graduating \($0)" }].compactMap(\.self).joined(separator: " · ")
    }
}

/// The last row of a card: a quiet orange "Add".
struct AddRowButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: "plus")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.action)
        }
    }
}

/// A small check that appears over the bottom of the screen when a save lands, then fades out on its own.
struct SavedFlash: View {
    let count: Int
    @State private var isShowing = false

    var body: some View {
        Group {
            if isShowing {
                Label("Saved", systemImage: "checkmark.circle.fill")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Theme.raised, in: .capsule)
                    .overlay(Capsule().strokeBorder(Theme.hairline))
                    .padding(.bottom, 12)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.35), value: isShowing)
        .task(id: count) {
            guard count > 0 else { return }
            isShowing = true
            try? await Task.sleep(for: .seconds(1.4))
            isShowing = false
        }
        .allowsHitTesting(false)
    }
}
