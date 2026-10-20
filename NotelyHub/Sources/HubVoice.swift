import AVFoundation
import WebKit

/// Dictée : enregistre le micro en AAC dans un fichier temporaire, que la page lit par notely://app/__voice/
/// puis envoie à OpenAI pour la transcription (comme l'app ChatGPT, pas la dictée d'iOS).
final class HubVoice: NSObject {
    static let folder = FileManager.default.temporaryDirectory.appendingPathComponent("NotelyVoice", isDirectory: true)
    weak var webView: WKWebView?
    private var recorder: AVAudioRecorder?
    private var meter: Timer?
    private var current: URL?

    func handle(_ body: [String: Any]) {
        switch body["op"] as? String {
        case "start": requestAndStart()
        case "stop": finish(keep: true)
        case "cancel": finish(keep: false)
        default: break
        }
    }

    private func send(_ json: String) {
        webView?.evaluateJavaScript("window.__hubVoice && window.__hubVoice(\(json))", completionHandler: nil)
    }

    private func requestAndStart() {
        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if granted { self.begin() } else { self.send("{\"error\":\"denied\"}") }
            }
        }
    }

    private func begin() {
        finish(keep: false)
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .default)
            try session.setActive(true)
            let fm = FileManager.default
            try fm.createDirectory(at: Self.folder, withIntermediateDirectories: true)
            for old in (try? fm.contentsOfDirectory(at: Self.folder, includingPropertiesForKeys: nil)) ?? [] { try? fm.removeItem(at: old) }
            let url = Self.folder.appendingPathComponent(UUID().uuidString + ".m4a")
            let settings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: 24_000,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
            ]
            let rec = try AVAudioRecorder(url: url, settings: settings)
            rec.isMeteringEnabled = true
            guard rec.record() else { send("{\"error\":\"record\"}"); return }
            recorder = rec
            current = url
            meter = Timer.scheduledTimer(withTimeInterval: 0.06, repeats: true) { [weak self] _ in
                guard let self = self, let r = self.recorder else { return }
                r.updateMeters()
                let level = max(0, min(1, (r.averagePower(forChannel: 0) + 50) / 50))
                self.send("{\"level\":\(String(format: "%.3f", level))}")
            }
            send("{\"started\":true}")
        } catch {
            send("{\"error\":\"record\"}")
        }
    }

    private func finish(keep: Bool) {
        meter?.invalidate()
        meter = nil
        guard let rec = recorder else { return }
        rec.stop()
        recorder = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        if let url = current {
            if keep { send("{\"file\":\"\(url.lastPathComponent)\"}") } else { try? FileManager.default.removeItem(at: url) }
        }
        current = nil
    }

    /// Fichier enregistré, pour le gestionnaire notely://app/__voice/<nom>.m4a
    static func read(_ name: String) -> Data? {
        guard !name.contains("/"), name.hasSuffix(".m4a") else { return nil }
        return try? Data(contentsOf: folder.appendingPathComponent(name))
    }
}
