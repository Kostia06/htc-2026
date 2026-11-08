import SwiftUI

/// Skills mostly come from the resume and practice, so the section stays compact: a few chips, the rest one tap away.
/// Changes happen in the skills editor, opened from the section's Edit button.
struct SkillsSummary: View {
    let skills: [String]
    /// Why the last save didn't land; the list has already rolled back.
    let failure: String?

    @State private var showsAll = false
    private static let visibleCount = 8

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if skills.isEmpty {
                Text("Skillit picks these up from your resume and practice. Tap Edit to add your own.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                FlowLayout(spacing: 8) {
                    ForEach(visible, id: \.self) { skill in
                        Text(skill)
                            .font(.subheadline)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Theme.chip, in: .capsule)
                    }
                }
                if skills.count > Self.visibleCount {
                    Button(showsAll ? "Show fewer" : "Show all \(skills.count)") {
                        withAnimation(.snappy) { showsAll.toggle() }
                    }
                    .font(.subheadline.weight(.semibold))
                    .tint(Theme.action)
                    .frame(minHeight: 44)
                }
            }
            if let failure {
                Label("Couldn't save your skills. \(failure)", systemImage: "exclamationmark.circle")
                    .font(.subheadline)
                    .foregroundStyle(Theme.negative)
            }
        }
        .padding(.vertical, 4)
    }

    private var visible: [String] {
        showsAll ? skills : Array(skills.prefix(Self.visibleCount))
    }
}

/// The Skills section's header: its name, and the way into the editor.
struct SkillsHeader: View {
    let onEdit: () -> Void

    var body: some View {
        HStack {
            Text("Skills")
            Spacer()
            Button("Edit", action: onEdit)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.action)
                .textCase(nil)
                .frame(minHeight: 44)
                .accessibilityLabel("Edit skills")
        }
    }
}
