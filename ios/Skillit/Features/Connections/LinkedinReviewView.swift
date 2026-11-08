import SkillitKit
import SwiftUI
import UniformTypeIdentifiers

/// "Review my LinkedIn": the person brings LinkedIn's own PDF export, Skillit reads it once (keeping nothing) and lists
/// edits, each quoting the line it's about. Shown as a sheet from the Resume door and from onboarding.
struct LinkedinReviewView: View {
    enum Phase: Equatable {
        case choosing
        case reading
        case done(LinkedinReview)
        case failed(String)
    }

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var phase = Phase.choosing
    @State private var isPicking = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    content
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(Theme.ground)
            .navigationTitle("Review my LinkedIn")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .fileImporter(isPresented: $isPicking, allowedContentTypes: [.pdf]) { result in
                guard case let .success(url) = result else { return }
                read(url)
            }
        }
    }

    @ViewBuilder private var content: some View {
        switch phase {
        case .choosing:
            intro
        case .reading:
            HStack(spacing: 12) {
                ProgressView()
                Text("Skillit is reading your profile…").foregroundStyle(.secondary)
            }
            .padding(.top, 40)
        case let .failed(message):
            intro
            Label(message, systemImage: "exclamationmark.triangle")
                .font(.footnote)
                .foregroundStyle(Theme.negative)
        case let .done(review):
            LinkedinSuggestionsList(review: review)
            Button("Review another PDF") { isPicking = true }
                .font(.footnote)
                .tint(.secondary)
        }
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Get specific edits for your headline, About, skills and experience, aimed at the role you want.")
                .font(.body)
            Text("On LinkedIn, open your profile, tap More, then Save to PDF. Choose that file here.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Button {
                isPicking = true
            } label: {
                Label("Choose LinkedIn PDF", systemImage: "doc.badge.arrow.up")
            }
            .buttonStyle(.raised)
            Label("Skillit reads the file once and keeps nothing. Emails, phone numbers and links are removed first.", systemImage: "lock")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private func read(_ url: URL) {
        guard let client = app.client else { return }
        guard let file = OnboardingModel.load(url) else {
            phase = .failed("Couldn't open that file. Try saving the PDF from LinkedIn again.")
            return
        }
        phase = .reading
        Task {
            do throws(SkillitError) {
                phase = try await .done(client.reviewLinkedin(file))
            } catch {
                phase = .failed(error.message)
            }
        }
    }
}

private struct LinkedinSuggestionsList: View {
    let review: LinkedinReview

    var body: some View {
        if review.suggestions.isEmpty {
            Text("Nothing to change that Skillit could point to in your profile. Nice work.")
                .foregroundStyle(.secondary)
        } else {
            if let role = review.targetRole {
                Text("For \(role)").font(.footnote.weight(.semibold)).foregroundStyle(Theme.agent)
            }
            ForEach(review.suggestions) { suggestion in
                VStack(alignment: .leading, spacing: 8) {
                    Text(title(suggestion.area)).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    Text("“\(suggestion.quote)”").font(.footnote).foregroundStyle(.secondary).lineLimit(3)
                    Text(suggestion.suggestion).font(.body)
                    Text(suggestion.why).font(.footnote).foregroundStyle(.secondary)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.raised, in: .rect(cornerRadius: 16))
                .textSelection(.enabled)
            }
        }
    }

    private func title(_ area: LinkedinArea) -> String {
        switch area {
        case .headline: "Headline"
        case .about: "About"
        case .skills: "Skills"
        case .experience: "Experience"
        }
    }
}
