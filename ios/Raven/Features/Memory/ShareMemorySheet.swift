import RavenKit
import SwiftUI

/// Publishes one note as an anonymous interview report: pick the company and the role, and the note itself stays private.
struct ShareMemorySheet: View {
    enum Phase: Equatable {
        case editing
        case sending
        case sent
        case failed(String)
    }

    @Environment(\.dismiss) private var dismiss
    @State private var companies: [CompanySummary] = []
    @State private var companySlug = ""
    @State private var role = ""
    @State private var phase: Phase = .editing

    let memory: PrivateMemory
    let service: any MemoryService

    private var canSend: Bool {
        !companySlug.isEmpty && !role.trimmingCharacters(in: .whitespaces).isEmpty && phase != .sending
    }

    var body: some View {
        NavigationStack {
            Group {
                if phase == .sent {
                    sent
                } else {
                    form
                }
            }
            .background(Theme.ground)
            .navigationTitle("Share anonymously")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(phase == .sent ? "Done" : "Cancel") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(Theme.ground)
        .sensoryFeedback(.success, trigger: phase == .sent)
        .animation(.spring(duration: 0.4), value: phase)
        .task {
            guard companies.isEmpty, let loaded = try? await service.companies() else { return }
            companies = loaded
            if companySlug.isEmpty, let first = loaded.first {
                companySlug = first.slug
            }
        }
    }

    private var form: some View {
        Form {
            Section {
                Text(memory.text).font(.body)
            } header: {
                Text("Your note")
            }
            Section {
                Picker("Company", selection: $companySlug) {
                    if companies.isEmpty {
                        Text("Loading…").tag("")
                    }
                    ForEach(companies) { Text($0.name).tag($0.slug) }
                }
                TextField("Role you interviewed for", text: $role)
            } footer: {
                Label(
                    "A scrubbed copy goes into that company's interview reports: names and contact details are removed first, "
                        + "and it only shows once 3 people report similar questions. Your private note stays as it is.",
                    systemImage: "lock.shield",
                )
            }
            Section {
                Button {
                    Task { await send() }
                } label: {
                    if phase == .sending {
                        ProgressView().tint(.white)
                    } else {
                        Text("Share")
                    }
                }
                .buttonStyle(.raised(Theme.agent))
                .disabled(!canSend)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
                if case let .failed(message) = phase {
                    Text(message).font(.footnote).foregroundStyle(Theme.action).listRowBackground(Color.clear)
                }
            }
        }
        .scrollContentBackground(.hidden)
    }

    private var sent: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: 64)).foregroundStyle(Theme.agent)
            Text("Thanks — this helps the next person").font(.title3.bold()).multilineTextAlignment(.center)
            Button("Done") { dismiss() }.buttonStyle(.raised(Theme.agent)).frame(maxWidth: 220)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func send() async {
        guard canSend else { return }
        phase = .sending
        do {
            try await service.shareMemory(id: memory.id, companySlug: companySlug, role: role.trimmingCharacters(in: .whitespaces))
            phase = .sent
        } catch {
            phase = .failed(error.message)
        }
    }
}
