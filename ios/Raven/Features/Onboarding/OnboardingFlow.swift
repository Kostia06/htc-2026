import SwiftUI
import UniformTypeIdentifiers

struct OnboardingFlow: View {
    @Environment(AppModel.self) private var app
    @State private var model = OnboardingModel()
    @State private var isPickingFile = false

    var body: some View {
        NavigationStack {
            Group {
                switch model.step {
                case .choosing:
                    ResumePrompt(choose: { isPickingFile = true }, skip: model.startFromScratch)
                case let .reading(fileName):
                    ReadingResumeView(fileName: fileName)
                case .reviewing, .saving:
                    DraftReviewView(model: model, confirm: confirm)
                }
            }
            .animation(.smooth, value: model.step)
        }
        .fileImporter(isPresented: $isPickingFile, allowedContentTypes: Self.resumeTypes) { result in
            guard case let .success(url) = result, let client = app.client else { return }
            Task { await model.read(fileAt: url, using: client) }
        }
        .alert("Something went wrong", isPresented: Binding(get: { model.errorMessage != nil }, set: {
            if !$0 {
                model.errorMessage = nil
            }
        })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.errorMessage ?? "")
        }
    }

    private func confirm() {
        guard let client = app.client else { return }
        Task {
            if let saved = await model.confirm(using: client) {
                app.finishOnboarding(with: saved)
            }
        }
    }

    private static let resumeTypes: [UTType] = [.pdf, .rtf, .plainText, .html, .image, .heic]
        + ["docx", "odt", "pptx", "md"].compactMap { UTType(filenameExtension: $0) }
}

private struct ResumePrompt: View {
    let choose: () -> Void
    let skip: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Spacer()
            Text("Start with your resume.")
                .font(.largeTitle.bold())
            Text("Raven reads it and fills in your profile. You check everything before it's saved, and the file itself is never kept.")
                .font(.body)
                .foregroundStyle(.secondary)
            Spacer()
            Button(action: choose) {
                Label("Choose a file", systemImage: "doc.badge.arrow.up")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.glassProminent)
            .controlSize(.large)
            Button("Fill it in myself", action: skip)
                .frame(maxWidth: .infinity)
                .foregroundStyle(.secondary)
        }
        .padding(24)
    }
}

private struct ReadingResumeView: View {
    let fileName: String

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Label("Reading \(fileName)", systemImage: "sparkles")
                    .font(.headline)
                    .foregroundStyle(Theme.agent)
                ForEach(0 ..< 3, id: \.self) { _ in
                    SkeletonLines().ravenCard()
                }
            }
            .padding(24)
        }
    }
}
