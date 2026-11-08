import SkillitKit
import SwiftUI

/// Docked under Crossroads: the answer floats above a glass field (type, or tap the mic), like the app's Ask bar.
struct CrossroadsAskBar: View {
    let model: CrossroadsAskModel
    @FocusState private var isTyping: Bool

    var body: some View {
        VStack(spacing: 8) {
            answer
            ChatComposer(model: model, placeholder: CrossroadsAskModel.placeholder, isFocused: $isTyping)
                .glassEffect(.regular, in: .rect(cornerRadius: 24))
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 6)
        .animation(.spring(duration: 0.4), value: model.isThinking)
        .animation(.spring(duration: 0.4), value: model.reply)
    }

    @ViewBuilder private var answer: some View {
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
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "signpost.right.and.left.fill").foregroundStyle(Theme.agent)
                Text(reply).font(.subheadline).fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(Theme.raised, in: .rect(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Theme.agent.opacity(0.4)))
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .accessibilityLabel("Crossroads says: \(reply)")
        }
    }
}
