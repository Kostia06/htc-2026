import Foundation

/// One change made on the Profile screen. Applied to the local copy first, and sent to the server as the same patch.
public enum ProfileEdit: Equatable, Sendable {
    case setHeadline(String)
    case addTargetRole(String)
    case removeTargetRole(String)
    case addSkill(String)
    case removeSkill(String)
    case saveExperience(Profile.Experience, replacing: Profile.Experience?)
    case removeExperience(Profile.Experience)
    case saveEducation(Profile.Education, replacing: Profile.Education?)
    case removeEducation(Profile.Education)
}

/// The body of `PATCH /api/me/profile`: lists are merged in; `remove` takes entries out first.
public struct ProfilePatch: Encodable, Equatable, Sendable {
    public struct Removals: Encodable, Equatable, Sendable {
        public var targetRoles: [String]?
        public var skills: [String]?
        public var experience: [Profile.Experience]?
        public var education: [Profile.Education]?

        public init(
            targetRoles: [String]? = nil,
            skills: [String]? = nil,
            experience: [Profile.Experience]? = nil,
            education: [Profile.Education]? = nil,
        ) {
            self.targetRoles = targetRoles
            self.skills = skills
            self.experience = experience
            self.education = education
        }
    }

    public var headline: String?
    public var targetRoles: [String]?
    public var skills: [Profile.Skill]?
    public var experience: [Profile.Experience]?
    public var education: [Profile.Education]?
    public var remove: Removals?

    public init(
        headline: String? = nil,
        targetRoles: [String]? = nil,
        skills: [Profile.Skill]? = nil,
        experience: [Profile.Experience]? = nil,
        education: [Profile.Education]? = nil,
        remove: Removals? = nil,
    ) {
        self.headline = headline
        self.targetRoles = targetRoles
        self.skills = skills
        self.experience = experience
        self.education = education
        self.remove = remove
    }
}

public extension Profile {
    /// Applies the edit here and returns the patch that makes the server match. Nil when there is nothing to change.
    mutating func apply(_ edit: ProfileEdit) -> ProfilePatch? {
        switch edit {
        case let .setHeadline(text): setHeadline(text)
        case let .addTargetRole(text): addTargetRole(text)
        case let .removeTargetRole(text): removeTargetRole(text)
        case let .addSkill(text): addSkill(text)
        case let .removeSkill(name): removeSkill(name)
        case let .saveExperience(row, old):
            save(row.cleaned, replacing: old, in: \.experience) { new, old in
                ProfilePatch(experience: [new], remove: old.map { .init(experience: [$0]) })
            }
        case let .removeExperience(row):
            remove(row, from: \.experience, patch: ProfilePatch(remove: .init(experience: [row])))
        case let .saveEducation(row, old):
            save(row.cleaned, replacing: old, in: \.education) { new, old in
                ProfilePatch(education: [new], remove: old.map { .init(education: [$0]) })
            }
        case let .removeEducation(row):
            remove(row, from: \.education, patch: ProfilePatch(remove: .init(education: [row])))
        }
    }
}

private extension Profile {
    mutating func setHeadline(_ text: String) -> ProfilePatch? {
        guard let text = cleaned(text), text != headline else { return nil }
        headline = text
        return ProfilePatch(headline: text)
    }

    mutating func addTargetRole(_ text: String) -> ProfilePatch? {
        guard let text = cleaned(text), !targetRoles.contains(where: { same($0, text) }) else { return nil }
        targetRoles.append(text)
        return ProfilePatch(targetRoles: [text])
    }

    mutating func removeTargetRole(_ text: String) -> ProfilePatch? {
        guard targetRoles.contains(where: { same($0, text) }) else { return nil }
        targetRoles.removeAll { same($0, text) }
        return ProfilePatch(remove: .init(targetRoles: [text]))
    }

    mutating func addSkill(_ text: String) -> ProfilePatch? {
        guard let text = cleaned(text), !skills.contains(where: { same($0.name, text) }) else { return nil }
        let skill = Skill(name: text, source: .selfReported)
        skills.append(skill)
        return ProfilePatch(skills: [skill])
    }

    mutating func removeSkill(_ name: String) -> ProfilePatch? {
        guard skills.contains(where: { same($0.name, name) }) else { return nil }
        skills.removeAll { same($0.name, name) }
        return ProfilePatch(remove: .init(skills: [name]))
    }

    /// Edits keep their place in the list, so a row doesn't jump to the bottom when someone fixes a typo.
    mutating func save<Row: Equatable>(
        _ row: Row?,
        replacing old: Row?,
        in rows: WritableKeyPath<Profile, [Row]>,
        patch: (Row, Row?) -> ProfilePatch,
    ) -> ProfilePatch? {
        guard let row, row != old else { return nil }
        if let old, let index = self[keyPath: rows].firstIndex(of: old) {
            self[keyPath: rows][index] = row
        } else {
            self[keyPath: rows].append(row)
        }
        return patch(row, old)
    }

    mutating func remove<Row: Equatable>(_ row: Row, from rows: WritableKeyPath<Profile, [Row]>, patch: ProfilePatch) -> ProfilePatch? {
        guard self[keyPath: rows].contains(row) else { return nil }
        self[keyPath: rows].removeAll { $0 == row }
        return patch
    }
}

private func same(_ lhs: String, _ rhs: String) -> Bool {
    lhs.compare(rhs, options: [.caseInsensitive, .diacriticInsensitive]) == .orderedSame
}

private func cleaned(_ text: String) -> String? {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}

private extension Profile.Experience {
    var cleaned: Self? {
        guard let role = RavenKit.cleaned(role), let org = RavenKit.cleaned(org) else { return nil }
        return Self(role: role, org: org, start: RavenKit.cleaned(start ?? ""), end: RavenKit.cleaned(end ?? ""), highlights: highlights)
    }
}

private extension Profile.Education {
    var cleaned: Self? {
        guard let school = RavenKit.cleaned(school) else { return nil }
        return Self(
            school: school,
            program: RavenKit.cleaned(program ?? ""),
            year: RavenKit.cleaned(year ?? ""),
            expectedGraduation: RavenKit.cleaned(expectedGraduation ?? ""),
        )
    }
}
