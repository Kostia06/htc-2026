import SkillitKit
import SwiftUI

/// The resume as a sheet of paper on the dark ground, laid out the way the PDF will be. Tap a section to edit it.
struct ResumePreview: View {
    let resume: Resume
    let onEdit: (ResumeArea) -> Void
    @Environment(\.dynamicTypeSize) private var typeSize

    private let ink = Color(white: 0.12)
    private let faint = Color(white: 0.45)

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            PaperSection(area: .contact, isEmpty: resume.contact.name.isEmpty, onEdit: onEdit) { header }
            PaperSection(area: .summary, isEmpty: resume.summary.isEmpty, onEdit: onEdit) {
                Text(resume.summary).font(.footnote)
            }
            PaperSection(area: .experience, isEmpty: resume.experience.isEmpty, onEdit: onEdit) {
                ForEach(Array(resume.experience.enumerated()), id: \.offset) { _, job in
                    let title = [job.role, job.org].filter { !$0.isEmpty }.joined(separator: ", ")
                    entry(title: title, note: dates(job.start, job.end), bullets: job.bullets)
                }
            }
            PaperSection(area: .education, isEmpty: resume.education.isEmpty, onEdit: onEdit) {
                ForEach(Array(resume.education.enumerated()), id: \.offset) { _, school in
                    entry(title: school.school, note: school.year, bullets: school.program.isEmpty ? [] : [school.program], plain: true)
                }
            }
            PaperSection(area: .projects, isEmpty: resume.projects.isEmpty, onEdit: onEdit) {
                ForEach(Array(resume.projects.enumerated()), id: \.offset) { _, project in
                    entry(title: project.name, note: project.link, bullets: project.bullets)
                }
            }
            PaperSection(area: .skills, isEmpty: resume.skills.isEmpty, onEdit: onEdit) {
                Text(resume.skills.joined(separator: ", ")).font(.footnote)
            }
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .foregroundStyle(ink)
        .background(Color(white: 0.97), in: .rect(cornerRadius: 20))
        .environment(\.colorScheme, .light)
        .animation(.spring(duration: 0.4), value: resume)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(resume.contact.name.isEmpty ? "Your name" : resume.contact.name)
                .font(.title2.bold())
            let line = ([resume.contact.email, resume.contact.phone] + resume.contact.links).filter { !$0.isEmpty }
            if !line.isEmpty {
                Text(line.joined(separator: "  ·  "))
                    .font(.caption)
                    .foregroundStyle(faint)
            }
        }
    }

    private func entry(title: String, note: String, bullets: [String], plain: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            // at accessibility sizes the dates drop under the title instead of squeezing it into a sliver
            let layout = typeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2))
                : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 8))
            layout {
                Text(title).font(.footnote.weight(.semibold))
                if !typeSize.isAccessibilitySize {
                    Spacer(minLength: 0)
                }
                Text(note).font(.caption2).foregroundStyle(faint)
            }
            ForEach(Array(bullets.enumerated()), id: \.offset) { _, bullet in
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    if !plain {
                        Text("•")
                    }
                    Text(bullet)
                        .contentTransition(.interpolate)
                }
                .font(.footnote)
                .padding(.leading, plain ? 0 : 2)
            }
        }
        .padding(.bottom, 4)
    }

    private func dates(_ start: String, _ end: String) -> String {
        [start, end].filter { !$0.isEmpty }.joined(separator: " – ")
    }
}

/// One titled block of the paper. Empty sections show a quiet "Add" line so the whole page stays tappable.
private struct PaperSection<Content: View>: View {
    let area: ResumeArea
    let isEmpty: Bool
    let onEdit: (ResumeArea) -> Void
    @ViewBuilder let content: Content

    var body: some View {
        Button {
            onEdit(area)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                if area != .contact {
                    Text(area.title.uppercased())
                        .font(.caption2.weight(.bold))
                        .tracking(1.2)
                        .foregroundStyle(Color(white: 0.4))
                    Rectangle().fill(Color(white: 0.8)).frame(height: 0.8)
                }
                if isEmpty {
                    Label(area.emptyPrompt, systemImage: "plus")
                        .font(.footnote)
                        .foregroundStyle(Theme.action)
                } else {
                    content
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(.rect)
        }
        .buttonStyle(PaperPressStyle())
        .accessibilityHint("Edits this section")
    }
}

private struct PaperPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.55 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
