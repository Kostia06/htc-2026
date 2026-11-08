import SkillitKit
import SwiftUI

/// "Your headsets": every headset signed into this account, with when it was last seen and a way to sign it out.
struct HeadsetDevicesList: View {
    let devices: [HeadsetDevice]
    let onRemove: (HeadsetDevice) -> Void

    /// Removing signs the headset out for good, so it asks first.
    @State private var removing: HeadsetDevice?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your headsets")
                .font(.headline)
            ForEach(devices) { device in
                row(device)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .confirmationDialog(
            "Remove \(removing?.name ?? "headset")?",
            isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }),
            titleVisibility: .visible,
            presenting: removing,
        ) { device in
            Button("Remove", role: .destructive) { onRemove(device) }
        } message: { _ in
            Text("It's signed out and needs a new code to practise again.")
        }
    }

    private func row(_ device: HeadsetDevice) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "visionpro")
                .font(.title3)
                .foregroundStyle(device.isConnected ? Theme.positive : Color.secondary)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(device.name)
                    .font(.body.weight(.medium))
                lastSeen(device)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Remove", role: .destructive) { removing = device }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.bordered)
                .tint(.secondary)
                .accessibilityLabel("Remove \(device.name)")
        }
        .skillitCard()
        // contain, not combine: combining folded the Remove button into the row, so activating the row removed the headset
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private func lastSeen(_ device: HeadsetDevice) -> some View {
        if device.isConnected {
            Label("Connected now", systemImage: "circle.fill")
                .labelStyle(ConnectedDotStyle())
        } else {
            Text("Last seen \(device.lastSeenAt, format: .relative(presentation: .named))")
        }
    }
}

/// A small teal dot before the text, the same mark the Start button uses.
struct ConnectedDotStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.icon
                .font(.system(size: 8))
                .foregroundStyle(Theme.positive)
            configuration.title
        }
    }
}
