import SwiftUI

/// The entry Profile and Settings link to. What Skillit remembers now lives in Crossroads, beside everyone's road,
/// so this opens it; kept under its old name so those links stay as they are.
struct MemoryView: View {
    var body: some View {
        CrossroadsView()
    }
}

#if DEBUG
    #Preview {
        NavigationStack { MemoryView() }
            .environment(AppModel.preview(profile: .sample))
    }
#endif
