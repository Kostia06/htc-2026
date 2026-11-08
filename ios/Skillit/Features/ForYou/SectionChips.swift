import SkillitKit
import SwiftUI

/// The feed's sections as a row of chips, then Radar (the companies Skillit tracks near you).
/// The accent highlight slides to whichever is chosen.
struct SectionChips: View {
    let selection: FeedSection
    let isRadar: Bool
    let onSelect: (FeedSection) -> Void
    let onRadar: () -> Void
    @Namespace private var highlight

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(FeedSection.allCases) { section in
                    chip(section.title, isSelected: !isRadar && section == selection) { onSelect(section) }
                }
                chip("Radar", isSelected: isRadar, action: onRadar)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 4)
        }
        .scrollIndicators(.hidden)
        .background(Theme.ground)
        .animation(.snappy(duration: 0.3), value: selection)
        .animation(.snappy(duration: 0.3), value: isRadar)
        .sensoryFeedback(.selection, trigger: selection)
        .sensoryFeedback(.selection, trigger: isRadar)
    }

    private func chip(_ title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
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
