import SkillitKit
import SwiftUI

extension InterviewLength {
    static let storageKey = "interviewLength"

    var title: String {
        switch self {
        case .quick: "Quick (1 min)"
        case .full: "Full"
        }
    }
}

/// Quick (1 min) / Full: a one-minute taster with two questions, or the whole interview with follow-ups.
struct InterviewLengthPicker: View {
    @Binding var length: InterviewLength

    var body: some View {
        Picker("Length", selection: $length) {
            ForEach(InterviewLength.allCases, id: \.self) { option in
                Text(option.title).tag(option)
            }
        }
        .pickerStyle(.segmented)
    }
}
