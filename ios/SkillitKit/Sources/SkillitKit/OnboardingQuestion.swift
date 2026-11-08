import Foundation

/// One onboarding screen. The list mirrors web/src/onboarding/questions.js so both clients ask the same things.
public struct OnboardingQuestion: Identifiable, Sendable {
    public enum Kind: Sendable {
        case resume
        case single(options: [String])
        case multi(options: [String], max: Int)
        case text(fields: [Field])
    }

    public struct Field: Identifiable, Sendable {
        public let id: String
        public let label: String
        public let placeholder: String
    }

    public let id: String
    public let title: String
    public let hint: String
    public let kind: Kind
    /// lets people type their own option
    public let allowsOther: Bool
    /// the profile needs at least a headline to count as onboarded, so this one can't be skipped
    public let isRequired: Bool
    let isAsked: @Sendable (OnboardingAnswers) -> Bool

    init(
        id: String,
        title: String,
        hint: String,
        kind: Kind,
        allowsOther: Bool = false,
        isRequired: Bool = false,
        isAsked: @escaping @Sendable (OnboardingAnswers) -> Bool = { _ in true },
    ) {
        self.id = id
        self.title = title
        self.hint = hint
        self.kind = kind
        self.allowsOther = allowsOther
        self.isRequired = isRequired
        self.isAsked = isAsked
    }

    public var options: [String] {
        switch kind {
        case let .single(options), let .multi(options, _): options
        case .resume, .text: []
        }
    }

    public static func visible(for answers: OnboardingAnswers) -> [OnboardingQuestion] {
        all.filter { $0.isAsked(answers) }
    }

    static func named(_ id: String) -> OnboardingQuestion? {
        all.first { $0.id == id }
    }
}

public extension OnboardingQuestion {
    static let all: [OnboardingQuestion] = [
        .init(
            id: "resume",
            title: "Do you have a resume?",
            hint: "Upload it and we'll fill in the next questions for you. You can change anything before you finish.",
            kind: .resume,
        ),
        .init(
            id: "stage",
            title: "Where are you right now?",
            hint: "So your first actions fit where you are.",
            kind: .single(options: [
                "High school", "University or college", "Recently graduated", "Working, want to switch", "Something else",
            ]),
            allowsOther: true,
            isRequired: true,
        ),
        .init(
            id: "school",
            title: "What are you studying?",
            hint: "Optional. School and program help us match events and companies.",
            kind: .text(fields: [
                .init(id: "school", label: "School", placeholder: "e.g. University of Calgary"),
                .init(id: "program", label: "Program", placeholder: "e.g. Computer Science"),
                .init(id: "graduation", label: "Expected to finish", placeholder: "e.g. 2027"),
            ]),
            isAsked: { ["High school", "University or college"].contains($0.choice("stage")) },
        ),
        .init(
            id: "roles",
            title: "What role do you want to get into?",
            hint: "Pick up to 3.",
            kind: .multi(options: [
                "Software developer", "Web developer", "Data analyst", "Data scientist / AI", "UX / UI designer",
                "Product manager", "IT support", "Cybersecurity", "Not sure yet",
            ], max: 3),
            allowsOther: true,
        ),
        .init(
            id: "situation",
            title: "How is the search going so far?",
            hint: "Skillit starts from where you actually are.",
            kind: .single(options: [
                "Just starting, no idea where to begin", "Applying, but no callbacks", "Getting interviews",
                "Have a job, looking for the next one",
            ]),
        ),
        .init(
            id: "skills",
            title: "What can you already do?",
            hint: "Tap anything that fits, or add your own.",
            kind: .multi(options: [
                "JavaScript", "Python", "Java", "SQL", "React", "HTML / CSS", "Git", "Excel", "Figma", "Communication",
                "Teamwork", "Public speaking",
            ], max: 20),
            allowsOther: true,
        ),
        .init(
            id: "where",
            title: "Where are you looking?",
            hint: "Skillit picks local events and companies.",
            kind: .single(options: ["Calgary", "Remote", "Anywhere in Canada"]),
            allowsOther: true,
        ),
        .init(
            id: "time",
            title: "How much time can you give it each week?",
            hint: "We size your weekly plan to this.",
            kind: .single(options: ["1–2 hours", "3–5 hours", "6+ hours"]),
        ),
    ]
}
