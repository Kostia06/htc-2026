import RavenKit
import SwiftUI

/// What went into the anonymous pool once the recap is done, or what stayed in the person's own notes when nothing could be shared.
/// Undo isn't offered: the server has no take-back for a shared experience yet.
struct RecapSharedCard: View {
    let reply: RecapReply

    private var extracted: RecapExtracted? {
        reply.extracted
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label(reply.shared ? "Shared anonymously" : "Kept in your notes", systemImage: reply.shared ? "person.2.fill" : "lock.fill")
                .font(.headline)
                .foregroundStyle(reply.shared ? Theme.agent : .secondary)
            if let headline {
                Text(headline)
                    .font(.title3.weight(.semibold))
            }
            if let questions = extracted?.questions, !questions.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(questions.enumerated()), id: \.offset) { _, question in
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Image(systemName: "questionmark.bubble")
                                .foregroundStyle(.secondary)
                            Text(question)
                        }
                        .font(.subheadline)
                    }
                }
            }
            if let tip = extracted?.tip, !tip.isEmpty {
                Text("Tip: \(tip)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(reply.shared ? "Names and contact details were removed. Others preparing for the same interview will see the questions."
                : "Nothing went public. You can tell Raven more any time.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .ravenCard()
        .accessibilityElement(children: .combine)
    }

    private var headline: String? {
        guard let extracted else { return nil }
        var parts: [String] = []
        if let company = extracted.company {
            parts.append(company)
        }
        if let role = extracted.role {
            parts.append(role)
        }
        if let round = extracted.round {
            parts.append("\(round) round")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}
