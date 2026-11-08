import RavenKit
import SwiftUI

extension PracticeDifficulty {
    static let storageKey = "practiceDifficulty"

    /// The level last picked on the Practice tab, so a session launched from the roadmap feels the same.
    static var preferred: PracticeDifficulty {
        UserDefaults.standard.string(forKey: storageKey).flatMap(PracticeDifficulty.init(rawValue:)) ?? .standard
    }

    var title: String {
        rawValue.capitalized
    }

    var caption: String {
        switch self {
        case .easy: "Friendly, gives you time"
        case .standard: "Like a real first round"
        case .hard: "Pushes back and digs for specifics"
        }
    }
}

/// Easy / Standard / Hard, with one line on what that means.
struct DifficultyPicker: View {
    @Binding var difficulty: PracticeDifficulty

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Picker("Difficulty", selection: $difficulty) {
                ForEach(PracticeDifficulty.allCases, id: \.self) { level in
                    Text(level.title).tag(level)
                }
            }
            .pickerStyle(.segmented)
            Text(difficulty.caption)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .contentTransition(.opacity)
                .animation(.easeInOut(duration: 0.2), value: difficulty)
        }
    }
}
