import AVFoundation
import Speech

/// Dictée en français avec la reconnaissance vocale d'iOS. Le texte est envoyé à la page au fil de l'eau.
final class SpeechInput {
    /// {type: "partial", text} pendant la dictée, puis {type: "end", text, error?}.
    var onEvent: (([String: Any]) -> Void)?

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "fr-FR"))
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var text = ""
    private var running = false
    private var stopping = false

    /// Rend nil si la dictée a démarré, sinon un message à afficher.
    func start(_ done: @escaping (String?) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard status == .authorized else { done("Autorisez la reconnaissance vocale : Réglages, NoteIt."); return }
                Self.requestMic { granted in
                    guard granted else { done("Autorisez le micro : Réglages, NoteIt."); return }
                    do { try self.begin(); done(nil) } catch { self.finish(error: nil, notify: false); done("Le micro n'a pas pu démarrer.") }
                }
            }
        }
    }

    func stop() {
        guard running else { return }
        stopping = true
        stopAudio()
        request?.endAudio()
    }

    private static func requestMic(_ done: @escaping (Bool) -> Void) {
        let finish = { (granted: Bool) in DispatchQueue.main.async { done(granted) } }
        if #available(iOS 17, *) {
            AVAudioApplication.requestRecordPermission(completionHandler: finish)
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission(finish)
        }
    }

    private func begin() throws {
        if running { finish(error: nil) }
        guard let recognizer, recognizer.isAvailable else {
            throw NSError(domain: "NoteIt", code: 1)
        }
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try session.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        let input = engine.inputNode
        input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in
            request.append(buffer)
        }
        engine.prepare()
        try engine.start()

        self.request = request
        text = ""
        running = true
        stopping = false
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async { self?.handle(result, error) }
        }
    }

    private func handle(_ result: SFSpeechRecognitionResult?, _ error: Error?) {
        guard running else { return }
        if let result {
            text = result.bestTranscription.formattedString
            onEvent?(["type": "partial", "text": text])
        }
        if error != nil || result?.isFinal == true {
            let failed = error != nil && text.isEmpty && !stopping
            finish(error: failed ? "Je n'ai rien entendu. Réessayez." : nil)
        }
    }

    private func finish(error: String?, notify: Bool = true) {
        running = false
        stopping = false
        stopAudio()
        task?.cancel()
        task = nil
        request = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        guard notify else { return }
        var event: [String: Any] = ["type": "end", "text": text]
        if let error { event["error"] = error }
        onEvent?(event)
    }

    private func stopAudio() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
    }
}
