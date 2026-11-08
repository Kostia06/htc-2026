import PDFKit
import RavenKit
import SwiftUI

/// The finished resume as the PDF it'll be sent as: pages on the dark ground, pinch to zoom, share from the corner.
struct ResumePDFViewer: View {
    let fetch: () async throws(RavenError) -> URL
    @Environment(\.dismiss) private var dismiss
    @State private var file: URL?
    @State private var failure: String?

    var body: some View {
        NavigationStack {
            Group {
                if let file {
                    PDFPages(url: file)
                        .ignoresSafeArea(edges: .bottom)
                } else if let failure {
                    ContentUnavailableView("Couldn't make the PDF", systemImage: "doc.badge.ellipsis", description: Text(failure))
                } else {
                    ProgressView("Making your PDF…")
                        .tint(Theme.agent)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.ground)
            .navigationTitle("Resume.pdf")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                if let file {
                    ToolbarItem(placement: .primaryAction) {
                        ShareLink(item: file) { Label("Share", systemImage: "square.and.arrow.up") }
                    }
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        do {
            file = try await fetch()
        } catch {
            failure = error.message
        }
    }
}

/// PDFKit's own view, because it already does continuous pages, zoom and text selection well.
private struct PDFPages: UIViewRepresentable {
    let url: URL

    func makeUIView(context _: Context) -> PDFView {
        let view = PDFView()
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.pageShadowsEnabled = true
        view.backgroundColor = UIColor(Theme.ground)
        view.document = PDFDocument(url: url)
        return view
    }

    func updateUIView(_ view: PDFView, context _: Context) {
        guard view.document?.documentURL != url else { return }
        view.document = PDFDocument(url: url)
    }
}
