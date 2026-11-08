import AVFAudio
import RavenKit

/// Says a line with the best installed voice and returns when it's done, stopped, or the calling task is cancelled.
/// spelled out: conforming to the nonisolated delegate protocol opts the class out of the main-actor default
@MainActor
final class SpeechPlayer: NSObject, AVSpeechSynthesizerDelegate {
    private let synthesizer = AVSpeechSynthesizer()
    private let voice = SpeechPlayer.bestVoice()
    private var finished: CheckedContinuation<Void, Never>?

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    /// One line for the screen when only the robotic compact voices are installed.
    var voiceHint: String? {
        let candidate = voice.map(Self.candidate)
        guard VoiceRanking.shouldSuggestDownload(for: candidate) else { return nil }
        return "For a more natural voice, download an Enhanced voice in Settings › Accessibility › Spoken Content."
    }

    func speak(_ text: String) async {
        await withTaskCancellationHandler {
            await withCheckedContinuation { continuation in
                finished = continuation
                let utterance = AVSpeechUtterance(string: text)
                utterance.voice = voice ?? AVSpeechSynthesisVoice(language: "en-US")
                // a touch quicker than the default and a breath before speaking, like someone replying
                utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 1.04
                utterance.preUtteranceDelay = 0.15
                synthesizer.speak(utterance)
            }
        } onCancel: {
            Task { @MainActor in self.stop() }
        }
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        resume()
    }

    nonisolated func speechSynthesizer(_: AVSpeechSynthesizer, didFinish _: AVSpeechUtterance) {
        Task { @MainActor in self.resume() }
    }

    nonisolated func speechSynthesizer(_: AVSpeechSynthesizer, didCancel _: AVSpeechUtterance) {
        Task { @MainActor in self.resume() }
    }

    private func resume() {
        finished?.resume()
        finished = nil
    }

    private static func bestVoice() -> AVSpeechSynthesisVoice? {
        let installed = AVSpeechSynthesisVoice.speechVoices()
        guard let best = VoiceRanking.best(of: installed.map(candidate)) else { return nil }
        return installed.first { $0.identifier == best.identifier }
    }

    private static func candidate(_ voice: AVSpeechSynthesisVoice) -> VoiceCandidate {
        let quality: VoiceCandidate.Quality = switch voice.quality {
        case .premium: .premium
        case .enhanced: .enhanced
        default: .compact
        }
        let isNovelty = voice.voiceTraits.contains(.isNoveltyVoice) || voice.voiceTraits.contains(.isPersonalVoice)
        return VoiceCandidate(identifier: voice.identifier, language: voice.language, quality: quality, isNovelty: isNovelty)
    }
}
