import SkillitKit
import SwiftUI

/// Radar: the companies near you that Skillit keeps researching, one row each. Tap one for its page.
/// The parent refreshes the list when Radar is shown; this view only draws its states.
struct RadarList: View {
    @Environment(AppModel.self) private var app
    let onOpen: (String) -> Void

    private var model: CompaniesModel {
        app.companies
    }

    var body: some View {
        if !model.companies.isEmpty {
            ForEach(model.companies) { company in
                Button { onOpen(company.slug) } label: {
                    RadarRow(company: company)
                }
                .buttonStyle(.plain)
                .feedRow()
            }
        } else if let message = model.errorMessage {
            RadarUnavailable(message: message) { await model.refresh(using: app.companyService) }.feedRow()
        } else if !model.hasLoaded {
            ForEach(0 ..< 3, id: \.self) { _ in
                SkeletonLines(widths: [0.45, 0.7], highlighted: -1).skillitCard().feedRow()
            }
        } else {
            Text("No companies on your radar yet. Paste a job posting into Ask and its company shows up here.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(16)
                .feedRow()
        }
    }
}

private struct RadarUnavailable: View {
    let message: String
    let retry: () async -> Void

    var body: some View {
        ContentUnavailableView {
            Label("Can't load your radar", systemImage: "dot.radiowaves.left.and.right")
        } description: {
            Text(message)
        } actions: {
            Button("Try again") { Task { await retry() } }
                .buttonStyle(.raised)
                .frame(maxWidth: 220)
        }
        .padding(.top, 40)
    }
}

private struct RadarRow: View {
    let company: CompanySummary
    @ScaledMetric(relativeTo: .headline) private var monogramSize: CGFloat = 44

    var body: some View {
        HStack(spacing: 14) {
            Text(String(company.name.prefix(1)))
                .font(.headline)
                .frame(width: monogramSize, height: monogramSize)
                .background(Theme.chip, in: .rect(cornerRadius: 12))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(company.name).font(.headline)
                Text(counts).font(.subheadline).foregroundStyle(.secondary)
                if let researched {
                    Text(researched).font(.caption).foregroundStyle(.tertiary)
                }
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .skillitCard()
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }

    private var counts: String {
        guard company.factCount > 0 else { return "Not researched yet" }
        var parts = [plural(company.factCount, "fact")]
        if company.reportedCount > 0 {
            parts.append(plural(company.reportedCount, "interview report"))
        }
        return parts.joined(separator: " · ")
    }

    private var researched: String? {
        RelativeTime.phrase(for: company.lastResearchedAt).map { "Updated \($0)" }
    }

    private func plural(_ count: Int, _ noun: String) -> String {
        "\(count) \(noun)\(count == 1 ? "" : "s")"
    }
}
