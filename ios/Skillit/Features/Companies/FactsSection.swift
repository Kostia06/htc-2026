import SkillitKit
import SwiftUI

/// One kind of fact as short rows; tap a row to read all of it, tap the source to open it.
struct FactsSection: View {
    let kind: CompanyFact.Kind
    let facts: [CompanyFact]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(kind.title, systemImage: kind.symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.leading, 4)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(facts.enumerated()), id: \.element.id) { index, fact in
                    FactRow(fact: fact)
                    if index < facts.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.vertical, 10)
                    }
                }
            }
            .skillitCard()
        }
    }
}

private struct FactRow: View {
    let fact: CompanyFact
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(fact.text)
                .font(.subheadline)
                .lineLimit(isExpanded ? nil : 2)
            if let url = URL(string: fact.sourceURL), let host = url.host() {
                Link(host.replacingOccurrences(of: "www.", with: ""), destination: url)
                    .font(.caption)
                    .tint(.secondary)
                    .accessibilityLabel("Source: \(host)")
            }
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .contentShape(.rect)
        .onTapGesture {
            withAnimation(.snappy) { isExpanded.toggle() }
        }
    }
}
