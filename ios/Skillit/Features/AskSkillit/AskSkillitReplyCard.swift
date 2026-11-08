import SkillitKit
import SwiftUI

/// Skillit's answer, floating above the bar: the one line, what it changed, the posting it read, or its one question.
struct AskSkillitReplyCard: View {
    let model: QuickUpdateModel
    let onOpenPosting: (JobPosting) -> Void

    var body: some View {
        Group {
            if model.isThinking {
                TypingIndicator()
            } else if model.lastReply != nil || model.error != nil {
                BoundedScroll(maxHeight: 240) { content }
                    .background(Theme.raised, in: .rect(cornerRadius: 20))
                    .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Theme.hairline))
            }
        }
        .animation(.spring(duration: 0.4), value: model.isThinking)
        .animation(.spring(duration: 0.4), value: model.messages)
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let reply = model.lastReply {
                Text(reply.text)
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
                if let posting = model.postingAfter[reply.id] {
                    PostingCard(posting: posting) { onOpenPosting(posting) }
                }
                if let changes = model.appliedAfter[reply.id] {
                    VStack(alignment: .leading, spacing: 6) {
                        ForEach(changes) { change in
                            Label {
                                Text(change.summary).foregroundStyle(.secondary)
                            } icon: {
                                Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.positive)
                            }
                            .font(.footnote)
                        }
                    }
                }
            }
            if let error = model.error {
                Label(error, systemImage: "exclamationmark.circle")
                    .font(.footnote)
                    .foregroundStyle(Theme.negative)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        // contain, not combine: combining would swallow the posting card's button for VoiceOver
        .accessibilityElement(children: .contain)
    }
}

/// Hugs its content until `maxHeight`, then scrolls, so a long reply or a posting card can't push the bar off screen
/// when the keyboard is up.
private struct BoundedScroll<Content: View>: View {
    let maxHeight: CGFloat
    @ViewBuilder let content: Content

    @State private var contentHeight: CGFloat = 0

    var body: some View {
        ScrollView {
            content
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
        }
        .scrollBounceBehavior(.basedOnSize)
        .frame(height: min(max(contentHeight, 1), maxHeight))
        .clipShape(.rect(cornerRadius: 20))
    }
}
