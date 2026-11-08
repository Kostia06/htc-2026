import SwiftUI

/// What a chat sheet shows before anyone has said anything: what Skillit wants to hear, in big type,
/// and a few ways to start that fill the field instead of a blank screen with one small bubble.
struct ChatIntro: View {
    let symbol: String
    let title: String
    let message: String
    var starters: [String] = []
    let onStarter: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Image(systemName: symbol)
                .font(.title2.weight(.semibold))
                .foregroundStyle(Theme.agent)
                .frame(width: 56, height: 56)
                .background(Theme.agent.opacity(0.14), in: .circle)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.title.weight(.bold))
                    .fixedSize(horizontal: false, vertical: true)
                Text(message)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !starters.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(starters, id: \.self) { starter in
                        StarterChip(text: starter) { onStarter(starter) }
                    }
                }
                .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A sentence opener; tapping it puts it in the field so the person only finishes the thought.
private struct StarterChip: View {
    let text: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text("\(text)…")
                .font(.subheadline)
                .foregroundStyle(Color.primary)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Theme.chip, in: .capsule)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Starts your message with this")
    }
}

/// The scrolling part of a chat sheet. Until the chat starts it centres the intro in the space above the composer;
/// after that it lists the lines and stays pinned to the newest one.
struct ChatScrollView<Intro: View, Lines: View>: View {
    let hasStarted: Bool
    @ViewBuilder let intro: Intro
    @ViewBuilder let lines: Lines

    @State private var viewport: CGFloat = 0

    var body: some View {
        ScrollView {
            Group {
                if hasStarted {
                    VStack(alignment: .leading, spacing: 12) { lines }
                        .padding(.vertical, 16)
                        .transition(.opacity)
                } else {
                    // a min height, not a fixed one, so the intro still scrolls at the largest text sizes
                    intro
                        .padding(.top, 24)
                        .padding(.bottom, 56)
                        .frame(minHeight: viewport, alignment: .center)
                        .transition(.opacity)
                }
            }
            .padding(.horizontal, 20)
        }
        .defaultScrollAnchor(.bottom)
        .scrollDismissesKeyboard(.interactively)
        .scrollBounceBehavior(.basedOnSize)
        .onScrollGeometryChange(for: CGFloat.self) { geometry in
            geometry.containerSize.height - geometry.contentInsets.top - geometry.contentInsets.bottom
        } action: { _, height in
            viewport = max(height, 0)
        }
        .animation(.spring(duration: 0.4), value: hasStarted)
    }
}
