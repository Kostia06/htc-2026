import SkillitKit
import SwiftUI

/// Every past practice session, newest first, with how the scores have moved at the top.
struct PracticeHistoryView: View {
    @Environment(AppModel.self) private var app
    @State private var model: PracticeHistoryModel?
    private let injectedService: (any PracticeHistoryService)?

    init(service: (any PracticeHistoryService)? = nil) {
        injectedService = service
    }

    var body: some View {
        NavigationStack {
            content
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Theme.ground)
                .navigationTitle("Practice history")
                .navigationDestination(for: PracticeSessionSummary.self) { session in
                    PracticeSessionDetailView(session: session, service: injectedService ?? app.practiceHistoryService)
                }
        }
        .task {
            guard model == nil else { return }
            let model = PracticeHistoryModel(service: injectedService ?? app.practiceHistoryService)
            self.model = model
            await model.refresh()
        }
    }

    @ViewBuilder private var content: some View {
        if let model {
            ScrollView {
                LazyVStack(spacing: 12) {
                    if !model.hasLoaded, model.errorMessage == nil {
                        SkeletonLines(widths: [0.4, 0.9, 0.3]).skillitCard()
                        ForEach(0 ..< 4, id: \.self) { _ in SkeletonLines(widths: [0.6, 0.4], highlighted: -1).skillitCard() }
                    } else if model.sessions.isEmpty {
                        emptyState(model)
                    } else {
                        TrendCard(scores: model.scoreTrend)
                        ForEach(model.sessions) { session in
                            NavigationLink(value: session) { SessionRow(session: session) }
                                .buttonStyle(.plain)
                                .onAppear {
                                    if session.id == model.sessions.last?.id {
                                        Task { await model.loadMore() }
                                    }
                                }
                        }
                        if model.isLoadingMore {
                            ProgressView().padding()
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
                .animation(.spring(duration: 0.35), value: model.sessions)
            }
            .refreshable { await model.refresh() }
        } else {
            ProgressView()
        }
    }

    private func emptyState(_ model: PracticeHistoryModel) -> some View {
        ContentUnavailableView {
            Label(model.errorMessage == nil ? "No practice yet" : "Couldn't load your history", systemImage: "waveform")
        } description: {
            Text(model.errorMessage ?? "Your interview sessions will show up here, with scores over time.")
        } actions: {
            if model.errorMessage != nil {
                Button("Try again") { Task { await model.refresh() } }
                    .buttonStyle(.raised)
                    .frame(maxWidth: 220)
            }
        }
        .padding(.top, 80)
    }
}

/// Average, change since the first scored session, and the sparkline.
private struct TrendCard: View {
    let scores: [Double]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Average score").font(.subheadline).foregroundStyle(.secondary)
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(average.map { $0.formatted(.number.precision(.fractionLength(0))) } ?? "–")
                            .font(.system(.largeTitle, design: .rounded).bold())
                            .contentTransition(.numericText())
                        Text("/ 100").font(.title3).foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if let change {
                    Label(
                        change.formatted(.number.sign(strategy: .always()).precision(.fractionLength(0))),
                        systemImage: change >= 0 ? "arrow.up.right" : "arrow.down.right",
                    )
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(change >= 0 ? Theme.action : .secondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background((change >= 0 ? Theme.action : Color.secondary).opacity(0.14), in: .capsule)
                    .accessibilityLabel("Change since first session \(change.formatted(.number.precision(.fractionLength(0))))")
                }
            }
            if scores.count > 1 {
                ScoreSparkline(scores: scores).frame(height: 56)
            } else {
                Text("Finish another session to see a trend.").font(.footnote).foregroundStyle(.secondary)
            }
        }
        .skillitCard()
    }

    private var average: Double? {
        scores.isEmpty ? nil : scores.reduce(0, +) / Double(scores.count)
    }

    private var change: Double? {
        guard let first = scores.first, let last = scores.last, scores.count > 1 else { return nil }
        return last - first
    }
}

private struct SessionRow: View {
    let session: PracticeSessionSummary

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: session.mode == .interview ? "person.wave.2.fill" : "person.2.fill")
                .font(.title3)
                .frame(width: 44, height: 44)
                .background(Theme.raised.mix(with: .white, by: 0.06), in: .rect(cornerRadius: 12))
                .foregroundStyle(Theme.action)
            VStack(alignment: .leading, spacing: 4) {
                Text(session.companyName ?? "General interview").font(.headline)
                Text(subtitle).font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            scoreBadge
        }
        .skillitCard()
        .contentShape(.rect)
    }

    private var subtitle: String {
        var parts = [RelativeTime.phrase(for: session.createdAt) ?? ""]
        parts.append("\(session.turnCount) \(session.turnCount == 1 ? "answer" : "answers")")
        return parts.joined(separator: " · ")
    }

    @ViewBuilder private var scoreBadge: some View {
        if session.status == .active {
            Text("In progress").font(.caption.weight(.semibold)).foregroundStyle(Theme.agent)
        } else if let score = session.score {
            Text(score.formatted(.number.precision(.fractionLength(0))))
                .font(.system(.title3, design: .rounded).bold())
                .monospacedDigit()
        } else {
            Text("Unscored").font(.caption).foregroundStyle(.secondary)
        }
    }
}
