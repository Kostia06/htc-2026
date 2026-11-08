import RavenKit
import SwiftUI

/// One chat line: Raven on the left in a raised card, the person on the right in orange.
struct RecapBubble: View {
    let message: RecapModel.Message

    private var isRaven: Bool {
        message.role == .raven
    }

    var body: some View {
        HStack {
            if !isRaven {
                Spacer(minLength: 48)
            }
            Text(message.text)
                .font(.body)
                .foregroundStyle(isRaven ? Color.primary : Theme.onAction)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(isRaven ? Theme.raised : Theme.action, in: .rect(cornerRadius: 20))
                .overlay {
                    if isRaven {
                        RoundedRectangle(cornerRadius: 20).strokeBorder(Theme.hairline)
                    }
                }
            if isRaven {
                Spacer(minLength: 48)
            }
        }
        .frame(maxWidth: .infinity, alignment: isRaven ? .leading : .trailing)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(isRaven ? "Raven" : "You"): \(message.text)")
    }
}

/// Three purple dots that breathe while Raven reads what was said. Holds still with Reduce Motion.
struct TypingIndicator: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            HStack(spacing: 6) {
                ForEach(0 ..< 3) { index in
                    Circle()
                        .fill(Theme.agent)
                        .frame(width: 8, height: 8)
                        .opacity(reduceMotion ? 0.8 : 0.35 + 0.65 * (0.5 + 0.5 * sin(time * 4 - Double(index) * 0.9)))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Theme.raised, in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Theme.hairline))
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityLabel("Raven is thinking")
    }
}
