import Foundation

/// The skill list while someone edits it: add, rename and remove locally, then send the whole change as one patch.
/// Skills left alone keep their source and evidence; anything typed in (a new skill or a new name) is self-reported,
/// because the resume quote backed the old wording, not whatever it's renamed to.
public struct SkillsDraft: Equatable, Sendable {
    public struct Row: Identifiable, Equatable, Sendable {
        public let id: UUID
        public private(set) var name: String
        /// What the server has for this row; nil for a skill added in this draft.
        let original: Profile.Skill?

        /// True while the row still matches what the server has, so its evidence is kept.
        public var isUntouched: Bool {
            original?.name == name
        }

        public var source: SkillSource {
            isUntouched ? original?.source ?? .selfReported : .selfReported
        }

        var skill: Profile.Skill {
            if isUntouched, let original { return original }
            return Profile.Skill(name: name, source: .selfReported)
        }

        fileprivate mutating func rename(to text: String) {
            name = text
        }
    }

    /// The server keeps at most this many skills and drops the rest silently, so the editor stops here instead.
    public static let limit = 50

    public private(set) var rows: [Row]
    private let originals: [Profile.Skill]

    public init(skills: [Profile.Skill]) {
        originals = skills
        rows = skills.map { Row(id: UUID(), name: $0.name, original: $0) }
    }

    public var canAdd: Bool {
        rows.count < Self.limit
    }

    public var skills: [Profile.Skill] {
        rows.map(\.skill)
    }

    /// Adds a skill unless it's blank or already listed. Re-adding one removed in this draft brings back its evidence.
    @discardableResult
    public mutating func add(_ text: String) -> Bool {
        guard canAdd, let name = Self.cleaned(text), !contains(name) else { return false }
        let removed = originals.first { Self.same($0.name, name) && !rows.contains(original: $0) }
        rows.append(Row(id: UUID(), name: removed?.name ?? name, original: removed))
        return true
    }

    /// Renames a row unless the new name is blank or taken by another row. Returns whether the name changed.
    @discardableResult
    public mutating func rename(_ id: Row.ID, to text: String) -> Bool {
        guard let index = rows.firstIndex(where: { $0.id == id }), let name = Self.cleaned(text) else { return false }
        guard name != rows[index].name, !contains(name, except: id) else { return false }
        rows[index].rename(to: name)
        return true
    }

    public mutating func remove(_ id: Row.ID) {
        rows.removeAll { $0.id == id }
    }

    public mutating func remove(atOffsets offsets: IndexSet) {
        rows = rows.enumerated().filter { !offsets.contains($0.offset) }.map(\.element)
    }

    public func contains(_ name: String, except id: Row.ID? = nil) -> Bool {
        rows.contains { $0.id != id && Self.same($0.name, name) }
    }

    /// Up to `count` known skills that aren't listed yet, narrowed by what's typed so far.
    /// Skills removed in this draft come first, so an accidental delete is one tap to undo.
    public func suggestions(matching text: String, among known: [String], count: Int = 6) -> [String] {
        let query = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let removed = originals.filter { !rows.contains(original: $0) }.map(\.name)
        var seen = Set<String>()
        return (removed + known)
            .filter { query.isEmpty || $0.lowercased().contains(query) }
            .filter { !contains($0) && !Self.same($0, query) && seen.insert($0.lowercased()).inserted }
            .prefix(count)
            .map(\.self)
    }

    /// The one patch that makes the server match this draft, or nil when nothing changed.
    /// The server applies removals before additions, so a rename is "remove the old name, add the new one".
    public var patch: ProfilePatch? {
        let kept = rows.filter(\.isUntouched)
        let removed = originals.filter { original in !kept.contains { $0.original == original } }.map(\.name)
        let added = rows.filter { !$0.isUntouched }.map(\.skill)
        guard !removed.isEmpty || !added.isEmpty else { return nil }
        return ProfilePatch(
            skills: added.isEmpty ? nil : added,
            remove: removed.isEmpty ? nil : .init(skills: removed),
        )
    }

    static func same(_ lhs: String, _ rhs: String) -> Bool {
        lhs.lowercased() == rhs.lowercased()
    }

    static func cleaned(_ text: String) -> String? {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}

public extension SkillsDraft {
    /// Skills worth offering while typing: the common ones from onboarding.
    static var commonSkills: [String] {
        OnboardingQuestion.named("skills")?.options ?? []
    }
}

public extension Profile {
    /// Takes the draft's skills and returns the patch that makes the server match. Nil when nothing changed.
    mutating func applySkills(_ draft: SkillsDraft) -> ProfilePatch? {
        guard let patch = draft.patch else { return nil }
        skills = draft.skills
        return patch
    }
}

private extension [SkillsDraft.Row] {
    func contains(original: Profile.Skill) -> Bool {
        contains { $0.original == original }
    }
}
