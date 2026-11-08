import SwiftUI

/// Where each of the Profile tab's doors leads.
enum ProfileDestination: Hashable {
    case resume, skillsAndExperience, crossroads, headsets, settings
}

/// One big door: what's behind it, and one live fact about it so the page says something without opening anything.
struct ProfileDoor: Identifiable {
    let destination: ProfileDestination
    let title: String
    let symbol: String
    let fact: String

    var id: ProfileDestination {
        destination
    }
}

/// The doors in a two-by-two grid; one column at accessibility text sizes so titles never squeeze.
struct ProfileDoors: View {
    let doors: [ProfileDoor]
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        if dynamicTypeSize.isAccessibilitySize {
            VStack(spacing: 14) {
                ForEach(doors) { DoorButton(door: $0) }
            }
        } else {
            Grid(horizontalSpacing: 14, verticalSpacing: 14) {
                ForEach(pairs, id: \.first.id) { pair in
                    GridRow {
                        DoorButton(door: pair.first)
                        if let second = pair.second {
                            DoorButton(door: second)
                        } else {
                            Color.clear
                        }
                    }
                }
            }
        }
    }

    private var pairs: [(first: ProfileDoor, second: ProfileDoor?)] {
        stride(from: 0, to: doors.count, by: 2).map { index in
            (doors[index], index + 1 < doors.count ? doors[index + 1] : nil)
        }
    }
}

private struct DoorButton: View {
    let door: ProfileDoor
    @ScaledMetric(relativeTo: .headline) private var minHeight: CGFloat = 100

    var body: some View {
        NavigationLink(value: door.destination) {
            VStack(alignment: .leading, spacing: 4) {
                Image(systemName: door.symbol)
                    .font(.title2)
                    .foregroundStyle(Theme.action)
                    .frame(height: 32, alignment: .leading)
                Spacer(minLength: 10)
                Text(door.title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(door.fact)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .multilineTextAlignment(.leading)
            .frame(maxWidth: .infinity, minHeight: minHeight, maxHeight: .infinity, alignment: .topLeading)
            .skillitCard()
        }
        .buttonStyle(.raisedCard())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(door.title), \(door.fact)")
        .accessibilityAddTraits(.isButton)
    }
}
