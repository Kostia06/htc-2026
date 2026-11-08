import PDFKit
import SkillitKit
import SwiftUI

/// The finished resume as it will be sent: the PDF in the chosen layout, pinch to zoom, and PDF or Word to share.
struct ResumeExportView: View {
    typealias Fetch = (ResumeFileFormat, ResumeTemplate) async throws(SkillitError) -> URL

    let fetch: Fetch
    @Environment(\.dismiss) private var dismiss
    /// Remembered per resume, so a job that wanted the plain page keeps it.
    @AppStorage private var templateName: String
    @State private var pdf: LoadedPDF?
    @State private var failure: String?
    @State private var word: Result<URL, SkillitError>?

    init(templateKey: String, fetch: @escaping Fetch) {
        _templateName = AppStorage(wrappedValue: ResumeTemplate.skillit.rawValue, templateKey)
        self.fetch = fetch
    }

    private var template: ResumeTemplate {
        ResumeTemplate(rawValue: templateName) ?? .skillit
    }

    var body: some View {
        NavigationStack {
            pages
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.ground)
                .safeAreaInset(edge: .bottom) { controls }
                .navigationTitle("Resume")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { dismiss() }
                    }
                }
        }
        .task(id: templateName) { await load() }
    }

    @ViewBuilder private var pages: some View {
        if let pdf {
            PDFPages(document: pdf.document)
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
            ProgressView("Making your resume…")
                .tint(Theme.agent)
        }
    }

    private var controls: some View {
        VStack(spacing: 12) {
            Picker("Layout", selection: $templateName) {
                ForEach(ResumeTemplate.allCases) { option in
                    Text(option.title).tag(option.rawValue)
                }
            }
            .pickerStyle(.segmented)
            HStack(spacing: 12) {
                share(pdf.map { .success($0.file) }, format: .pdf)
                share(word, format: .docx)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.bar)
    }

    @ViewBuilder private func share(_ file: Result<URL, SkillitError>?, format: ResumeFileFormat) -> some View {
        let label = Label(format.title, systemImage: format == .pdf ? "doc.richtext" : "doc.text")
        if case let .success(url) = file {
            let isPrimary = format == .pdf
            ShareLink(item: url) { label.frame(maxWidth: .infinity) }
                .buttonStyle(.raised(isPrimary ? Theme.action : Theme.secondaryButton, foreground: isPrimary ? Theme.onAction : .white))
        } else {
            Button {} label: { label.frame(maxWidth: .infinity) }
                .buttonStyle(.raised(Theme.secondaryButton, foreground: .white))
                .disabled(true)
                .accessibilityHint(file == nil ? "Still being made" : "Couldn't be made. Try again later.")
        }
    }

    private func load() async {
        pdf = nil
        failure = nil
        word = nil
        let chosen = template
        do {
            let file = try await fetch(.pdf, chosen)
            // a layout switch mid-download restarts this task; the old answer must not land on the new layout
            guard !Task.isCancelled else { return }
            // a server error page saved as .pdf would otherwise show as a blank grey screen
            guard let document = PDFDocument(url: file), document.pageCount > 0 else {
                failure = "The file came back empty. Try again in a moment."
                return
            }
            pdf = LoadedPDF(file: file, document: document)
        } catch {
            if !Task.isCancelled {
                failure = error.message
            }
            return
        }
        let made: Result<URL, SkillitError>
        do {
            made = try await .success(fetch(.docx, chosen))
        } catch {
            made = .failure(error)
        }
        if !Task.isCancelled {
            word = made
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
