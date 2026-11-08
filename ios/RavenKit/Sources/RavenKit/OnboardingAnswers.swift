import Foundation

public enum OnboardingAnswer: Equatable, Sendable {
    case choice(String)
    case choices([String])
    case fields([String: String])
}

/// What the person picked so far, keyed by question id, the same way the web keeps its answers.
public struct OnboardingAnswers: Equatable, Sendable {
    private var values: [String: OnboardingAnswer] = [:]

    public init() {}

    public subscript(id: String) -> OnboardingAnswer? {
        get { values[id] }
        set { values[id] = newValue }
    }

    public var answeredIDs: Set<String> {
        Set(values.keys.filter(isAnswered))
    }

    public func isAnswered(_ id: String) -> Bool {
        switch values[id] {
        case let .choice(value): !value.isEmpty
        case let .choices(values): !values.isEmpty
        case let .fields(fields): fields.values.contains { !$0.trimmed.isEmpty }
        case nil: false
        }
    }

    public func choice(_ id: String) -> String? {
        guard case let .choice(value) = values[id], !value.isEmpty else { return nil }
        return value
    }

    public func choices(_ id: String) -> [String] {
        guard case let .choices(values) = values[id] else { return [] }
        return values
    }

    public func field(_ id: String, _ field: String) -> String {
        guard case let .fields(fields) = values[id] else { return "" }
        return fields[field]?.trimmed ?? ""
    }
}

public extension OnboardingAnswers {
    /// The profile to save, matching `toProfilePatch` and `syncProfile` in web/src/onboarding/store.js.
    /// With a resume draft, its experience, projects and certifications come along, and kept skills keep their evidence.
    func profile(resume draft: Profile?) -> Profile {
        let roles = choices("roles")
        let goals = [
            choice("situation").map { "Search so far: \($0)" },
            choice("where").map { "Looking in: \($0)" },
            choice("time").map { "Time per week: \($0)" },
            roles.contains(Self.notSure) ? "Not sure which role yet" : nil,
        ].compactMap(\.self)
        let picked = choices("skills").map { Profile.Skill(name: $0, source: .selfReported) }
        let school = field("school", "school")
        var profile = Profile(
            headline: choice("stage"),
            targetRoles: roles.filter { $0 != Self.notSure },
            goals: goals,
            skills: picked,
            education: school.isEmpty ? [] : [.init(
                school: school,
                program: field("school", "program").nilIfEmpty,
                expectedGraduation: field("school", "graduation").nilIfEmpty,
            )],
        )
        guard let draft else { return profile }
        profile.experience = draft.experience
        profile.projects = draft.projects
        profile.certifications = draft.certifications
        let kept = draft.skills.filter { skill in picked.contains { $0.name.isSameText(as: skill.name) } }
        let added = picked.filter { skill in !draft.skills.contains { $0.name.isSameText(as: skill.name) } }
        profile.skills = kept + added
        return profile
    }

    /// Pre-selected answers from a resume draft, matching `draftToAnswers` on the web: only what the resume clearly says.
    static func prefill(from draft: Profile) -> OnboardingAnswers {
        var answers = OnboardingAnswers()
        if let education = draft.education.first {
            if education.school.matches("high school|secondary") {
                answers["stage"] = .choice("High school")
            } else if education.expectedGraduation != nil {
                answers["stage"] = .choice("University or college")
            }
            answers["school"] = .fields([
                "school": education.school,
                "program": education.program ?? "",
                "graduation": education.expectedGraduation ?? education.year ?? "",
            ])
        }
        let roles = draft.targetRoles.map(matchRole).uniqued().prefix(3)
        if !roles.isEmpty {
            answers["roles"] = .choices(Array(roles))
        }
        let skillOptions = OnboardingQuestion.named("skills")?.options ?? []
        let skills = draft.skills.map { skill in skillOptions.first { $0.isSameText(as: skill.name) } ?? skill.name }
        let uniqueSkills = skills.uniqued().prefix(20)
        if !uniqueSkills.isEmpty {
            answers["skills"] = .choices(Array(uniqueSkills))
        }
        return answers
    }

    private static let notSure = "Not sure yet"

    private static let roleHints: [(pattern: String, option: String)] = [
        (#"data scien|machine learning|\bml\b|\bai\b"#, "Data scientist / AI"),
        ("data analy", "Data analyst"),
        (#"\bux\b|\bui\b|product design"#, "UX / UI designer"),
        ("product manag", "Product manager"),
        ("security|cyber", "Cybersecurity"),
        ("it support|help ?desk|technician", "IT support"),
        (#"\bweb\b|front.?end"#, "Web developer"),
        ("software|developer|engineer|programmer|back.?end|full.?stack", "Software developer"),
    ]

    private static func matchRole(_ role: String) -> String {
        let options = OnboardingQuestion.named("roles")?.options ?? []
        if let exact = options.first(where: { $0.isSameText(as: role) }) {
            return exact
        }
        return roleHints.first { role.matches($0.pattern) }?.option ?? role
    }
}

private extension String {
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }

    func isSameText(as other: String) -> Bool {
        trimmed.lowercased() == other.trimmed.lowercased()
    }

    func matches(_ pattern: String) -> Bool {
        range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }
}

private extension Sequence where Element: Hashable {
    func uniqued() -> [Element] {
        var seen = Set<Element>()
        return filter { seen.insert($0).inserted }
    }
}
