import RavenKit
import SwiftUI

/// Four tabs behind a bar of our own, so the bar can morph into "Ask Skillit" without leaving the screen.
struct MainTabView: View {
    @Environment(AppModel.self) private var model
    @State private var selection: Section
    @State private var isAsking = false
    @State private var openedPosting: JobPosting?

    init(selection: Section = .roadmap) {
        _selection = State(initialValue: selection)
    }

    enum Section: Hashable, CaseIterable, Identifiable {
        case roadmap, forYou, practice, profile

        var id: Self {
            self
        }

        var title: String {
            switch self {
            case .roadmap: "Roadmap"
            case .forYou: "For you"
            case .practice: "Practice"
            case .profile: "Profile"
            }
        }

        var symbol: String {
            switch self {
            case .roadmap: "point.topleft.down.to.point.bottomright.curvepath"
            case .forYou: "rectangle.stack.fill"
            case .practice: "visionpro"
            case .profile: "person.crop.circle"
            }
        }
    }

    var body: some View {
        TabView(selection: $selection) {
            Tab(Section.roadmap.title, systemImage: Section.roadmap.symbol, value: .roadmap) {
                RoadmapView().toolbarVisibility(.hidden, for: .tabBar)
            }
            Tab(Section.forYou.title, systemImage: Section.forYou.symbol, value: .forYou) {
                ForYouView().toolbarVisibility(.hidden, for: .tabBar)
            }
            Tab(Section.practice.title, systemImage: Section.practice.symbol, value: .practice) {
                PracticeView().toolbarVisibility(.hidden, for: .tabBar)
            }
            Tab(Section.profile.title, systemImage: Section.profile.symbol, value: .profile) {
                ProfileView().toolbarVisibility(.hidden, for: .tabBar)
            }
        }
        .overlay {
            // a tap anywhere outside the bar puts the tabs back
            if isAsking {
                Color.clear
                    .contentShape(.rect)
                    .onTapGesture { isAsking = false }
            }
        }
        .safeAreaInset(edge: .bottom) {
            AskRavenBar(selection: $selection, isAsking: $isAsking, onOpenPosting: { openedPosting = $0 })
        }
        .sheet(item: $openedPosting) { posting in
            PostingView(posting: posting)
        }
    }
}
