import SkillitKit
import SwiftUI

/// A card face; an item the latest answer leaned on gets a sand outline.
struct Face<Content: View>: View {
    let isCited: Bool
    var surface: Color = Theme.raised
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) { content }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .background(surface, in: .rect(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(isCited ? Theme.agent : Theme.hairline, lineWidth: isCited ? 2 : 1))
    }
}

/// One of the person's own items, kept plain so their words read first.
struct YourFace: View {
    let item: YourItem
    let isCited: Bool

    var body: some View {
        Face(isCited: isCited) {
            Label(item.kind.title, systemImage: item.kind.symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Theme.action)
            Text(item.text).font(.body)
            if item.source == .profile {
                Text("From your profile").font(.caption).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Marks a line or path Skillit wrote so the road isn't empty. Quiet on purpose: it is a fact, not a warning.
struct ExampleTag: View {
    var body: some View {
        Text("Example")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 7)
            .padding(.vertical, 2)
            .background(Theme.chip, in: .capsule)
            .accessibilityLabel("Example written by Skillit, not a real person")
    }
}

/// Why an item is on screen. The link glyph is sand because Skillit drew the match.
struct ReasonLine: View {
    let text: String
    let isMatch: Bool

    var body: some View {
        if !text.isEmpty {
            Label {
                Text(text)
            } icon: {
                Image(systemName: isMatch ? "link" : "person.2.fill")
                    .foregroundStyle(isMatch ? Theme.agent : Color.secondary)
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
    }
}

struct SectionTitle: View {
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title)
            .font(.title3.bold())
            .foregroundStyle(.primary)
            .padding(.top, 12)
            .accessibilityAddTraits(.isHeader)
    }
}

/// An empty section that says how it fills up, so a new person knows what to do rather than seeing nothing.
struct TeachingEmpty: View {
    let symbol: String
    let text: String

    var body: some View {
        Label {
            Text(text).font(.subheadline).foregroundStyle(.secondary)
        } icon: {
            Image(systemName: symbol).foregroundStyle(Theme.action)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(Theme.hairline, style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
    }
}
