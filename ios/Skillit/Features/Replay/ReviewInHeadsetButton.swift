import SkillitKit
import SwiftUI

/// Sends this session's review to the paired headset, where it opens as a list of moments to play from.
struct ReviewInHeadsetButton: View {
    enum Phase: Equatable {
        case ready, sending, sent, failed
    }

    let sessionId: String
    let service: any HeadsetLinkService
    @State private var phase: Phase = .ready

    var body: some View {
        Button(action: send) {
            Label(title, systemImage: phase == .sent ? "checkmark" : "visionpro")
        }
        .disabled(phase == .sending)
        .sensoryFeedback(.success, trigger: phase == .sent)
        .accessibilityHint("Opens this review in your headset")
    }

    private var title: String {
        switch phase {
        case .ready: "Review in VR"
        case .sending: "Sending…"
        case .sent: "Sent to headset"
        case .failed: "Try again"
        }
    }

    private func send() {
        phase = .sending
        Task {
            do {
                _ = try await service.sendToHeadset(HeadsetLaunch(mode: .interview, reviewSessionID: sessionId))
                phase = .sent
            } catch {
                phase = .failed
            }
        }
    }
}
