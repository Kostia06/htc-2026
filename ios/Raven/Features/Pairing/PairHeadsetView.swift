import RavenKit
import SwiftUI

/// Signs a Meta Quest into this account: the headset shows a QR, this phone scans it and approves.
struct PairHeadsetView: View {
    @Environment(AppModel.self) private var app
    @State private var model = PairingModel()
    @State private var isScanning = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Practice in VR")
                        .font(.largeTitle.bold())
                    Text("""
                    Open Raven in the Quest browser. It shows a code: scan it here and the headset joins your account, \
                    with your profile and interview plans.
                    """)
                    .foregroundStyle(.secondary)
                    statusCard
                    Button {
                        isScanning = true
                    } label: {
                        Label("Scan the headset's code", systemImage: "qrcode.viewfinder")
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.glassProminent)
                    .controlSize(.large)
                    .disabled(!QRScannerView.isAvailable)
                    typedCodeField
                }
                .padding(24)
            }
            .sheet(isPresented: $isScanning) {
                QRScannerView { code in
                    isScanning = false
                    model.found(code)
                }
                .ignoresSafeArea()
                .presentationDetents([.large])
            }
            .confirmationDialog("Sign this headset in to your account?", isPresented: isConfirming, titleVisibility: .visible) {
                Button("Sign in headset") { approvePending() }
                Button("Cancel", role: .cancel) { model.reset() }
            } message: {
                Text("Only approve a code shown on your own headset.")
            }
            .sensoryFeedback(.success, trigger: model.state == .paired)
            .onAppear(perform: takePendingLink)
            .onChange(of: app.pendingPairing) { _, _ in takePendingLink() }
        }
    }

    @ViewBuilder private var statusCard: some View {
        switch model.state {
        case .paired:
            Label("Headset connected. Put it on to start.", systemImage: "checkmark.circle.fill")
                .foregroundStyle(.green)
                .ravenCard()
        case .pairing:
            Label("Connecting…", systemImage: "visionpro")
                .foregroundStyle(Theme.agent)
                .ravenCard()
        case let .failed(message):
            Label(message, systemImage: "exclamationmark.triangle")
                .foregroundStyle(.orange)
                .ravenCard()
        case .idle, .confirming:
            EmptyView()
        }
    }

    private var typedCodeField: some View {
        HStack {
            TextField("Or type the 8-character code", text: $model.typedCode)
                .textInputAutocapitalization(.characters)
                .autocorrectionDisabled()
                .font(.body.monospaced())
            Button("Pair") {
                if let code = model.typedPairingCode {
                    model.found(code)
                }
            }
            .disabled(model.typedPairingCode == nil)
        }
        .ravenCard()
    }

    private var isConfirming: Binding<Bool> {
        Binding(
            get: {
                if case .confirming = model.state {
                    true
                } else {
                    false
                }
            },
            set: {
                if !$0, case .confirming = model.state {
                    model.reset()
                }
            },
        )
    }

    private func approvePending() {
        guard case let .confirming(code) = model.state, let client = app.client else { return }
        Task { await model.approve(code, using: client) }
    }

    private func takePendingLink() {
        guard let code = app.pendingPairing else { return }
        app.pendingPairing = nil
        model.found(code)
    }
}
