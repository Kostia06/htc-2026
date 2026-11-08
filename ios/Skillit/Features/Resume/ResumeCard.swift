import SkillitKit
import SwiftUI

/// The resume as two list rows on Profile: one to open the editor, one to read the PDF.
struct ResumeCard: View {
    let service: any ResumeService
    @State private var isViewingPDF = false
    @State private var updatedAt: String?

    var body: some View {
        Group {
            NavigationLink { ResumeView() } label: {
                HStack(spacing: 12) {
                    PageThumbnail()
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Resume").font(.headline)
                        Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
                    }
                }
                .frame(minHeight: 44)
            }
            .task { updatedAt = (try? await service.resume())?.resume.updatedAt }
            Button { isViewingPDF = true } label: {
                Label("View PDF", systemImage: "doc.richtext")
                    .frame(minHeight: 44)
            }
            .sheet(isPresented: $isViewingPDF) {
                ResumePDFViewer { () async throws(SkillitError) -> URL in
                    try await ResumeModel(service: service).pdfFile()
                }
            }
        }
    }

    private var subtitle: String {
        RelativeTime.phrase(for: updatedAt).map { "Updated \($0)" } ?? "Built from your profile"
    }
}

/// A small drawn page so the row reads as "a document" before anything loads.
private struct PageThumbnail: View {
    @ScaledMetric(relativeTo: .headline) private var width: CGFloat = 34

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Capsule().fill(Theme.action).frame(width: width * 0.5, height: 3)
            ForEach([0.6, 0.45, 0.55, 0.35], id: \.self) { fraction in
                Capsule().fill(Color.black.opacity(0.18)).frame(width: width * fraction, height: 2)
            }
        }
        .padding(6)
        .frame(width: width, height: width * 1.3, alignment: .topLeading)
        .background(.white, in: .rect(cornerRadius: 4))
        .accessibilityHidden(true)
    }
}
