import RavenKit
import SwiftUI

/// The calm top of the Profile tab: the role they're aiming for, big, and one line about them under it.
struct ProfileHeader: View {
    let profile: Profile
    let onEditHeadline: () -> Void
    @ScaledMetric(relativeTo: .largeTitle) private var roleSize: CGFloat = 34

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(profile.targetRoles.isEmpty ? "Your profile" : "Aiming for")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(profile.targetRoles.first ?? "Pick a target role below")
                .font(.system(size: roleSize, weight: .bold, design: .rounded))
                .contentTransition(.opacity)
            Button(action: onEditHeadline) {
                HStack(spacing: 6) {
                    Text(profile.headline ?? "Add a line about yourself")
                        .foregroundStyle(profile.headline == nil ? Theme.action : .secondary)
                    Image(systemName: "pencil")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                .font(.body)
                .multilineTextAlignment(.leading)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(profile.headline.map { "Headline: \($0). Edit" } ?? "Add a headline")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 8)
        .animation(.spring(duration: 0.35), value: profile.targetRoles.first)
    }
}
