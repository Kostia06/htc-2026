import SwiftUI

/// The shape every detail sheet shares: scrolling content with the primary action pinned under it.
struct DetailSheet<Content: View, Footer: View>: View {
    @ViewBuilder let content: Content
    @ViewBuilder let footer: Footer

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    content
                }
                .padding(.horizontal, 24)
                .padding(.top, 28)
                .padding(.bottom, 16)
            }
            footer
                .padding(.horizontal, 24)
                .padding(.bottom, 12)
        }
        .presentationDetents([.fraction(0.75), .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Theme.ground)
    }
}

/// Short facts as a two-column grid: a quiet label over each value, nothing wraps past one line.
struct FactGrid: View {
    struct Fact: Identifiable {
        let label: String
        let value: String
        var tint: Color = .primary

        var id: String {
            label
        }
    }

    let facts: [Fact]

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)], spacing: 14) {
            ForEach(facts) { fact in
                VStack(alignment: .leading, spacing: 2) {
                    Text(fact.label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(fact.value)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(fact.tint)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}

/// Body text that starts at a few lines and opens fully on "More".
struct ExpandableText: View {
    let text: String
    var lineLimit = 3
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(text)
                .font(.body)
                .lineSpacing(3)
                .lineLimit(isExpanded ? nil : lineLimit)
                .fixedSize(horizontal: false, vertical: true)
            if needsToggle {
                Button(isExpanded ? "Less" : "More") {
                    withAnimation(.snappy) { isExpanded.toggle() }
                }
                .font(.subheadline.weight(.semibold))
                .tint(Theme.action)
                .frame(minHeight: 44)
            }
        }
    }

    /// Rough but cheap: a line of body text holds about 45 characters at phone width.
    private var needsToggle: Bool {
        text.count > lineLimit * 45
    }
}
