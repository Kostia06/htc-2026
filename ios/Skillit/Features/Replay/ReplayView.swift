import SkillitKit
import SwiftUI

/// Go back over an interview: the recording with a dot at every moment, the moments as a feed, and the transcript.
struct ReplayView: View {
    @State private var model: ReplayModel

    init(sessionId: String, service: any ReplayService) {
        _model = State(initialValue: ReplayModel(sessionId: sessionId, service: service))
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 28) { content }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 32)
                    .animation(.spring(duration: 0.35), value: model.selected)
            }
            // a moment picked from the feed opens under the bar, so bring the bar and its card into view
            .onChange(of: model.selected?.id) { withAnimation { proxy.scrollTo(Self.playerId, anchor: .top) } }
        }
        .background(Theme.ground)
        .navigationTitle("Replay")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .onDisappear { model.stop() }
    }

    private static let playerId = "player"

    @ViewBuilder private var content: some View {
        switch model.phase {
        case .loading:
            SkeletonLines(widths: [0.5, 0.95, 0.3]).skillitCard()
            ForEach(0 ..< 3, id: \.self) { _ in SkeletonLines(widths: [0.6, 0.9], highlighted: -1) }
        case let .failed(message):
            failure(message)
        case let .ready(replay):
            player(replay).id(Self.playerId)
            if let selected = model.selected {
                MomentCard(moment: selected, when: replay.when(selected))
                    .id(selected.id)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
            moments(replay)
            section("Transcript") {
                ReplayTranscript(
                    lines: replay.transcript, currentLine: model.currentLine, canSeek: model.audio == .ready, onSeek: model.seek,
                )
            }
        }
    }

    @ViewBuilder private func player(_ replay: SessionReplay) -> some View {
        if replay.timing == .seconds, model.duration > 0 {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 14) {
                    playButton
                    Text("\(ReplayClock.label(model.currentTime)) / \(ReplayClock.label(model.duration))")
                        .font(.subheadline)
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                ReplayScrubBar(
                    replay: replay, currentTime: model.currentTime, duration: model.duration, selectedId: model.selected?.id,
                    onSeek: model.seek, onSelect: model.jump,
                )
                audioNote(replay)
            }
            .skillitCard()
        } else {
            audioNote(replay).skillitCard()
        }
    }

    @ViewBuilder private var playButton: some View {
        switch model.audio {
        case .ready:
            Button(action: model.togglePlayback) {
                Image(systemName: model.isPlaying ? "pause.fill" : "play.fill")
                    .font(.title3)
                    .foregroundStyle(Theme.onAction)
                    .frame(width: 48, height: 48)
                    .background(Theme.action, in: .circle)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(model.isPlaying ? "Pause" : "Play")
        case .loading:
            ProgressView().frame(width: 48, height: 48)
        case .absent, .failed:
            EmptyView()
        }
    }

    @ViewBuilder private func audioNote(_ replay: SessionReplay) -> some View {
        let note: String? = switch (replay.recording, model.audio) {
        case (.processing, _): "The recording is still being processed. Check back in a minute."
        case (.notRecorded, _): "This session wasn't recorded, so here's what was said."
        case (_, .failed): "Couldn't load the recording. The moments and transcript are still here."
        default: nil
        }
        if let note {
            Label(note, systemImage: "waveform").font(.footnote).foregroundStyle(.secondary)
        }
    }

    private func moments(_ replay: SessionReplay) -> some View {
        section("Moments") {
            if replay.moments.isEmpty {
                Text("Nothing stood out in this one.").font(.subheadline).foregroundStyle(.secondary)
            }
            VStack(spacing: 2) {
                ForEach(replay.moments) { moment in
                    MomentRow(
                        moment: moment, when: replay.when(moment), isSelected: moment.id == model.selected?.id,
                        spokenLabel: replay.spokenLabel(for: moment),
                    ) { model.jump(to: moment) }
                }
            }
        }
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.headline).foregroundStyle(.secondary)
            content()
        }
    }

    private func failure(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Couldn't load the replay", systemImage: "waveform")
        } description: {
            Text(message)
        } actions: {
            Button("Try again") { Task { await model.load() } }
                .buttonStyle(.raised)
                .frame(maxWidth: 220)
        }
    }
}

#if DEBUG
    #Preview {
        NavigationStack { ReplayView(sessionId: "preview", service: SampleReplay()) }
    }
#endif
