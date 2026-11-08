import SkillitKit
import SwiftUI

/// A section per entry with its fields, swipe to delete, and an add button at the end.
private struct EntryList<Entry: Equatable, Fields: View>: View {
    @Binding var entries: [Entry]
    let name: String
    let blank: Entry
    @ViewBuilder let fields: (Binding<Entry>) -> Fields

    var body: some View {
        ForEach(entries.indices, id: \.self) { index in
            Section {
                fields($entries.element(at: index, fallback: blank))
            } header: {
                HStack {
                    Text("\(name) \(index + 1)")
                    Spacer()
                    Button("Remove", role: .destructive) {
                        withAnimation(.spring(duration: 0.3)) { _ = entries.remove(at: index) }
                    }
                    .font(.footnote)
                    .textCase(nil)
                }
            }
        }
        Section {
            Button {
                withAnimation(.spring(duration: 0.3)) { entries.append(blank) }
            } label: {
                Label("Add \(name.lowercased())", systemImage: "plus")
                    .foregroundStyle(Theme.action)
            }
        }
    }
}

/// One field per bullet so a newline never has to mean "new bullet"; empty ones are dropped when the sheet closes.
private struct BulletFields: View {
    @Binding var bullets: [String]

    var body: some View {
        ForEach(bullets.indices, id: \.self) { index in
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("•").foregroundStyle(.secondary)
                TextField("What you did and what came of it", text: $bullets.element(at: index, fallback: ""), axis: .vertical)
                    .lineLimit(1 ... 4)
            }
        }
        .onDelete { offsets in bullets.remove(atOffsets: offsets) }
        Button {
            bullets.append("")
        } label: {
            Label("Add bullet", systemImage: "plus")
                .font(.subheadline)
                .foregroundStyle(Theme.action)
        }
    }
}

private extension Binding {
    /// Index bindings outlive a removal by one render; reading past the end then would crash the Form.
    func element<Element>(at index: Int, fallback: Element) -> Binding<Element> where Value == [Element] {
        Binding<Element>(
            get: { wrappedValue.indices.contains(index) ? wrappedValue[index] : fallback },
            set: { if wrappedValue.indices.contains(index) { wrappedValue[index] = $0 } },
        )
    }
}

struct ExperienceEditor: View {
    @Binding var entries: [Resume.Experience]

    var body: some View {
        EntryList(entries: $entries, name: "Role", blank: Resume.Experience()) { job in
            TextField("Role", text: job.role)
            TextField("Organisation", text: job.org)
            HStack {
                TextField("Start", text: job.start)
                Divider()
                TextField("End", text: job.end)
            }
            BulletFields(bullets: job.bullets)
        }
    }
}

struct EducationEditor: View {
    @Binding var entries: [Resume.Education]

    var body: some View {
        EntryList(entries: $entries, name: "School", blank: Resume.Education()) { school in
            TextField("School", text: school.school)
            TextField("Program", text: school.program)
            TextField("Year or expected graduation", text: school.year)
        }
    }
}

struct ProjectsEditor: View {
    @Binding var entries: [Resume.Project]

    var body: some View {
        EntryList(entries: $entries, name: "Project", blank: Resume.Project()) { project in
            TextField("Name", text: project.name)
            TextField("Link", text: project.link)
                .textInputAutocapitalization(.never)
                .keyboardType(.URL)
            BulletFields(bullets: project.bullets)
        }
    }
}
