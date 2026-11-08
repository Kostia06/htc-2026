import RavenKit
import SwiftUI

/// Every company Raven has researched. Tap one for the facts, the questions people were asked, and a practice interview.
struct CompaniesView: View {
    @Environment(AppModel.self) private var app
    @State private var model: CompaniesModel?
    private let injectedService: (any CompanyService)?
    private let onPractice: (String) -> Void

    init(service: (any CompanyService)? = nil, onPractice: @escaping (String) -> Void = { _ in }) {
        injectedService = service
        self.onPractice = onPractice
    }

    var body: some View {
        NavigationStack {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.ground)
                .navigationTitle("Companies")
                .navigationDestination(for: String.self) { slug in
                    CompanyView(slug: slug, service: injectedService, onPractice: onPractice)
                }
        }
        .task {
            guard model == nil else { return }
            let model = CompaniesModel(service: injectedService ?? app.companyService)
            self.model = model
            await model.refresh()
        }
    }

    @ViewBuilder private var content: some View {
        if let model {
            ScrollView {
                LazyVStack(spacing: 12) {
                    if !model.hasLoaded, model.errorMessage == nil {
                        ForEach(0 ..< 4, id: \.self) { _ in SkeletonLines(widths: [0.5, 0.8]).ravenCard() }
                    } else if model.companies.isEmpty {
                        emptyState(model)
                    } else {
                        ForEach(model.companies) { company in
                            NavigationLink(value: company.slug) { CompanyRow(company: company) }
                                .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
                .animation(.spring(duration: 0.35), value: model.companies)
            }
            .refreshable { await model.refresh() }
        } else {
            ProgressView()
        }
    }

    private func emptyState(_ model: CompaniesModel) -> some View {
        ContentUnavailableView {
            Label(model.errorMessage == nil ? "Nothing researched yet" : "Couldn't load companies", systemImage: "building.2")
        } description: {
            Text(model.errorMessage ?? "Raven researches the companies on your roadmap overnight.")
        } actions: {
            Button("Try again") { Task { await model.refresh() } }
                .buttonStyle(.raised)
                .frame(maxWidth: 220)
        }
        .padding(.top, 80)
    }
}

private struct CompanyRow: View {
    let company: CompanySummary

    var body: some View {
        HStack(spacing: 14) {
            Text(String(company.name.prefix(1)))
                .font(.title3.bold())
                .frame(width: 44, height: 44)
                .background(Theme.action.opacity(0.18), in: .rect(cornerRadius: 12))
                .foregroundStyle(Theme.action)
            VStack(alignment: .leading, spacing: 4) {
                Text(company.name).font(.headline)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.footnote.bold()).foregroundStyle(.tertiary)
        }
        .ravenCard()
        .contentShape(.rect)
    }

    private var detail: String {
        guard let researched = RelativeTime.phrase(for: company.lastResearchedAt) else { return "Not researched yet" }
        var parts = [counted(company.factCount, "fact")]
        if company.reportedCount > 0 {
            parts.append(counted(company.reportedCount, "report"))
        }
        parts.append("Researched \(researched)")
        return parts.joined(separator: " · ")
    }

    private func counted(_ count: Int, _ noun: String) -> String {
        "\(count) \(noun)\(count == 1 ? "" : "s")"
    }
}
