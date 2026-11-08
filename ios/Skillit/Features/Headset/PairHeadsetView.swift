import SkillitKit
import SwiftUI

/// Signs a Meta Quest into this account: the phone shows 4 digits, the headset types them in. Pushed from Practice.
struct PairHeadsetView: View {
    @Environment(AppModel.self) private var app
    @State private var model = HeadsetPairingModel()
    /// bumped to pair one more headset; restarts the task below
    @State private var attempt = 0
    @State private var link = HeadsetLinkModel()
    private let issuer: (any HeadsetCodeIssuer)?
    private let linkService: (any HeadsetLinkService)?

    /// `issuer` and `link` stand in for the server in screenshots; the signed-in client is used otherwise.
    init(issuer: (any HeadsetCodeIssuer)? = nil, link: (any HeadsetLinkService)? = nil) {
        self.issuer = issuer
        linkService = link
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {
                content
                if !link.devices.isEmpty {
                    HeadsetDevicesList(devices: link.devices) { device in
                        guard let service = linkService ?? app.client else { return }
                        Task { await link.revoke(device, using: service) }
                    }
                    .padding(.top, 8)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(24)
        }
        .background(Theme.ground)
        .navigationTitle("Practice in VR")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: attempt) {
            guard let issuer = issuer ?? app.client else { return }
            await model.run(using: issuer)
        }
        .task {
            guard let service = linkService ?? app.client else { return }
            await link.watch(using: service)
        }
        .sensoryFeedback(.success, trigger: model.state == .connected) { _, isConnected in isConnected }
        .animation(.spring(duration: 0.35), value: model.state)
    }

    @ViewBuilder private var content: some View {
        switch model.state {
        case .loading:
            Circle()
                .fill(Theme.raised)
                .frame(width: 272, height: 272)
                .shimmering()
                .accessibilityLabel("Getting a code")
            instructions
        case let .showing(code):
            CodeCountdownRing(code: code)
            instructions
            Label("Waiting for your headset", systemImage: "visionpro")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        case .connected:
            connected
        case let .failed(message):
            Label(message, systemImage: "wifi.exclamationmark")
                .foregroundStyle(.orange)
                .skillitCard()
            Text("Trying again in a moment.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var instructions: some View {
        // the address on a line of its own so it never breaks at a hyphen
        Text("On your headset, open\n**raven-vr.ilnkostia-dev.workers.dev**\nand enter this code")
            .font(.body)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 8)
    }

    private var connected: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 88))
                .foregroundStyle(.green)
                .symbolEffect(.bounce, value: model.state)
            Text("Headset connected")
                .font(.title.bold())
            Text("Put it on to start practicing. It stays signed in until you remove it here.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Pair another headset") { attempt += 1 }
                .buttonStyle(.raised)
                .padding(.top, 24)
        }
        .padding(.top, 48)
    }
}
