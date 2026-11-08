import Foundation
import Observation
import RavenKit

/// What Raven remembers about the person, grouped by kind. Deleting shows at once and is put back if the server refuses.
@Observable
final class MemoryModel {
    enum Phase: Equatable {
        case loading
        case ready
        case failed(String)
    }

    private(set) var phase: Phase = .loading
    private(set) var memories: [PrivateMemory] = []
    /// A delete the server refused; shown briefly so the row coming back is not a mystery.
    private(set) var notice: String?

    private let service: any MemoryService

    init(service: any MemoryService) {
        self.service = service
    }

    /// Kinds in display order, each with its memories newest first; empty kinds are left out.
    var groups: [(kind: PrivateMemory.Kind, memories: [PrivateMemory])] {
        PrivateMemory.Kind.allCases.compactMap { kind in
            let items = memories.filter { $0.kind == kind }
            return items.isEmpty ? nil : (kind, items)
        }
    }

    func load() async {
        if memories.isEmpty {
            phase = .loading
        }
        do {
            memories = try await service.memories()
            phase = .ready
        } catch {
            if memories.isEmpty {
                phase = .failed(error.message)
            }
        }
    }

    func forget(_ memory: PrivateMemory) async {
        guard let index = memories.firstIndex(where: { $0.id == memory.id }) else { return }
        memories.remove(at: index)
        do {
            try await service.forgetMemory(id: memory.id)
        } catch .rejected(status: 404, message: _) {
            // already gone on the server: nothing to put back
        } catch {
            memories.insert(memory, at: min(index, memories.count))
            notice = error.message
            try? await Task.sleep(for: .seconds(3))
            notice = nil
        }
    }
}

extension PrivateMemory.Kind {
    var title: String {
        switch self {
        case .goal: "Goals"
        case .skill: "Skills"
        case .weakness: "Working on"
        case .preference: "Preferences"
        case .note: "Notes"
        }
    }

    var symbol: String {
        switch self {
        case .goal: "flag.fill"
        case .skill: "star.fill"
        case .weakness: "arrow.up.forward"
        case .preference: "slider.horizontal.3"
        case .note: "note.text"
        }
    }
}
