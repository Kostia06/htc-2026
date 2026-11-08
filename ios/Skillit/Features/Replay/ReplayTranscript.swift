import SkillitKit
import SwiftUI

/// Every line of the call, with the one being played picked out. Tapping a line plays from it.
struct ReplayTranscript: View {
    let lines: [ReplayLine]
    let currentLine: Int?
    let canSeek: Bool
    let onSeek: (Double) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(lines.indices, id: \.self) { index in
                line(lines[index], isCurrent: index == currentLine)
            }
        }
        .animation(.easeOut(duration: 0.2), value: currentLine)
    }

    private func line(_ line: ReplayLine, isCurrent: Bool) -> some View {
        Button {
            onSeek(line.seconds)
        } label: {
            VStack(alignment: .leading, spacing: 2) {
                Text(line.speaker == .agent ? "Interviewer" : "You")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(line.speaker == .agent ? Theme.agent : .secondary)
                Text(line.text)
                    .font(.body)
                    .foregroundStyle(isCurrent ? .primary : .secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isCurrent ? Theme.inset : .clear, in: .rect(cornerRadius: 12))
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .disabled(!canSeek)
        .accessibilityAddTraits(isCurrent ? .isSelected : [])
    }
}
