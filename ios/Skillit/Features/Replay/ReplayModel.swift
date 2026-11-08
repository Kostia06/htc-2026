import AVFoundation
import Foundation
import Observation
import SkillitKit

/// Loads one session's replay, then its recording, and keeps the playhead, the selected moment and the current line in step.
@Observable
final class ReplayModel {
    enum Phase: Equatable {
        case loading
        case ready(SessionReplay)
        case failed(String)
    }

    enum Audio: Equatable {
        /// Nothing to play: an old or offline session, or a recording ElevenLabs is still processing.
        case absent
        case loading
        case ready
        case failed
    }

    private(set) var phase: Phase = .loading
    private(set) var audio: Audio = .absent
    private(set) var currentTime: Double = 0
    private(set) var isPlaying = false
    var selected: ReplayMoment?

    let sessionId: String
    private let service: any ReplayService
    private var player: AVAudioPlayer?
    private var ticker: Task<Void, Never>?

    init(sessionId: String, service: any ReplayService) {
        self.sessionId = sessionId
        self.service = service
    }

    var replay: SessionReplay? {
        if case let .ready(replay) = phase { return replay }
        return nil
    }

    /// The recording's own length once it's loaded; the server's figure until then.
    var duration: Double {
        player?.duration ?? replay?.durationSec ?? 0
    }

    var currentLine: Int? {
        guard audio == .ready || selected != nil else { return nil }
        return replay?.lineIndex(at: currentTime)
    }

    func load() async {
        phase = .loading
        do {
            let replay = try await service.sessionReplay(id: sessionId)
            phase = .ready(replay)
            if replay.canPlay {
                await loadAudio()
            }
        } catch {
            phase = .failed(error.message)
        }
    }

    func togglePlayback() {
        guard let player else { return }
        if player.isPlaying {
            pause()
        } else {
            try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
            try? AVAudioSession.sharedInstance().setActive(true)
            player.play()
            isPlaying = true
            startTicking()
        }
    }

    func seek(to time: Double) {
        let clamped = min(max(0, time), duration)
        player?.currentTime = clamped
        currentTime = clamped
    }

    /// Tapping a dot or a row: show its card and hear it from a second before, so the start isn't clipped.
    func jump(to moment: ReplayMoment) {
        selected = moment
        guard replay?.timing == .seconds else { return }
        seek(to: moment.seconds - 1)
    }

    func stop() {
        pause()
        player = nil
    }

    private func pause() {
        player?.pause()
        isPlaying = false
        ticker?.cancel()
        ticker = nil
    }

    private func loadAudio() async {
        audio = .loading
        do {
            let data = try await service.replayAudio(id: sessionId)
            let player = try AVAudioPlayer(data: data)
            player.prepareToPlay()
            self.player = player
            audio = .ready
        } catch {
            audio = .failed
        }
    }

    // AVAudioPlayer doesn't publish its time, so read it a few times a second while playing
    private func startTicking() {
        ticker?.cancel()
        ticker = Task { [weak self] in
            while !Task.isCancelled {
                guard let self, let player = self.player else { return }
                currentTime = player.currentTime
                if !player.isPlaying {
                    isPlaying = false
                    return
                }
                try? await Task.sleep(for: .milliseconds(200))
            }
        }
    }
}
