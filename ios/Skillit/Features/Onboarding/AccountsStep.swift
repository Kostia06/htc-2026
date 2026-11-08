import SwiftUI

/// The optional onboarding step after the resume: bring work from any service, review a LinkedIn PDF, or skip it all.
struct AccountsStep: View {
    @State private var work = WorkConnectionsModel()
    @State private var isReviewingLinkedin = false
    let next: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 12) {
                BringYourWorkList(model: work)
            }
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
            // every row is optional and so is the whole step
            Button(work.hasAnyConnected ? "Continue" : "Skip for now", action: next)
                .buttonStyle(.raised)
                .padding(.top, 12)
        }
        .sheet(isPresented: $isReviewingLinkedin) { LinkedinReviewView() }
    }
}
