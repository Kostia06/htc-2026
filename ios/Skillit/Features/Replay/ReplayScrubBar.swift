import SkillitKit
import SwiftUI

/// The playback bar with a coloured dot at every moment. Drag the bar to scrub, tap a dot to jump to it.
struct ReplayScrubBar: View {
    let replay: SessionReplay
    let currentTime: Double
    let duration: Double
    let selectedId: String?
    let onSeek: (Double) -> Void
    let onSelect: (ReplayMoment) -> Void

    private let trackHeight: CGFloat = 6
    private let dotSize: CGFloat = 12
    // dots are small to see but each still gets a full-size touch target
    private let hitSize: CGFloat = 44

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let positions = dotPositions(width: width)
            ZStack(alignment: .leading) {
                track(width: width)
                ForEach(replay.moments) { moment in
                    dot(moment, centerX: positions[moment.id] ?? 0)
                }
            }
            .frame(height: hitSize)
        }
        .frame(height: hitSize)
        .accessibilityElement(children: .contain)
    }

    private func fraction(_ time: Double) -> CGFloat {
        duration > 0 ? CGFloat(min(1, max(0, time / duration))) : 0
    }

    /// A mistake and its better phrasing often land a second apart, which is less than a pixel on a long call;
    /// keep neighbours a dot apart so neither hides the other.
    private func dotPositions(width: CGFloat) -> [String: CGFloat] {
        var positions: [String: CGFloat] = [:]
        var last = -CGFloat.infinity
        for moment in replay.moments.sorted(by: { $0.seconds < $1.seconds }) {
            let centerX = min(width, max(width * fraction(moment.seconds), last + dotSize + 2))
            positions[moment.id] = centerX
            last = centerX
        }
        return positions
    }

    private func track(width: CGFloat) -> some View {
        ZStack(alignment: .leading) {
            Capsule().fill(Theme.inset).frame(height: trackHeight)
            Capsule().fill(Theme.action).frame(width: max(trackHeight, width * fraction(currentTime)), height: trackHeight)
            Circle()
                .fill(Theme.action)
                .frame(width: 16, height: 16)
                .offset(x: width * fraction(currentTime) - 8)
        }
        .frame(width: width, height: hitSize)
        .contentShape(.rect)
        .gesture(
            DragGesture(minimumDistance: 0).onChanged { value in
                onSeek(Double(max(0, min(1, value.location.x / max(1, width)))) * duration)
            },
        )
        .accessibilityElement()
        .accessibilityLabel("Playback position")
        .accessibilityValue("\(ReplayClock.label(currentTime)) of \(ReplayClock.label(duration))")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: onSeek(currentTime + 10)
            case .decrement: onSeek(currentTime - 10)
            @unknown default: break
            }
        }
    }

    private func dot(_ moment: ReplayMoment, centerX: CGFloat) -> some View {
        let isSelected = moment.id == selectedId
        return Button {
            onSelect(moment)
        } label: {
            Circle()
                .fill(moment.kind.tint)
                .frame(width: dotSize, height: dotSize)
                .overlay(Circle().strokeBorder(Theme.ground, lineWidth: 2))
                .scaleEffect(isSelected ? 1.5 : 1)
                .frame(width: hitSize, height: hitSize)
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .offset(x: centerX - hitSize / 2)
        .animation(.spring(duration: 0.3), value: isSelected)
        .accessibilityLabel(replay.spokenLabel(for: moment))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
