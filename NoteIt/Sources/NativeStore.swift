import Foundation

/// Copie des données de l'app (tâches, réglages) dans un fichier JSON du dossier Documents.
/// Le localStorage de la page reste utilisé, mais ce fichier est la source fiable au lancement.
final class NativeStore {
    private let url: URL
    private let queue = DispatchQueue(label: "noteit.store")
    private var values: [String: String]

    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        url = docs.appendingPathComponent("notely-store.json")
        if let data = try? Data(contentsOf: url),
           let dict = try? JSONSerialization.jsonObject(with: data) as? [String: String] {
            values = dict
        } else {
            values = [:]
        }
    }

    func value(_ key: String) -> String? { values[key] }

    /// Objet JS injecté avant le chargement de la page.
    func javaScriptLiteral() -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: values),
              let json = String(data: data, encoding: .utf8) else { return "{}" }
        return json
            .replacingOccurrences(of: "\u{2028}", with: "\\u2028")
            .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
    }

    func set(_ key: String, _ value: String) {
        values[key] = value
        let snapshot = values
        let url = self.url
        queue.async {
            guard let data = try? JSONSerialization.data(withJSONObject: snapshot) else { return }
            try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
    }
}
