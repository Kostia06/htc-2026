import AVFAudio
import RavenKit

/// How loud the microphone is, roughly 45 times a second, on the 0–1 scale of `AudioLevel`.
final class MicrophoneLevelMonitor {
    enum Failure: Error {
        case permissionDenied, unavailable

        var message: String {
            switch self {
            case .permissionDenied: "Raven needs the microphone to hear your answers. Turn it on in Settings, then try again."
            case .unavailable: "The microphone isn't available right now. Close other apps using it and try again."
            }
        }
    }

    private let engine = AVAudioEngine()

    /// Asks for the microphone the first time, then streams levels until `stop()`.
    func levels() async throws(Failure) -> AsyncStream<Float> {
        guard await AVAudioApplication.requestRecordPermission() else { throw .permissionDenied }
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { throw .unavailable }

        let (stream, continuation) = AsyncStream.makeStream(of: Float.self, bufferingPolicy: .bufferingNewest(1))
        Self.installLevelTap(on: input, format: format, sending: continuation)
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            throw .unavailable
        }
        return stream
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
    }

    /// nonisolated so the tap closure isn't main-actor isolated: it runs on the audio thread
    private nonisolated static func installLevelTap(
        on input: AVAudioInputNode,
        format: AVAudioFormat,
        sending continuation: AsyncStream<Float>.Continuation,
    ) {
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            continuation.yield(AudioLevel.normalized(rms: rootMeanSquare(of: buffer)))
        }
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
