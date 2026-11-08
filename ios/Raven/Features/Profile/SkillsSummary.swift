import SwiftUI

/// Skills come from the resume and practice, so there's nothing to type here: a few chips, the rest one tap away.
/// Long-press a chip to remove it.
struct SkillsSummary: View {
    let skills: [String]
    let onRemove: (String) -> Void

    @State private var showsAll = false
    private static let visibleCount = 8

    var body: some View {
        if skills.isEmpty {
            Text("Raven picks these up from your resume and practice.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        } else {
            VStack(alignment: .leading, spacing: 12) {
                FlowLayout(spacing: 8) {
                    ForEach(visible, id: \.self) { skill in
                        Text(skill)
                            .font(.subheadline)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color(white: 0.16), in: .capsule)
                            .contextMenu {
                                Button("Remove", systemImage: "minus.circle", role: .destructive) { onRemove(skill) }
                            }
                    }
                }
                if skills.count > Self.visibleCount {
                    Button(showsAll ? "Show fewer" : "Show all \(skills.count)") {
                        withAnimation(.snappy) { showsAll.toggle() }
                    }
                    .font(.subheadline.weight(.semibold))
                    .tint(Theme.action)
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var visible: [String] {
        showsAll ? skills : Array(skills.prefix(Self.visibleCount))
    }
}
