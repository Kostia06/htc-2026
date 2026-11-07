import SwiftUI

struct MainTabView: View {
    @Environment(AppModel.self) private var model
    @State private var selection: Section

    init(selection: Section = .roadmap) {
        _selection = State(initialValue: selection)
    }

    enum Section: Hashable {
        case roadmap, forYou, practice, profile
    }

    var body: some View {
        TabView(selection: $selection) {
            Tab("Roadmap", systemImage: "point.topleft.down.to.point.bottomright.curvepath", value: .roadmap) {
                RoadmapView()
            }
            Tab("For you", systemImage: "sparkles", value: .forYou) {
                ForYouView()
            }
            Tab("Practice", systemImage: "visionpro", value: .practice) {
                PairHeadsetView()
            }
            Tab("Profile", systemImage: "person.crop.circle", value: .profile) {
                ProfileView()
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .onChange(of: model.pendingPairing, initial: true) { _, code in
            if code != nil {
                selection = .practice
            }
        }
    }
}
