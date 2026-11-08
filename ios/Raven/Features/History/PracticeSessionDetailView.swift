import RavenKit
import SwiftUI

/// One past session replayed: each question, what was said, the score it got and the tip at the time.
struct PracticeSessionDetailView: View {
    enum Phase: Equatable {
        case loading
        case ready(PracticeSessionDetail)
        case failed(String)
    }

    @State private var phase: Phase = .loading

    let session: PracticeSessionSummary
    let service: any PracticeHistoryService

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                switch phase {
                case .loading:
                    ForEach(0 ..< 3, id: \.self) { _ in SkeletonLines(widths: [0.7, 0.95, 0.9, 0.5]).ravenCard() }
                case let .failed(message):
                    ContentUnavailableView {
                        Label("Couldn't load this session", systemImage: "waveform")
                    } description: {
                        Text(message)
                    } actions: {
                        Button("Try again") { Task { await load() } }
                            .buttonStyle(.raised)
                            .frame(maxWidth: 220)
                    }
                case let .ready(detail):
                    if detail.turns.isEmpty {
                        Text("Nothing was said in this session.").foregroundStyle(.secondary).ravenCard()
                    }
                    ForEach(detail.turns) { turn in
                        TurnCard(turn: turn)
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 32)
            .animation(.spring(duration: 0.4), value: phase)
        }
        .background(Theme.ground)
        .navigationTitle(session.companyName ?? (session.mode == .interview ? "Interview" : "Networking"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.ground, for: .navigationBar)
        .task { await load() }
    }

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
                Text(session.mode == .interview ? "Interview practice" : "Networking practice").font(.headline)
                if let date = RelativeTime.date(from: session.createdAt) {
                    Text(date.formatted(.dateTime.weekday(.wide).day().month(.abbreviated).hour().minute()))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let score = session.score {
                VStack(alignment: .trailing, spacing: 0) {
                    Text(score.formatted(.number.precision(.fractionLength(1))))
                        .font(.system(.largeTitle, design: .rounded).bold())
                    Text("of 5").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.top, 8)
    }

    private func load() async {
        phase = .loading
        do {
            phase = try await .ready(service.practiceSession(id: session.id))
        } catch {
            phase = .failed(error.message)
        }
    }
}

private struct TurnCard: View {
    let turn: PracticeTurn

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                Text(turn.question).font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                Spacer(minLength: 12)
                if let average = turn.averageScore {
                    Text(average.formatted(.number.precision(.fractionLength(1))))
                        .font(.system(.title3, design: .rounded).bold())
                        .monospacedDigit()
                }
            }
            Text(turn.answer).font(.body)
            if let delivery = turn.delivery {
                Text(deliveryLine(delivery)).font(.caption).foregroundStyle(.secondary)
            }
            if let tip = turn.tip, !tip.isEmpty {
                Label(tip, systemImage: "lightbulb")
                    .font(.subheadline)
                    .foregroundStyle(Theme.agent)
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.agent.opacity(0.12), in: .rect(cornerRadius: 12))
            }
        }
        .ravenCard()
    }

    private func deliveryLine(_ delivery: TurnFeedback.Delivery) -> String {
        var parts = ["\(delivery.words) words"]
        if delivery.fillerWords > 0 {
            parts.append("\(delivery.fillerWords) filler")
        }
        if let wpm = delivery.wordsPerMinute {
            parts.append("\(Int(wpm)) wpm")
        }
        return parts.joined(separator: " · ")
    }
}
