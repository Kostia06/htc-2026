import SwiftUI

/// What the plus button offers. Order is bottom-up: Voice sits nearest the thumb.
enum AskSkillitOption: CaseIterable, Identifiable {
    case voice, type, file, connect

    var id: Self {
        self
    }

    var title: String {
        switch self {
        case .voice: "Voice"
        case .type: "Type"
        case .file: "File"
        case .connect: "Connect"
        }
    }

    var symbol: String {
        switch self {
        case .voice: "mic.fill"
        case .type: "keyboard"
        case .file: "doc.badge.plus"
        case .connect: "link"
        }
    }

    var hint: String {
        switch self {
        case .voice: "Say what's new"
        case .type: "Type what's new"
        case .file: "Send a transcript, certificate or resume"
        case .connect: "Bring work from GitHub, Notion and more"
        }
    }
}

/// The options fanned out above the plus button. Each one springs up from the button with a short stagger and folds
/// back into it on close; with Reduce Motion they simply fade.
struct AskSkillitMenu: View {
    let isOpen: Bool
    let onSelect: (AskSkillitOption) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// one circle plus the gap between circles, so a closed option sits exactly behind the button
    private static let step: CGFloat = 64

    var body: some View {
        let options = Array(AskSkillitOption.allCases.reversed())
        VStack(alignment: .trailing, spacing: 12) {
            ForEach(Array(options.enumerated()), id: \.element) { index, option in
                let fromButton = CGFloat(options.count - index) * Self.step
                row(option)
                    .opacity(isOpen ? 1 : 0)
                    .scaleEffect(isOpen || reduceMotion ? 1 : 0.4, anchor: .trailing)
                    .offset(y: isOpen || reduceMotion ? 0 : fromButton)
                    .animation(animation(order: options.count - 1 - index), value: isOpen)
            }
        }
        .allowsHitTesting(isOpen)
        .accessibilityHidden(!isOpen)
    }

    private func row(_ option: AskSkillitOption) -> some View {
        Button { onSelect(option) } label: {
            HStack(spacing: 10) {
                Text(option.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .glassEffect(.regular, in: .capsule)
                Image(systemName: option.symbol)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Theme.action)
                    .frame(width: 52, height: 52)
                    .glassEffect(.regular.interactive(), in: .circle)
            }
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(option.title)
        .accessibilityHint(option.hint)
    }

    // nearest the button moves first on open; on close they all fold back together
    private func animation(order: Int) -> Animation {
        if reduceMotion { return .easeInOut(duration: 0.2) }
        return isOpen ? .spring(duration: 0.4, bounce: 0.3).delay(Double(order) * 0.04) : .spring(duration: 0.3, bounce: 0)
    }
}
