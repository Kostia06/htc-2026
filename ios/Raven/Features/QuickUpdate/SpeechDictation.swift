import AVFoundation
import Speech

/// Listens through the mic and streams the text heard so far, growing as the person speaks. The stream ends after `stop()`
/// once the recogniser has delivered its final read, or when it gives up on its own.
protocol Dictation: AnyObject {
    func start() -> AsyncThrowingStream<String, any Error>
    func stop()
}

enum DictationError: LocalizedError {
    case notAuthorized
    case unavailable

    var errorDescription: String? {
        switch self {
        case .notAuthorized: "Allow the microphone and speech recognition in Settings to talk to Raven."
        case .unavailable: "Speech recognition isn't available right now. Type it instead?"
        }
    }
}

/// Apple's on-device speech recognition: no account, no round trip, works in a quiet room on the first try.
final class SpeechDictation: Dictation {
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    func start() -> AsyncThrowingStream<String, any Error> {
        AsyncThrowingStream { continuation in
            Task { await self.listen(into: continuation) }
        }
    }

    /// Ends the audio so the recogniser finishes with what it has; the stream closes once that final read lands.
    func stop() {
        guard audioEngine.isRunning else { return }
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func listen(into continuation: AsyncThrowingStream<String, any Error>.Continuation) async {
        guard await Self.authorize() else {
            continuation.finish(throwing: DictationError.notAuthorized)
            return
        }
        guard let recognizer = SFSpeechRecognizer(), recognizer.isAvailable else {
            continuation.finish(throwing: DictationError.unavailable)
            return
        }
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.taskHint = .dictation
        do {
            try startAudio(feeding: request)
        } catch {
            continuation.finish(throwing: DictationError.unavailable)
            return
        }
        self.request = request
        task = recognizer.recognitionTask(with: request) { result, error in
            if let result {
                continuation.yield(result.bestTranscription.formattedString)
            }
            if error != nil || result?.isFinal == true {
                continuation.finish()
            }
        }
        continuation.onTermination = { [weak self] _ in
            Task { @MainActor in self?.tearDown() }
        }
    }

    private func startAudio(feeding request: SFSpeechAudioBufferRecognitionRequest) throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        nonisolated(unsafe) let sink = request
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in sink.append(buffer) }
        audioEngine.prepare()
        try audioEngine.start()
    }

    private func tearDown() {
        stop()
        task?.cancel()
        task = nil
        request = nil
    }

    private static func authorize() async -> Bool {
        guard await AVAudioApplication.requestRecordPermission() else { return false }
        let status = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        return status == .authorized
    }
}

/// Plays back one fixed line a word at a time, for previews and screenshots.
final class ScriptedDictation: Dictation {
    private let line: String
    private var playback: Task<Void, Never>?

    init(line: String = "I finished the Flask dashboard project") {
        self.line = line
    }

    func start() -> AsyncThrowingStream<String, any Error> {
        AsyncThrowingStream { continuation in
            playback = Task { [line] in
                var heard: [Substring] = []
                for word in line.split(separator: " ") {
                    try? await Task.sleep(for: .milliseconds(220))
                    guard !Task.isCancelled else { break }
                    heard.append(word)
                    continuation.yield(heard.joined(separator: " "))
                }
                continuation.finish()
            }
        }
    }

    func stop() {
        playback?.cancel()
        playback = nil
    }
}
