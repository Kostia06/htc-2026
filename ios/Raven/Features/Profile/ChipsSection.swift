import SwiftUI

/// Chips that wrap, each with a small remove button, and one quiet field under them to add another.
struct ChipsSection: View {
    struct Chip: Identifiable, Equatable {
        let title: String
        var tag: String?

        var id: String { title.lowercased() }
    }

    let chips: [Chip]
    let placeholder: String
    let onAdd: (String) -> Void
    let onRemove: (Chip) -> Void

    @State private var draft = ""
    @FocusState private var isTyping: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if !chips.isEmpty {
                FlowLayout(spacing: 8) {
                    ForEach(chips) { chip in
                        ChipView(chip: chip) { onRemove(chip) }
                            .transition(.scale(scale: 0.8).combined(with: .opacity))
                    }
                }
            }
            HStack(spacing: 8) {
                Image(systemName: "plus.circle.fill")
                    .foregroundStyle(isTyping ? Theme.action : .secondary)
                TextField(placeholder, text: $draft)
                    .focused($isTyping)
                    .submitLabel(.done)
                    .onSubmit(add)
                    .textInputAutocapitalization(.sentences)
                if !draft.isEmpty {
                    Button("Add", action: add)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.action)
                        .transition(.opacity)
                }
            }
            .font(.body)
        }
        .padding(.vertical, 4)
        .animation(.spring(duration: 0.3), value: chips)
        .animation(.easeOut(duration: 0.15), value: draft.isEmpty)
    }

    private func add() {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        onAdd(text)
        draft = ""
    }
}

private struct ChipView: View {
    let chip: ChipsSection.Chip
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            VStack(alignment: .leading, spacing: 0) {
                Text(chip.title)
                    .font(.subheadline.weight(.medium))
                if let tag = chip.tag {
                    Text(tag)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.secondary)
                    .padding(6)
                    .contentShape(.circle)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(chip.title)")
        }
        .padding(.leading, 12)
        .padding(.trailing, 4)
        .padding(.vertical, 6)
        .background(Color(white: 0.16), in: .capsule)
        .overlay(Capsule().strokeBorder(Theme.hairline))
    }
}
