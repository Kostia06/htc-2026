import RavenKit
import SwiftUI

/// The calm top of the Profile tab: the role they're aiming for, big, and one line about them under it.
/// Tap the line to edit it in place; it saves when you press Done or tap away.
struct ProfileHeader: View {
    let profile: Profile
    let onSaveHeadline: (String) -> Void
    @ScaledMetric(relativeTo: .largeTitle) private var roleSize: CGFloat = 34
    @State private var isEditing = false
    @State private var draft = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if !profile.targetRoles.isEmpty {
                Text("Aiming for")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(profile.targetRoles.first ?? "Pick a target role below")
                .font(.system(size: roleSize, weight: .bold, design: .rounded))
                .contentTransition(.opacity)
            if isEditing {
                editor
            } else {
                headline
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
        .animation(.spring(duration: 0.35), value: profile.targetRoles.first)
    }

    private var headline: some View {
        Button(action: startEditing) {
            HStack(spacing: 6) {
                Text(profile.headline ?? "Add a line about yourself")
                    .foregroundStyle(profile.headline == nil ? Theme.action : .secondary)
                Image(systemName: "pencil")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .font(.body)
            .multilineTextAlignment(.leading)
            .frame(minHeight: 44)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(profile.headline.map { "Headline: \($0). Edit" } ?? "Add a headline")
    }

    private var editor: some View {
        TextField("One line about you", text: $draft)
            .font(.body)
            .focused($isFocused)
            .submitLabel(.done)
            .onSubmit(save)
            .onAppear { isFocused = true }
            .onChange(of: isFocused) { _, focused in
                if !focused {
                    save()
                }
            }
            .frame(minHeight: 44)
    }

    private func startEditing() {
        draft = profile.headline ?? ""
        isEditing = true
    }

    private func save() {
        guard isEditing else { return }
        isEditing = false
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        if text != (profile.headline ?? "") {
            onSaveHeadline(text)
        }
    }
}
