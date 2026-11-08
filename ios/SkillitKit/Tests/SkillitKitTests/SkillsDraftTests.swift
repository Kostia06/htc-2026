import Foundation
@testable import SkillitKit
import Testing

struct SkillsDraftTests {
    let python = Profile.Skill(name: "Python", source: .resume, evidence: "Built a pandas pipeline")
    let sql = Profile.Skill(name: "SQL", source: .interview)

    var draft: SkillsDraft {
        SkillsDraft(skills: [python, sql])
    }

    @Test func `an untouched draft sends nothing`() {
        #expect(draft.patch == nil)
        var profile = Profile(skills: [python, sql])
        #expect(profile.applySkills(draft) == nil)
    }

    @Test func `added skills are self-reported and blanks or duplicates are refused`() {
        var edited = draft
        let addedExcel = edited.add("  Excel ")
        #expect(addedExcel)
        let addedDuplicate = edited.add("python")
        #expect(!addedDuplicate)
        let addedBlank = edited.add("   ")
        #expect(!addedBlank)
        #expect(edited.patch == ProfilePatch(skills: [.init(name: "Excel", source: .selfReported)]))
    }

    @Test func `a rename removes the old name, adds the new one, and keeps the others' evidence`() throws {
        var edited = draft
        let row = try #require(edited.rows.first)
        let renamed = edited.rename(row.id, to: "Python 3")
        #expect(renamed)
        #expect(edited.patch == ProfilePatch(
            skills: [.init(name: "Python 3", source: .selfReported)],
            remove: .init(skills: ["Python"]),
        ))
        #expect(edited.skills == [.init(name: "Python 3", source: .selfReported), sql])
    }

    @Test func `renaming onto another skill is refused, renaming back restores the original`() throws {
        var edited = draft
        let row = try #require(edited.rows.first)
        let renamedOntoOther = edited.rename(row.id, to: "sql")
        #expect(!renamedOntoOther)
        let renamedAway = edited.rename(row.id, to: "Py")
        #expect(renamedAway)
        let renamedBack = edited.rename(row.id, to: "Python")
        #expect(renamedBack)
        #expect(edited.patch == nil)
        #expect(edited.skills.first == python)
    }

    @Test func `removing sends the name and re-adding brings the evidence back`() throws {
        var edited = draft
        let row = try #require(edited.rows.first)
        edited.remove(row.id)
        #expect(edited.patch == ProfilePatch(remove: .init(skills: ["Python"])))
        #expect(edited.suggestions(matching: "", among: []).first == "Python")
        let readded = edited.add("python")
        #expect(readded)
        #expect(edited.patch == nil)
        #expect(edited.skills.last == python)
    }

    @Test func `one patch carries every change at once`() throws {
        var edited = draft
        edited.remove(atOffsets: [1])
        edited.add("Figma")
        let row = try #require(edited.rows.first)
        edited.rename(row.id, to: "Python (pandas)")
        let patch = try #require(edited.patch)
        #expect(patch.remove?.skills == ["Python", "SQL"])
        #expect(patch.skills?.map(\.name) == ["Python (pandas)", "Figma"])
        #expect(patch.skills?.allSatisfy { $0.source == .selfReported && $0.evidence == nil } == true)

        var profile = Profile(skills: [python, sql])
        #expect(profile.applySkills(edited) == patch)
        #expect(profile.skills.map(\.name) == ["Python (pandas)", "Figma"])
    }

    @Test func `suggestions skip what's listed and narrow as you type`() {
        let known = ["JavaScript", "Python", "Java", "SQL"]
        #expect(draft.suggestions(matching: "", among: known) == ["JavaScript", "Java"])
        #expect(draft.suggestions(matching: "scr", among: known) == ["JavaScript"])
        #expect(!SkillsDraft.commonSkills.isEmpty)
    }

    @Test func `stops at the server's limit`() {
        var edited = SkillsDraft(skills: (1 ... SkillsDraft.limit).map { .init(name: "Skill \($0)", source: .resume) })
        #expect(!edited.canAdd)
        let addedOverLimit = edited.add("One more")
        #expect(!addedOverLimit)
    }
}
