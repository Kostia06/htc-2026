import RavenKit
import SwiftUI

/// The resume up front on Profile: one glance to see it exists, one tap to read the PDF or open the builder.
struct ResumeCard: View {
    let service: any ResumeService
    @State private var isViewingPDF = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 14) {
                PageThumbnail()
                VStack(alignment: .leading, spacing: 4) {
                    Text("Your resume")
                        .font(.title3.bold())
                    Text("Built from your profile. Raven can make it sharper for the roles you want.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            HStack(spacing: 12) {
                Button("View PDF") { isViewingPDF = true }
                    .buttonStyle(.raised)
                NavigationLink { ResumeView() } label: {
                    Text("Edit")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.raised(Color(white: 0.22)))
            }
        }
        .ravenCard()
        .sheet(isPresented: $isViewingPDF) {
            ResumePDFViewer { () async throws(RavenError) -> URL in
                try await ResumeModel(service: service).pdfFile()
            }
        }
    }
}

/// A small drawn page so the card reads as "a document" before anything loads.
private struct PageThumbnail: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Capsule().fill(Theme.action).frame(width: 26, height: 4)
            ForEach([30, 22, 28, 18, 26], id: \.self) { width in
                Capsule().fill(Color.black.opacity(0.18)).frame(width: CGFloat(width), height: 3)
            }
        }
        .padding(9)
        .frame(width: 52, height: 68, alignment: .topLeading)
        .background(.white, in: .rect(cornerRadius: 6))
        .shadow(color: .black.opacity(0.3), radius: 6, y: 3)
        .accessibilityHidden(true)
    }
}
