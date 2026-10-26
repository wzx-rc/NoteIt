import Foundation

/// Fournisseurs d'IA joignables depuis la page. La clé reste côté natif : la page envoie
/// seulement le chemin et le corps de la requête, l'en-tête d'authentification est ajouté ici.
struct AIProvider {
    let base: String
    let account: String
    let headers: (String) -> [String: String]

    static let all: [String: AIProvider] = [
        "openai": AIProvider(base: "https://api.openai.com", account: "openai-api-key",
                             headers: { ["Authorization": "Bearer \($0)"] }),
        // Prêt pour plus tard : même pont, autre hôte et autres en-têtes.
        "anthropic": AIProvider(base: "https://api.anthropic.com", account: "anthropic-api-key",
                                headers: { ["x-api-key": $0, "anthropic-version": "2023-06-01"] })
    ]

    var hasKey: Bool { !(Keychain.get(account) ?? "").isEmpty }

    /// `body` : method, path (/v1/...), body (JSON en texte), key (facultatif, pour vérifier une clé avant de l'enregistrer).
    func send(_ body: [String: Any], reply: @escaping (Any?, String?) -> Void) {
        guard let path = body["path"] as? String, path.hasPrefix("/v1/"), !path.contains(".."),
              let url = URL(string: base + path) else { reply(nil, "Requête invalide"); return }
        let given = (body["key"] as? String) ?? ""
        let key = given.isEmpty ? (Keychain.get(account) ?? "") : given
        guard !key.isEmpty else { reply(["status": 0, "body": "", "error": "nokey"], nil); return }

        var request = URLRequest(url: url, timeoutInterval: 90)
        request.httpMethod = (body["method"] as? String) == "POST" ? "POST" : "GET"
        headers(key).forEach { request.setValue($0.value, forHTTPHeaderField: $0.key) }
        if let json = body["body"] as? String, !json.isEmpty {
            request.httpBody = Data(json.utf8)
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        URLSession.shared.dataTask(with: request) { data, response, error in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let text = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            DispatchQueue.main.async {
                reply(["status": status, "body": text, "error": error?.localizedDescription ?? ""], nil)
            }
        }.resume()
    }
}
