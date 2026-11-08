import SwiftUI

/// The optional onboarding step after the resume: connect GitHub, review a LinkedIn PDF, or move on.
struct AccountsStep: View {
    @State private var github = GithubConnectModel()
    @State private var isReviewingLinkedin = false
    let next: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            GithubConnectRow(model: github)
                .padding(16)
                .background(Theme.raised, in: .rect(cornerRadius: 16))
            Button { isReviewingLinkedin = true } label: {
                Label {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Review my LinkedIn")
                        Text("From LinkedIn's Save to PDF").font(.footnote).foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "person.text.rectangle").foregroundStyle(Theme.action)
                }
            }
            .buttonStyle(OptionButtonStyle(isSelected: false))
            Button(github.isConnected ? "Continue" : "Skip for now", action: next)
                .buttonStyle(.raised)
                .padding(.top, 12)
        }
        .sheet(isPresented: $isReviewingLinkedin) { LinkedinReviewView() }
    }
}
