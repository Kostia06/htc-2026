#if DEBUG
    import Foundation
    import SkillitKit

    /// A server stand-in for screenshots: shows a code, then reports the headset connected a few seconds later.
    nonisolated struct DemoHeadsetIssuer: HeadsetCodeIssuer {
        private let connectsAt = Date.now.addingTimeInterval(6)

        func offerHeadsetCode() async throws(SkillitError) -> HeadsetCode {
            HeadsetCode(digits: "4821", expiresAt: .now.addingTimeInterval(102))
        }

        func headsetCodeStatus(_: HeadsetCode) async throws(SkillitError) -> HeadsetCodeStatus {
            Date.now >= connectsAt ? .claimed : .waiting
        }
    }
#endif
