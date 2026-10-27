import Foundation

/// Copie de secours des données de la page dans Documents/NotelyHub (visible dans l'app Fichiers) :
/// kv/<clé>.json pour l'espace de travail, assets/<id> (+ <id>.type) pour les images et fichiers.
final class HubStore {
    let root: URL
    private let queue = DispatchQueue(label: "notelyhub.store")

    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        root = docs.appendingPathComponent("NotelyHub", isDirectory: true)
        for sub in ["kv", "assets", "Exports"] {
            try? FileManager.default.createDirectory(at: root.appendingPathComponent(sub, isDirectory: true),
                                                     withIntermediateDirectories: true)
        }
    }

    private static func safe(_ key: String) -> String? {
        let ok = key.unicodeScalars.allSatisfy { CharacterSet.alphanumerics.contains($0) || "-_.".unicodeScalars.contains($0) }
        return ok && !key.isEmpty && !key.hasPrefix(".") ? key : nil
    }

    private func fileURL(store: String, key: String) -> URL? {
        guard let k = Self.safe(key) else { return nil }
        switch store {
        case "kv": return root.appendingPathComponent("kv").appendingPathComponent(k + ".json")
        case "assets": return root.appendingPathComponent("assets").appendingPathComponent(k)
        default: return nil
        }
    }

    /// Message de la page : { op: "put"|"del", store, key, json? | b64?, type? }
    func handle(_ body: [String: Any]) {
        guard let op = body["op"] as? String, let store = body["store"] as? String,
              let key = body["key"] as? String, let url = fileURL(store: store, key: key) else { return }
        let json = body["json"] as? String, b64 = body["b64"] as? String, type = body["type"] as? String
        queue.async {
            if op == "del" {
                try? FileManager.default.removeItem(at: url)
                try? FileManager.default.removeItem(at: url.appendingPathExtension("type"))
                return
            }
            if let json = json, let data = json.data(using: .utf8) {
                try? data.write(to: url, options: .atomic)
            } else if let b64 = b64, let data = Data(base64Encoded: b64) {
                try? data.write(to: url, options: .atomic)
                if let type = type { try? type.data(using: .utf8)?.write(to: url.appendingPathExtension("type"), options: .atomic) }
            }
        }
    }

    /// Lecture pour notely://app/__store/<chemin> : (données, type MIME) ou nil.
    func read(_ path: String) -> (Data, String)? {
        queue.sync { () -> (Data, String)? in
            let parts = path.split(separator: "/", omittingEmptySubsequences: false).map(String.init)
            guard let store = parts.first else { return nil }
            if store == "assets" && (parts.count == 1 || parts[1].isEmpty) {
                let dir = root.appendingPathComponent("assets")
                let ids = ((try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? [])
                    .filter { !$0.hasSuffix(".type") && !$0.hasPrefix(".") }
                guard let data = try? JSONSerialization.data(withJSONObject: ids) else { return nil }
                return (data, "application/json")
            }
            guard parts.count == 2, let key = parts[1].removingPercentEncoding,
                  let url = fileURL(store: store, key: key), let data = try? Data(contentsOf: url) else { return nil }
            if store == "kv" { return (data, "application/json") }
            let type = (try? String(contentsOf: url.appendingPathExtension("type"), encoding: .utf8)) ?? "application/octet-stream"
            return (data, type)
        }
    }

    /// Enregistre un export de la page dans Documents/NotelyHub/Exports.
    func saveExport(name: String, base64: String) -> URL? {
        guard let data = Data(base64Encoded: base64) else { return nil }
        let clean = name.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
        let url = root.appendingPathComponent("Exports").appendingPathComponent(clean.isEmpty ? "notely-hub.json" : clean)
        return (try? data.write(to: url, options: .atomic)) != nil ? url : nil
    }
}
