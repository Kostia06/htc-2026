import SkillitKit
import SwiftUI

/// The resume drawn like the PDF's default layout: centred navy header, then Education, Experience, Projects and Skills
/// under navy rules. A page, not app chrome, so it keeps its own light colours. Tap a section to edit it.
struct ResumePreview: View {
    let resume: Resume
    let onEdit: (ResumeArea) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            PaperSection(area: .education, isEmpty: resume.education.isEmpty, onEdit: onEdit) {
                ForEach(Array(resume.education.enumerated()), id: \.offset) { _, school in
                    let hasProgram = !school.program.isEmpty
                    PaperEntry(
                        title: hasProgram ? school.program : school.school,
                        subtitle: hasProgram ? school.school : "",
                        date: school.year
                    )
                }
            }
            PaperSection(area: .experience, isEmpty: resume.experience.isEmpty, onEdit: onEdit) {
                ForEach(Array(resume.experience.enumerated()), id: \.offset) { _, job in
                    let hasRole = !job.role.isEmpty
                    PaperEntry(
                        title: hasRole ? job.role : job.org,
                        subtitle: hasRole ? job.org : "",
                        date: dates(job.start, job.end),
                        bullets: job.bullets
                    )
                }
            }
            PaperSection(area: .projects, isEmpty: resume.projects.isEmpty, onEdit: onEdit) {
                ForEach(Array(resume.projects.enumerated()), id: \.offset) { _, project in
                    PaperEntry(title: project.name, subtitle: project.link, date: "", bullets: project.bullets)
                }
            }
            PaperSection(area: .skills, isEmpty: resume.skills.isEmpty, onEdit: onEdit) {
                SkillRows(skills: resume.skills)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .foregroundStyle(Paper.ink)
        .background(.white, in: .rect(cornerRadius: 8))
        .environment(\.colorScheme, .light)
        .animation(.spring(duration: 0.4), value: resume)
    }

    private var header: some View {
        VStack(spacing: 6) {
            PaperButton(area: .contact, onEdit: onEdit) {
                VStack(spacing: 3) {
                    Text(resume.contact.name.isEmpty ? "Your name" : resume.contact.name)
                        .font(.title3.bold())
                        .tracking(0.6)
                        .foregroundStyle(Paper.navy)
                    let contact = resume.contact
                    let line = ([contact.location, contact.phone, contact.email] + contact.links).filter { !$0.isEmpty }
                    if line.isEmpty {
                        AddLine(prompt: ResumeArea.contact.emptyPrompt)
                    } else {
                        Text(line.joined(separator: " | ")).font(.caption2)
                    }
                }
            }
            PaperButton(area: .summary, onEdit: onEdit) {
                if resume.summary.isEmpty {
                    AddLine(prompt: ResumeArea.summary.emptyPrompt)
                } else {
                    Text(resume.summary).font(.caption).italic().foregroundStyle(Paper.muted)
                }
            }
            Rectangle().fill(Paper.navy).frame(height: 1.5)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
    }

    private func dates(_ start: String, _ end: String) -> String {
        [start, end].filter { !$0.isEmpty }.joined(separator: " – ")
    }
}

/// The page's own colours, taken from the PDF template so the preview and the file match.
private enum Paper {
    static let navy = Color(red: 30 / 255, green: 58 / 255, blue: 95 / 255)
    static let ink = Color(white: 0.1)
    static let muted = Color(white: 0.27)
    static let date = Color(white: 0.33)
}

/// Bold title with the date flush right, an italic subtitle under it, then bullets.
private struct PaperEntry: View {
    let title: String
    let subtitle: String
    let date: String
    var bullets: [String] = []
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            // at accessibility sizes the date drops under the title instead of squeezing it into a sliver
            let layout = typeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2))
                : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: 8))
            layout {
                Text(title).font(.caption.bold())
                if !typeSize.isAccessibilitySize {
                    Spacer(minLength: 0)
                }
                if !date.isEmpty {
                    Text(date).font(.caption2).foregroundStyle(Paper.date)
                }
            }
            if !subtitle.isEmpty {
                Text(subtitle).font(.caption).italic().foregroundStyle(Paper.muted)
            }
            ForEach(Array(bullets.filter { !$0.isEmpty }.enumerated()), id: \.offset) { _, bullet in
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("•")
                    Text(bullet).contentTransition(.interpolate)
                }
                .font(.caption)
                .padding(.leading, 4)
            }
        }
        .padding(.bottom, 4)
    }
}

/// "Languages: Python, SQL" gets a bold label; loose skills share one line, the way the PDF prints them.
private struct SkillRows: View {
    let skills: [String]

    var body: some View {
        let labelled = skills.compactMap { skill -> (String, String)? in
            guard let colon = skill.firstIndex(of: ":"), skill.distance(from: skill.startIndex, to: colon) <= 32 else { return nil }
            let value = skill[skill.index(after: colon)...].trimmingCharacters(in: .whitespaces)
            return value.isEmpty ? nil : (String(skill[..<colon]), value)
        }
        let loose = skills.filter { skill in !labelled.contains { skill.hasPrefix($0.0 + ":") } }
        VStack(alignment: .leading, spacing: 2) {
            ForEach(labelled, id: \.0) { label, value in
                Text("\(Text("\(label):").bold()) \(value)")
            }
            if !loose.isEmpty {
                Text(loose.joined(separator: ", "))
            }
        }
        .font(.caption)
    }
}

/// One titled block of the page. Empty sections show a quiet "Add" line so the whole page stays tappable.
private struct PaperSection<Content: View>: View {
    let area: ResumeArea
    let isEmpty: Bool
    let onEdit: (ResumeArea) -> Void
    @ViewBuilder let content: Content

    var body: some View {
        PaperButton(area: area, onEdit: onEdit) {
            VStack(alignment: .leading, spacing: 5) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(area.title.uppercased())
                        .font(.caption.bold())
                        .tracking(0.8)
                        .foregroundStyle(Paper.navy)
                    Rectangle().fill(Paper.navy).frame(height: 1.5)
                }
                if isEmpty {
                    AddLine(prompt: area.emptyPrompt)
                } else {
                    content
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct AddLine: View {
    let prompt: String

    var body: some View {
        Label(prompt, systemImage: "plus")
            .font(.caption.weight(.semibold))
            .foregroundStyle(Paper.navy)
    }
}

private struct PaperButton<Label: View>: View {
    let area: ResumeArea
    let onEdit: (ResumeArea) -> Void
    @ViewBuilder let label: Label

    var body: some View {
        Button { onEdit(area) } label: { label.contentShape(.rect) }
            .buttonStyle(PaperPressStyle())
            .accessibilityHint("Edits \(area.title.lowercased())")
    }
}

private struct PaperPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.55 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
