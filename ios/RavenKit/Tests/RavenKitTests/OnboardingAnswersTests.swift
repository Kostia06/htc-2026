import Foundation
@testable import RavenKit
import Testing

struct OnboardingQuestionTests {
    @Test func `mirrors the web questions in the same order`() {
        let ids = OnboardingQuestion.all.map(\.id)
        #expect(ids == ["resume", "stage", "school", "roles", "situation", "skills", "where", "time"])
    }

    @Test func `asks about school only while studying`() {
        var answers = OnboardingAnswers()
        #expect(!OnboardingQuestion.visible(for: answers).map(\.id).contains("school"))
        answers["stage"] = .choice("University or college")
        #expect(OnboardingQuestion.visible(for: answers).map(\.id).contains("school"))
        answers["stage"] = .choice("Recently graduated")
        #expect(!OnboardingQuestion.visible(for: answers).map(\.id).contains("school"))
    }

    @Test func `counts an empty pick as unanswered`() {
        var answers = OnboardingAnswers()
        answers["roles"] = .choices([])
        #expect(!answers.isAnswered("roles"))
        answers["roles"] = .choices(["Web developer"])
        #expect(answers.isAnswered("roles"))
    }
}

struct OnboardingProfileTests {
    private var answers: OnboardingAnswers {
        var answers = OnboardingAnswers()
        answers["stage"] = .choice("University or college")
        answers["school"] = .fields(["school": " University of Calgary ", "program": "Computer Science", "graduation": ""])
        answers["roles"] = .choices(["Data analyst", "Not sure yet"])
        answers["situation"] = .choice("Applying, but no callbacks")
        answers["skills"] = .choices(["Python", "Figma"])
        answers["where"] = .choice("Calgary")
        answers["time"] = .choice("3–5 hours")
        return answers
    }

    @Test func `saves the answers in the shape the web saves them`() {
        let profile = answers.profile(resume: nil)
        #expect(profile.headline == "University or college")
        #expect(profile.targetRoles == ["Data analyst"])
        #expect(profile.goals == [
            "Search so far: Applying, but no callbacks",
            "Looking in: Calgary",
            "Time per week: 3–5 hours",
            "Not sure which role yet",
        ])
        #expect(profile.skills == [.init(name: "Python", source: .selfReported), .init(name: "Figma", source: .selfReported)])
        #expect(profile.education == [.init(school: "University of Calgary", program: "Computer Science")])
    }

    @Test func `keeps the resume's evidence for skills the person kept and brings its experience along`() {
        let draft = Profile(
            skills: [
                .init(name: "python", source: .resume, evidence: "Built a Python API"),
                .init(name: "Rust", source: .resume, evidence: "Wrote Rust"),
            ],
            experience: [.init(role: "Co-op", org: "ATB")],
            projects: [.init(name: "Bus Buddy")],
            certifications: ["AWS"],
        )
        let profile = answers.profile(resume: draft)
        #expect(profile.skills == [
            .init(name: "python", source: .resume, evidence: "Built a Python API"),
            .init(name: "Figma", source: .selfReported),
        ])
        #expect(profile.experience == draft.experience)
        #expect(profile.projects == draft.projects)
        #expect(profile.certifications == ["AWS"])
    }
}

struct OnboardingPrefillTests {
    @Test func `turns a resume draft into picks, matching the offered options`() {
        let draft = Profile(
            targetRoles: ["Junior data analyst", "Machine learning intern", "Backend engineer", "Chef"],
            skills: [.init(name: "python", source: .resume), .init(name: "Postgres", source: .resume)],
            education: [.init(school: "University of Calgary", program: "BSc Computer Science", expectedGraduation: "April 2028")],
        )
        let answers = OnboardingAnswers.prefill(from: draft)
        #expect(answers["stage"] == .choice("University or college"))
        let school = ["school": "University of Calgary", "program": "BSc Computer Science", "graduation": "April 2028"]
        #expect(answers["school"] == .fields(school))
        #expect(answers["roles"] == .choices(["Data analyst", "Data scientist / AI", "Software developer"]))
        #expect(answers["skills"] == .choices(["Python", "Postgres"]))
    }

    @Test func `recognises high school and leaves stage blank when the resume doesn't say`() {
        let school = OnboardingAnswers.prefill(from: Profile(education: [.init(school: "Western Canada High School")]))
        #expect(school["stage"] == .choice("High school"))
        let unclear = OnboardingAnswers.prefill(from: Profile(education: [.init(school: "SAIT", year: "2024")]))
        #expect(unclear["stage"] == nil)
        #expect(unclear["school"] == .fields(["school": "SAIT", "program": "", "graduation": "2024"]))
    }

    @Test func `fills in nothing from an empty draft`() {
        #expect(OnboardingAnswers.prefill(from: .empty).answeredIDs.isEmpty)
    }
}
