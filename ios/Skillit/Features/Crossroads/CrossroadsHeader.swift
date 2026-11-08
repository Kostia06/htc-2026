import SkillitKit
import SwiftUI

/// The one idea of the screen, then the privacy promise in small print.
struct RoadHeader: View {
    let road: Crossroads.Road
    let minPeople: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("On the road to")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Text(road.goal)
                .font(.title2.bold())
                .fixedSize(horizontal: false, vertical: true)
            Label {
                Text(
                    "Your notes stay encrypted and yours. Everyone else is anonymous, "
                        + "and a count only appears once \(minPeople) people share it.",
                )
            } icon: {
                Image(systemName: "lock.shield.fill").foregroundStyle(Theme.agent)
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.bottom, 4)
        .accessibilityElement(children: .combine)
    }
}

struct SectionTitle: View {
    let title: String
    let detail: String

    init(_ title: String, detail: String) {
        self.title = title
        self.detail = detail
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.headline).foregroundStyle(.primary)
            Text(detail).font(.caption).foregroundStyle(.secondary)
        }
        .textCase(nil)
        .padding(.top, 8)
        .accessibilityAddTraits(.isHeader)
    }
}

/// Names the two lanes once, above the crossings; hidden from VoiceOver since each crossing reads both sides out.
struct LaneCaptions: View {
    var body: some View {
        HStack {
            Text("You").frame(maxWidth: .infinity, alignment: .leading)
            Text("Everyone on your road").frame(maxWidth: .infinity, alignment: .leading).padding(.leading, 18)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(.secondary)
        .textCase(.uppercase)
        .accessibilityHidden(true)
    }
}

extension YourItem {
    /// The share sheet takes a stored memory; only `memory` items are ever shared.
    var asMemory: PrivateMemory {
        PrivateMemory(id: id, kind: kind, text: text, createdAt: "")
    }
}
