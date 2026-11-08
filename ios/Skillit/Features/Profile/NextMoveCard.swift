import SkillitKit
import SwiftUI

/// The single suggestion under the Profile header. Sand marks it as Skillit's idea; the button is the only
/// sage on the page so the eye lands on it first.
struct NextMoveCard: View {
    let move: ProfileNextMove
    let onTake: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Next move", systemImage: "arrow.turn.down.right")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.agent)
            Text(copy.title)
                .font(.title3.bold())
                .fixedSize(horizontal: false, vertical: true)
            Text(copy.detail)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Button(copy.button, action: onTake)
                .buttonStyle(.raised(Theme.action, foreground: Theme.onAction))
                .padding(.top, 4)
        }
        .skillitCard()
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Theme.agent.opacity(0.35)))
        .accessibilityElement(children: .contain)
    }

    private var copy: Copy {
        switch move {
        case .chooseRole:
            Copy("Pick the role you're aiming for", "Your road, resume and practice are all measured against it.", "Choose a role")
        case let .closeGap(_, company, topic?):
            Copy(
                "Your \(company) resume is missing \(topic) evidence",
                "Accept Skillit's changes or add a line that shows it, before you apply.",
                "Close the gap",
            )
        case let .closeGap(_, company, nil):
            Copy(
                "Your \(company) resume misses some of what they ask for",
                "See what's missing and close the gap before you apply.",
                "Close the gap",
            )
        case let .tailor(_, company):
            Copy("Tailor your resume for \(company)", "You saved their posting. A tailored copy shows what they asked for.", "Tailor it")
        case .addExperience:
            Copy("Add where you've worked", "Jobs, internships and volunteering all count as evidence.", "Add experience")
        case let .backUpSkill(skill):
            Copy("Back up \(skill) with proof", "One line on where you used it: a project, a job, a course.", "Add proof")
        }
    }
}

private struct Copy {
    let title: String
    let detail: String
    let button: String

    init(_ title: String, _ detail: String, _ button: String) {
        self.title = title
        self.detail = detail
        self.button = button
    }
}

#if DEBUG
#Preview {
    VStack(spacing: 20) {
        NextMoveCard(move: .closeGap(tailoredId: "t", company: "ATB", topic: "SQL")) {}
        NextMoveCard(move: .chooseRole) {}
    }
    .padding(20)
    .background(Theme.ground)
}
#endif
