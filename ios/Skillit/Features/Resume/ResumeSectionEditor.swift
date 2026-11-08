import SkillitKit
import SwiftUI

/// The parts of the resume the person can open and edit; the coach's `Resume.Section` leaves out contact.
enum ResumeArea: String, Identifiable, CaseIterable {
    case contact, summary, experience, education, projects, skills

    var id: String {
        rawValue
    }

    var title: String {
        switch self {
        case .contact: "Contact"
        case .summary: "Summary"
        case .experience: "Experience"
        case .education: "Education"
        case .projects: "Projects"
        case .skills: "Skills"
        }
    }

    var emptyPrompt: String {
        switch self {
        case .contact: "Add your name and contact details"
        case .summary: "Add a one-line summary"
        case .experience: "Add a job, co-op or volunteer role"
        case .education: "Add your school"
        case .projects: "Add a project"
        case .skills: "Add your skills"
        }
    }
}

/// Edits one area in a sheet; changes land in the binding as you type, and the presenter saves them when the sheet closes.
struct ResumeSectionEditor: View {
    let area: ResumeArea
    @Binding var resume: Resume
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                switch area {
                case .contact: contactFields
                case .summary:
                    TextField("One or two lines about you and the role you want", text: $resume.summary, axis: .vertical)
                        .lineLimit(3 ... 8)
                case .skills:
                    CommaListField(title: "Skills", prompt: "Python, SQL, Excel", items: $resume.skills)
                case .experience: ExperienceEditor(entries: $resume.experience)
                case .education: EducationEditor(entries: $resume.education)
                case .projects: ProjectsEditor(entries: $resume.projects)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle(area.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                    .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.large])
        .presentationBackground(Theme.ground)
    }

    @ViewBuilder private var contactFields: some View {
        Section {
            TextField("Name", text: $resume.contact.name)
                .textContentType(.name)
            TextField("Email", text: $resume.contact.email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
            TextField("Phone", text: $resume.contact.phone)
                .textContentType(.telephoneNumber)
                .keyboardType(.phonePad)
            TextField("Location", text: $resume.contact.location, prompt: Text("City, province"))
                .textContentType(.addressCityAndState)
        }
        CommaListField(title: "Links", prompt: "github.com/you, linkedin.com/in/you", items: $resume.contact.links)
    }
}

/// One text field for a short list, so adding "SQL, Excel" is one gesture rather than a row per item.
struct CommaListField: View {
    let title: String
    let prompt: String
    @Binding var items: [String]
    @State private var text = ""

    var body: some View {
        Section {
            TextField(prompt, text: $text, axis: .vertical)
                .textInputAutocapitalization(.never)
                .onAppear { text = items.joined(separator: ", ") }
                .onChange(of: text) { _, new in
                    items = new.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                }
        } header: {
            Text(title)
        } footer: {
            Text("Separate with commas.")
        }
    }
}
