import SwiftUI

/// Back, the progress bar, and a quiet purple note while the resume is still being read.
struct OnboardingHeader: View {
    let progress: Double
    let isReadingResume: Bool
    let canGoBack: Bool
    let back: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Button(action: back) {
                    Image(systemName: "chevron.left")
                        .font(.title3.weight(.semibold))
                        .frame(width: 44, height: 44)
                }
                .foregroundStyle(.secondary)
                .opacity(canGoBack ? 1 : 0)
                .disabled(!canGoBack)
                .accessibilityLabel("Back")
                ProgressBar(progress: progress)
            }
            if isReadingResume {
                Label("Reading your resume", systemImage: "sparkles")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Theme.agent)
                    .padding(.leading, 56)
                    .shimmering()
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .animation(.smooth, value: isReadingResume)
    }
}

private struct ProgressBar: View {
    let progress: Double

    var body: some View {
        Capsule()
            .fill(Color(white: 0.18))
            .frame(height: 14)
            .overlay(alignment: .leading) {
                GeometryReader { bar in
                    Capsule()
                        .fill(Theme.action)
                        .frame(width: max(bar.size.width * progress, bar.size.height))
                        .overlay(alignment: .top) {
                            // the glossy strip along the top that makes the bar read as chunky
                            Capsule()
                                .fill(.white.opacity(0.25))
                                .frame(height: 4)
                                .padding(.horizontal, 6)
                                .padding(.top, 3)
                        }
                }
            }
            .clipShape(.capsule)
            .animation(.spring(duration: 0.4), value: progress)
            .accessibilityElement()
            .accessibilityLabel("Progress")
            .accessibilityValue(Text(progress, format: .percent.precision(.fractionLength(0))))
    }
}
