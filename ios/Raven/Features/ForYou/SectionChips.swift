import RavenKit
import SwiftUI

/// The feed's sections as a row of chips; the accent highlight slides to whichever is chosen.
struct SectionChips: View {
    let selection: FeedSection
    let onSelect: (FeedSection) -> Void
    @Namespace private var highlight

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(FeedSection.allCases) { section in
                    chip(section)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 4)
        }
        .scrollIndicators(.hidden)
        .background(Theme.ground)
        .animation(.snappy(duration: 0.3), value: selection)
        .sensoryFeedback(.selection, trigger: selection)
    }

    private func chip(_ section: FeedSection) -> some View {
        let isSelected = section == selection
        return Button {
            onSelect(section)
        } label: {
            Text(section.title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(isSelected ? Theme.onAction : .secondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background {
                    if isSelected {
                        Capsule().fill(Theme.action).matchedGeometryEffect(id: "chip", in: highlight)
                    } else {
                        Capsule().fill(Theme.raised)
                    }
                }
                // the pill stays slim; the tap target around it is the full 44pt
                .frame(minHeight: 44)
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
