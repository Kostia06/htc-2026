import SkillitKit
import SwiftUI

/// Docked under Crossroads: one glass field (type, or tap the mic), lifted clear of the floating tab bar.
/// The answer lands at the top of the list (`CrossroadsAnswerCard`), never floating over the cards.
struct CrossroadsAskBar: View {
    let model: CrossroadsAskModel
    @FocusState private var isTyping: Bool

    var body: some View {
        ChatComposer(model: model, placeholder: CrossroadsAskModel.placeholder, isFocused: $isTyping)
            .glassEffect(.regular, in: .rect(cornerRadius: 24))
            .padding(.horizontal, 12)
            .padding(.bottom, 6)
            .clearsFloatingBar()
    }
}

/// The latest answer, as the first row of the list: it scrolls with the cards it cites instead of covering them.
struct CrossroadsAnswerCard: View {
    let model: CrossroadsAskModel

    var body: some View {
        if model.isThinking {
            TypingIndicator().frame(maxWidth: .infinity, alignment: .leading)
        } else if let error = model.error {
            Label(error, systemImage: "exclamationmark.circle")
                .font(.footnote)
                .foregroundStyle(Theme.negative)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Theme.raised, in: .rect(cornerRadius: 16))
        } else if let reply = model.reply {
            answer(reply)
        }
    }

    private func answer(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "signpost.right.and.left.fill").foregroundStyle(Theme.agent)
            Text(text).font(.subheadline).fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button("Dismiss", systemImage: "xmark") { model.clearReply() }
                .labelStyle(.iconOnly)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
                .buttonStyle(.plain)
        }
        .padding(14)
        .background(Theme.raised, in: .rect(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Theme.agent.opacity(0.4)))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Crossroads says: \(text)")
    }
}
