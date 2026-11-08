import RavenKit
import SwiftUI

/// Radar: the companies near you that Skillit keeps researching, one row each. Tap one for its page.
struct RadarList: View {
    @Environment(AppModel.self) private var app
    let onOpen: (String) -> Void

    var body: some View {
        if app.companies.companies.isEmpty {
            Text("No companies on your radar yet. Paste a job posting into Ask and its company shows up here.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(16)
                .feedRow()
        } else {
            ForEach(app.companies.companies) { company in
                Button { onOpen(company.slug) } label: {
                    RadarRow(company: company)
                }
                .buttonStyle(.plain)
                .feedRow()
            }
        }
    }
}

private struct RadarRow: View {
    let company: CompanySummary

    var body: some View {
        HStack(spacing: 14) {
            Text(String(company.name.prefix(1)))
                .font(.headline)
                .frame(width: 44, height: 44)
                .background(Theme.chip, in: .rect(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 3) {
                Text(company.name).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(16)
        .ravenCard()
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
    }

    private var detail: String {
        var parts = ["\(company.factCount) facts"]
        if company.reportedCount > 0 {
            parts.append("\(company.reportedCount) interview reports")
        }
        return parts.joined(separator: " · ")
    }
}
