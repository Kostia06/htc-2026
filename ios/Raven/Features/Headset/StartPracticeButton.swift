import RavenKit
import SwiftUI

/// The one Start control for a practice step. A compact "Start" capsule that springs open into two raised options:
/// **Live on phone** calls `onPhone` (present the voice session there); **In VR** sends the step to the paired headset,
/// or opens pairing when none is listening. Drop it into a roadmap step card:
///
///     StartPracticeButton(companySlug: step.companySlug, role: step.role, stepID: step.id) {
///         activeSession = VoiceSessionModel(request: VoiceSessionRequest(mode: .interview, companySlug: step.companySlug), ...)
///     }
///
/// It polls the headset's state only while open, so a list of cards costs nothing until someone taps Start.
struct StartPracticeButton: View {
    enum Phase: Equatable { case compact, expanded, sent }

    var companySlug: String?
    var role: String?
    var stepID: String?
    /// stands in for the server in previews and screenshots; the signed-in client is used otherwise
    var link: (any HeadsetLinkService)?
    var initialPhase: Phase = .compact
    let onPhone: () -> Void

    @Environment(AppModel.self) private var app
    @State private var model = HeadsetLinkModel()
    @State private var phase: Phase
    @State private var isPairing = false
    @State private var sendFailure: String?
    @Namespace private var shape

    init(
        companySlug: String? = nil, role: String? = nil, stepID: String? = nil,
        link: (any HeadsetLinkService)? = nil, initialPhase: Phase = .compact, onPhone: @escaping () -> Void,
    ) {
        self.companySlug = companySlug
        self.role = role
        self.stepID = stepID
        self.link = link
        self.initialPhase = initialPhase
        self.onPhone = onPhone
        _phase = State(initialValue: initialPhase)
    }

    var body: some View {
        Group {
            switch phase {
            case .compact: compact
            case .expanded: expanded
            case .sent: sent
            }
        }
        .animation(.spring(duration: 0.4, bounce: 0.25), value: phase)
        .sensoryFeedback(.success, trigger: phase) { _, now in now == .sent }
        .task(id: phase == .expanded) {
            guard phase == .expanded, let service else { return }
            await model.watch(using: service)
        }
        .sheet(isPresented: $isPairing) {
            NavigationStack { PairHeadsetView(link: link) }
        }
    }

    private var service: (any HeadsetLinkService)? { link ?? app.client }

    private var compact: some View {
        Button {
            phase = .expanded
        } label: {
            Text("Start")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.onAction)
                .padding(.horizontal, 20)
                .padding(.vertical, 9)
                .background(Theme.action, in: .capsule)
                .matchedGeometryEffect(id: "frame", in: shape)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Shows where to practice: on this phone or in VR")
    }

    private var expanded: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Start")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Button("Not now") { phase = .compact }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Button(action: onPhone) {
                Label("Live on phone", systemImage: "iphone")
            }
            .buttonStyle(.raised)
            Button(action: startInVR) {
                HStack {
                    Label("In VR", systemImage: "visionpro")
                    Spacer()
                    headsetState
                }
            }
            .buttonStyle(.raised(Theme.raised))
            if let sendFailure {
                Text(sendFailure)
                    .font(.footnote)
                    .foregroundStyle(.orange)
            }
        }
        .padding(16)
        .background(Theme.ground.opacity(0.6), in: .rect(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Theme.hairline))
        .matchedGeometryEffect(id: "frame", in: shape)
    }

    @ViewBuilder private var headsetState: some View {
        if let name = model.connectedName {
            Label("\(name) connected", systemImage: "circle.fill")
                .labelStyle(ConnectedDotStyle())
                .font(.footnote)
                .foregroundStyle(.secondary)
        } else {
            Text(model.status == nil ? "" : "Pair a headset")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var sent: some View {
        Label("Sent to your headset", systemImage: "checkmark.circle.fill")
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.green)
            .padding(.horizontal, 20)
            .padding(.vertical, 9)
            .background(Theme.raised, in: .capsule)
            .matchedGeometryEffect(id: "frame", in: shape)
            .task {
                try? await Task.sleep(for: .seconds(3))
                // a button shown in this state for a screenshot stays in it
                if phase == .sent, initialPhase != .sent { phase = .compact }
            }
    }

    private func startInVR() {
        guard model.isConnected, let service else {
            isPairing = true
            return
        }
        Task {
            do throws(RavenError) {
                let launch = HeadsetLaunch(mode: .interview, companySlug: companySlug, role: role, stepID: stepID)
                _ = try await model.send(launch, using: service)
                sendFailure = nil
                phase = .sent
            } catch {
                sendFailure = error.message
            }
        }
    }
}
