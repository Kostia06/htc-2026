import AVFAudio
import os
import RavenKit
import Speech

/// Keeps the microphone open for the whole session, transcribing on device with SpeechAnalyzer and reporting loudness.
/// Listening never pauses while the interviewer talks, which is what lets the person cut in.
final class SpeechListener {
    enum Failure: Error {
        case permissionDenied, unavailable

        var message: String {
            switch self {
            case .permissionDenied: "Raven needs the microphone to hear your answers. Turn it on in Settings, then try again."
            case .unavailable: "The microphone isn't available right now. Close other apps using it and try again."
            }
        }
    }

    enum Event: Sendable {
        /// Loudness, 0–1.
        case level(Float)
        /// Everything recognized since the last `clearHeard()`.
        case heard(String)
    }

    private let log = Logger(subsystem: "com.kostiailn.raven", category: "voice")
    private let engine = AVAudioEngine()
    private var analyzer: SpeechAnalyzer?
    private var analyzerInputs: AsyncStream<AnalyzerInput>.Continuation?
    private var transcription: Task<Void, Never>?
    private var events: AsyncStream<Event>.Continuation?
    private var finalized = ""
    private var volatile = ""

    /// False when this device can't transcribe; the session then ends turns on loudness alone.
    private(set) var canTranscribe = false

    var heard: String {
        "\(finalized) \(volatile)".trimmingCharacters(in: .whitespaces)
    }

    func clearHeard() {
        finalized = ""
        volatile = ""
    }

    func start() async throws(Failure) -> AsyncStream<Event> {
        guard await AVAudioApplication.requestRecordPermission() else { throw .permissionDenied }
        let input = engine.inputNode
        // echo cancellation, so the interviewer's own voice isn't heard as the person cutting in
        try? input.setVoiceProcessingEnabled(true)
        let inputFormat = input.outputFormat(forBus: 0)
        guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0 else { throw .unavailable }

        let (stream, continuation) = AsyncStream.makeStream(of: Event.self, bufferingPolicy: .bufferingNewest(8))
        events = continuation
        let speechFormat = await startTranscribing()
        let converter = speechFormat.flatMap { AVAudioConverter(from: inputFormat, to: $0) }
        Self.installTap(on: input, format: inputFormat, converter: converter, events: continuation, speech: analyzerInputs)
        do {
            engine.prepare()
            try engine.start()
        } catch {
            stop()
            throw .unavailable
        }
        return stream
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        analyzerInputs?.finish()
        analyzerInputs = nil
        transcription?.cancel()
        transcription = nil
        if let analyzer {
            Task { await analyzer.cancelAndFinishNow() }
        }
        analyzer = nil
        events?.finish()
        events = nil
    }

    /// Returns the audio format the transcriber wants, or nil when on-device transcription isn't possible here.
    private func startTranscribing() async -> AVAudioFormat? {
        let english = Locale(identifier: "en-US")
        if SpeechTranscriber.isAvailable, let locale = await SpeechTranscriber.supportedLocale(equivalentTo: english) {
            let transcriber = SpeechTranscriber(locale: locale, preset: .progressiveTranscription)
            return await start(transcriber, results: transcriber.results)
        }
        // Apple's fallback for devices without the SpeechTranscriber model
        if let locale = await DictationTranscriber.supportedLocale(equivalentTo: english) {
            let transcriber = DictationTranscriber(locale: locale, preset: .progressiveShortDictation)
            return await start(transcriber, results: transcriber.results)
        }
        log.notice("on-device transcription isn't available here; turns end on loudness alone")
        return nil
    }

    private func start(
        _ module: some SpeechModule,
        results: some AsyncSequence<some TranscriptionResult, some Error> & Sendable,
    ) async -> AVAudioFormat? {
        do {
            // the English model downloads once, the first time; afterwards this returns nil at once
            if let installation = try await AssetInventory.assetInstallationRequest(supporting: [module]) {
                try await installation.downloadAndInstall()
            }
            guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [module]) else { return nil }
            let analyzer = SpeechAnalyzer(modules: [module])
            let (inputs, continuation) = AsyncStream.makeStream(of: AnalyzerInput.self)
            try await analyzer.start(inputSequence: inputs)
            self.analyzer = analyzer
            analyzerInputs = continuation
            transcription = Task { await self.collect(results) }
            canTranscribe = true
            return format
        } catch {
            log.error("transcription didn't start: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private func collect(_ results: some AsyncSequence<some TranscriptionResult, some Error>) async {
        do {
            for try await result in results {
                if result.isFinal {
                    finalized = "\(finalized) \(result.plainText)"
                    volatile = ""
                } else {
                    volatile = result.plainText
                }
                events?.yield(.heard(heard))
            }
        } catch {
            // a failed recognizer leaves the session running on loudness alone
            log.error("transcription stopped: \(error.localizedDescription, privacy: .public)")
            canTranscribe = false
        }
    }

    /// nonisolated so the tap closure isn't main-actor isolated: it runs on the audio thread
    private nonisolated static func installTap(
        on input: AVAudioInputNode,
        format: AVAudioFormat,
        converter: AVAudioConverter?,
        events: AsyncStream<Event>.Continuation,
        speech: AsyncStream<AnalyzerInput>.Continuation?,
    ) {
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            events.yield(.level(AudioLevel.normalized(rms: rootMeanSquare(of: buffer))))
            if let converter, let speech, let converted = convert(buffer, with: converter) {
                speech.yield(AnalyzerInput(buffer: converted))
            }
        }
    }

    private nonisolated static func convert(_ buffer: AVAudioPCMBuffer, with converter: AVAudioConverter) -> AVAudioPCMBuffer? {
        let ratio = converter.outputFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up))
        guard let output = AVAudioPCMBuffer(pcmFormat: converter.outputFormat, frameCapacity: capacity) else { return nil }
        var isConsumed = false
        var error: NSError?
        converter.convert(to: output, error: &error) { _, status in
            if isConsumed {
                status.pointee = .noDataNow
                return nil
            }
            isConsumed = true
            status.pointee = .haveData
            return buffer
        }
        return error == nil && output.frameLength > 0 ? output : nil
    }

    private nonisolated static func rootMeanSquare(of buffer: AVAudioPCMBuffer) -> Float {
        guard let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return 0 }
        let count = Int(buffer.frameLength)
        var sum: Float = 0
        for index in 0 ..< count {
            sum += samples[index] * samples[index]
        }
        return (sum / Float(count)).squareRoot()
    }
}

/// The two transcribers' results share `isFinal` but not `text`; this gives both the same shape.
protocol TranscriptionResult: SpeechModuleResult {
    var plainText: String { get }
}

extension SpeechTranscriber.Result: TranscriptionResult {
    var plainText: String {
        String(text.characters)
    }
}

extension DictationTranscriber.Result: TranscriptionResult {
    var plainText: String {
        String(text.characters)
    }
}
