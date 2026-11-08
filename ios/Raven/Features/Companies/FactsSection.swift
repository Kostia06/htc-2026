import RavenKit
import SwiftUI

/// One kind of fact, each with a chip that opens where it came from.
struct FactsSection: View {
    let kind: CompanyFact.Kind
    let facts: [CompanyFact]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(kind.title, systemImage: kind.symbol)
                .font(.headline)
                .foregroundStyle(.secondary)
                .padding(.leading, 4)
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(facts.enumerated()), id: \.element.id) { index, fact in
                    FactRow(fact: fact)
                    if index < facts.count - 1 {
                        Divider().overlay(Theme.hairline).padding(.vertical, 12)
                    }
                }
            }
            .ravenCard()
        }
    }
}

private struct FactRow: View {
    let fact: CompanyFact

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(fact.text).font(.body)
            if let url = URL(string: fact.sourceURL), let host = url.host() {
                Link(destination: url) {
                    Label(host.replacingOccurrences(of: "www.", with: ""), systemImage: "link")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(Theme.action)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Theme.action.opacity(0.12), in: .capsule)
                }
                .accessibilityLabel("Source: \(host)")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
