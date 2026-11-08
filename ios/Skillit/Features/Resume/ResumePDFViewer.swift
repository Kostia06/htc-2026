import PDFKit
import SkillitKit
import SwiftUI

/// The finished resume as the PDF it'll be sent as: pages on the dark ground, pinch to zoom, share from the corner.
struct ResumePDFViewer: View {
    let fetch: () async throws(SkillitError) -> URL
    @Environment(\.dismiss) private var dismiss
    @State private var loaded: LoadedPDF?
    @State private var failure: String?

    var body: some View {
        NavigationStack {
            Group {
                if let loaded {
                    PDFPages(document: loaded.document)
                        .ignoresSafeArea(edges: .bottom)
                } else if let failure {
                    ContentUnavailableView {
                        Label("Couldn't make the PDF", systemImage: "doc.badge.ellipsis")
                    } description: {
                        Text(failure)
                    } actions: {
                        Button("Try again") { Task { await load() } }
                            .buttonStyle(.raised)
                            .frame(maxWidth: 220)
                    }
                } else {
                    ProgressView("Making your PDF…")
                        .tint(Theme.agent)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.ground)
            .navigationTitle("Resume")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                if let loaded {
                    ToolbarItem(placement: .primaryAction) {
                        ShareLink(item: loaded.file) { Label("Share", systemImage: "square.and.arrow.up") }
                    }
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        failure = nil
        do {
            let file = try await fetch()
            // a server error page saved as .pdf would otherwise show as a blank grey screen
            guard let document = PDFDocument(url: file), document.pageCount > 0 else {
                failure = "The file came back empty. Try again in a moment."
                return
            }
            loaded = LoadedPDF(file: file, document: document)
        } catch {
            failure = error.message
        }
    }
}

private struct LoadedPDF {
    let file: URL
    let document: PDFDocument
}

/// PDFKit's own view, because it already does continuous pages, zoom and text selection well.
private struct PDFPages: UIViewRepresentable {
    let document: PDFDocument

    func makeUIView(context _: Context) -> PDFView {
        let view = PDFView()
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        view.pageShadowsEnabled = true
        view.backgroundColor = UIColor(Theme.ground)
        view.document = document
        // set after the document so the first fit uses real pages, not an empty view
        view.autoScales = true
        return view
    }

    func updateUIView(_ view: PDFView, context _: Context) {
        guard view.document !== document else { return }
        view.document = document
    }
}
