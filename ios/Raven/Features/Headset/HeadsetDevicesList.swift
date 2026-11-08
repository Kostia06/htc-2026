import RavenKit
import SwiftUI

/// "Your headsets": every headset signed into this account, with when it was last seen and a way to sign it out.
struct HeadsetDevicesList: View {
    let devices: [HeadsetDevice]
    let onRemove: (HeadsetDevice) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Your headsets")
                .font(.headline)
            ForEach(devices) { device in
                row(device)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func row(_ device: HeadsetDevice) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "visionpro")
                .font(.title3)
                .foregroundStyle(device.isConnected ? Theme.action : .secondary)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(device.name)
                    .font(.body.weight(.medium))
                lastSeen(device)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Remove", role: .destructive) { onRemove(device) }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.bordered)
                .tint(.secondary)
        }
        .ravenCard()
        .accessibilityElement(children: .combine)
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

/// A small green dot before the text, the same mark the Start button uses.
struct ConnectedDotStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.icon
                .font(.system(size: 8))
                .foregroundStyle(.green)
            configuration.title
        }
    }
}
