import RavenKit
import SwiftUI

/// One unit: its banner, then its steps winding down the path, with the open step's card right under its node.
struct UnitSection: View {
    let unit: RoadmapUnit
    let currentStepID: String?
    @Binding var selectedStepID: String?
    let onChange: (RoadmapStep, RoadmapStep.Status) -> Void

    var body: some View {
        VStack(spacing: 24) {
            UnitBanner(unit: unit, isActive: unit.steps.contains { $0.id == currentStepID })
            ForEach(Array(unit.steps.enumerated()), id: \.element.id) { position, step in
                stepRow(step, offset: PathCurve.offset(at: position))
            }
        }
    }

    private func stepRow(_ step: RoadmapStep, offset: CGFloat) -> some View {
        let state = NodeState(step: step, currentID: currentStepID)
        return VStack(spacing: 20) {
            PathNode(step: step, state: state) { toggle(step) }
                .offset(x: offset)
                .padding(.top, state == .current ? 40 : 0)
            if selectedStepID == step.id {
                StepCard(step: step, pointerOffset: offset) { status in onChange(step, status) }
                    .transition(.scale(scale: 0.9, anchor: .top).combined(with: .opacity))
            }
        }
        .id(step.id)
    }

    private func toggle(_ step: RoadmapStep) {
        withAnimation(.spring(duration: 0.3)) {
            selectedStepID = selectedStepID == step.id ? nil : step.id
        }
    }
}
