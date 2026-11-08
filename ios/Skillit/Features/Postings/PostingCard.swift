import SkillitKit
import SwiftUI

/// One posting in a line: title · company, and how many of its asks the person already has. Tap for the full page.
struct PostingCard: View {
    let posting: JobPosting
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: 14) {
                Image(systemName: "doc.text")
                    .font(.title3)
                    .foregroundStyle(Theme.agent)
                    .frame(width: 32)
                VStack(alignment: .leading, spacing: 3) {
                    Text("\(posting.title) · \(posting.company)")
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    Text(posting.requirementsLine)
                        .font(.footnote)
                        .foregroundStyle(posting.haveCount == posting.requirements.count ? Theme.positive : .secondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.raised, in: .rect(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.hairline))
        }
        .buttonStyle(.raisedCard(cornerRadius: 16))
        .accessibilityElement(children: .combine)
    }
}
