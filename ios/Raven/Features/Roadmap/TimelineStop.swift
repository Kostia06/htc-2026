import RavenKit
import SwiftUI

/// One stop on the roadmap line: a dot on the rail and a card beside it saying what the step is.
struct TimelineStop: View {
    enum State {
        case done, current, upcoming
    }

    static let railWidth: CGFloat = 44

    let step: RoadmapStep
    let state: State
    var isFirst = false
    let onTap: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            rail
            Button(action: onTap) { card }
                .buttonStyle(StopPressStyle())
                .padding(.bottom, 12)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityValue(state == .done ? "Done" : state == .current ? "You're here" : "")
    }

    // the line runs through every stop; the dot sits level with the card's title
    private var rail: some View {
        ZStack(alignment: .top) {
            Rectangle()
                .fill(state == .upcoming ? Color(white: 0.18) : Theme.action.opacity(0.55))
                .frame(width: 3)
                .padding(.top, isFirst ? 18 : 0)
            dot
                .padding(.top, state == .current ? 14 : 18)
        }
        .frame(width: Self.railWidth, alignment: .leading)
        .frame(maxHeight: .infinity, alignment: .top)
        .offset(x: 15)
    }

    @ViewBuilder private var dot: some View {
        switch state {
        case .done:
            Image(systemName: "checkmark")
                .font(.system(size: 10, weight: .heavy))
                .foregroundStyle(Theme.onAction)
                .frame(width: 20, height: 20)
                .background(Theme.action, in: .circle)
                .offset(x: -8.5)
        case .current:
            Circle()
                .fill(Theme.action)
                .frame(width: 18, height: 18)
                .padding(4)
                .background(Theme.action.opacity(0.25), in: .circle)
                .offset(x: -11.5)
        case .upcoming:
            Circle()
                .strokeBorder(Color(white: 0.35), lineWidth: 2.5)
                .background(Theme.ground, in: .circle)
                .frame(width: 16, height: 16)
                .offset(x: -6.5)
        }
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: step.kind.symbol)
                    .font(.caption.weight(.bold))
                Text(step.kind.name)
                    .font(.caption.weight(.semibold))
                Spacer(minLength: 0)
                trailingMeta
            }
            .foregroundStyle(state == .upcoming ? .secondary : Theme.action)
            Text(step.title)
                .font(state == .current ? .title3.bold() : .headline)
                .foregroundStyle(state == .upcoming ? .secondary : .primary)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            if state == .current, !step.why.isEmpty {
                Text(step.why)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            if state == .done, let note = step.note, !note.isEmpty {
                Text(note)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            if state == .current {
                Text(step.isPractice ? "Start" : "Open")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(Theme.onAction)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Theme.action, in: .capsule)
                    .padding(.top, 2)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(state == .current ? Theme.action.opacity(0.12) : Theme.raised, in: .rect(cornerRadius: 18))
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .strokeBorder(state == .current ? Theme.action.opacity(0.5) : Theme.hairline),
        )
    }

    @ViewBuilder private var trailingMeta: some View {
        if state == .done, let day = doneDay {
            Text(day).font(.caption)
        } else if !step.estimate.isEmpty {
            Label(step.estimate, systemImage: "clock").font(.caption)
        }
    }

    private var doneDay: String? {
        guard let stamp = step.completedAt, let date = try? Date(stamp, strategy: .iso8601) else { return nil }
        return date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }
}

/// Cards dip slightly when pressed, so a tap feels answered before the sheet arrives.
private struct StopPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.spring(duration: 0.2), value: configuration.isPressed)
            .sensoryFeedback(.impact(weight: .light), trigger: configuration.isPressed) { _, pressed in pressed }
    }
}
