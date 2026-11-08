import SkillitKit
import SwiftUI

/// Everything Skillit read from one posting: the facts, what the person has and lacks, what was set up from it,
/// and the one way forward: a practice interview built on this posting.
struct PostingView: View {
    @Environment(AppModel.self) private var app
    @State private var session: VoiceSessionModel?
    @State private var company: CompanyLink?

    let posting: JobPosting

    var body: some View {
        DetailSheet {
            Text(posting.title)
                .font(.title2.bold())
                .fixedSize(horizontal: false, vertical: true)
            companyLine
            FactGrid(facts: facts)
            requirements
            if !posting.responsibilities.isEmpty {
                section("You'd be doing") {
                    ForEach(posting.responsibilities, id: \.self) { line in
                        Text(line).font(.subheadline)
                    }
                }
            }
            if !posting.prefilled.isEmpty {
                section("Skillit filled in") {
                    ForEach(posting.prefilled.appliedChanges) { change in
                        Label(change.summary, systemImage: "checkmark")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        } footer: {
            Button("Practice this interview", action: practice)
                .buttonStyle(.raised)
        }
        .fullScreenCover(item: $session) { session in
            VoiceSessionView(model: session, onPracticeAgain: practice)
        }
        .sheet(item: $company) { link in
            CompanySheet(slug: link.slug)
        }
    }

    @ViewBuilder private var companyLine: some View {
        if let slug = posting.companySlug {
            Button {
                company = CompanyLink(slug: slug)
            } label: {
                Label(posting.company, systemImage: "building.2")
                    .font(.subheadline.weight(.semibold))
            }
            .tint(Theme.action)
        } else {
            Text(posting.company)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var facts: [FactGrid.Fact] {
        let tint: Color = posting.haveCount > 0 ? Theme.positive : .primary
        var facts = [FactGrid.Fact(label: "You have", value: posting.requirementsLine, tint: tint)]
        if let location = posting.location {
            facts.append(.init(label: "Where", value: location))
        }
        if let seniority = posting.seniority {
            facts.append(.init(label: "Level", value: seniority))
        }
        return facts
    }

    @ViewBuilder private var requirements: some View {
        if !posting.requirements.isEmpty {
            section("Requirements") {
                ForEach(posting.requirements) { requirement in
                    RequirementRow(requirement: requirement)
                }
            }
        }
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            content()
        }
    }

    private func practice() {
        session = app.voiceSession(VoiceSessionRequest(mode: .interview, difficulty: .preferred, postingId: posting.id))
    }
}

/// One ask of the posting: a check for what the person already has, a quiet circle for what's missing.
private struct RequirementRow: View {
    let requirement: PostingRequirement

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: requirement.have ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(requirement.have ? Theme.positive : .secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text(requirement.text)
                    .font(.subheadline)
                    .foregroundStyle(requirement.have ? .primary : .secondary)
                if !requirement.required {
                    Text("Nice to have")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(requirement.text), \(requirement.have ? "you have it" : "missing")")
    }
}

#if DEBUG
#Preview {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            PostingView(posting: .sample)
        }
        .environment(AppModel.preview(profile: .empty))
}
#endif
