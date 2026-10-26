import UIKit
import WebKit

final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
    private let store = NativeStore()
    private let speech = SpeechInput()
    private var webView: WKWebView!

    private static let dark = UIColor(red: 0x12 / 255, green: 0x12 / 255, blue: 0x12 / 255, alpha: 1)
    private static let light = UIColor.white

    override func loadView() {
        let content = WKUserContentController()
        content.addUserScript(WKUserScript(
            source: "window.__notelyNative = \(store.javaScriptLiteral());",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true))
        content.add(WeakMessageHandler(self), name: "notely")
        content.addScriptMessageHandler(WeakReplyHandler(self), contentWorld: .page, name: "noteitAsk")

        let config = WKWebViewConfiguration()
        config.userContentController = content
        config.dataDetectorTypes = []
        config.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.navigationDelegate = self
        webView.uiDelegate = self
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        self.webView = webView
        view = webView
        applyTheme()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        speech.onEvent = { [weak self] event in
            guard let data = try? JSONSerialization.data(withJSONObject: event),
                  let json = String(data: data, encoding: .utf8) else { return }
            self?.webView.evaluateJavaScript("window.__noteitSpeech && window.__noteitSpeech(\(json))")
        }
        guard let page = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") else { return }
        webView.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        store.value("notely-theme") == "light" ? .darkContent : .lightContent
    }

    private func applyTheme() {
        let light = store.value("notely-theme") == "light"
        let color = light ? Self.light : Self.dark
        overrideUserInterfaceStyle = light ? .light : .dark
        view.backgroundColor = color
        webView?.backgroundColor = color
        webView?.scrollView.backgroundColor = color
        setNeedsStatusBarAppearanceUpdate()
    }

    // MARK: - Messages de la page

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let key = body["k"] as? String,
              let value = body["v"] as? String else { return }
        store.set(key, value)
        if key == "notely-theme" { applyTheme() }
    }

    // MARK: - Assistant : clé dans le trousseau, requêtes à l'IA, dictée

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let cmd = body["cmd"] as? String else {
            replyHandler(nil, "Commande invalide"); return
        }
        let provider = AIProvider.all[body["provider"] as? String ?? ""]
        switch cmd {
        case "ai.hasKey":
            replyHandler(provider?.hasKey ?? false, nil)
        case "ai.saveKey":
            guard let provider, let key = body["key"] as? String, !key.isEmpty else { replyHandler(false, nil); return }
            replyHandler(Keychain.set(provider.account, key), nil)
        case "ai.deleteKey":
            if let provider { Keychain.delete(provider.account) }
            replyHandler(true, nil)
        case "ai.request":
            guard let provider else { replyHandler(nil, "Fournisseur inconnu"); return }
            provider.send(body, reply: replyHandler)
        case "speech.start":
            speech.start { error in replyHandler(error, nil) }
        case "speech.stop":
            speech.stop()
            replyHandler(true, nil)
        default:
            replyHandler(nil, "Commande inconnue")
        }
    }

    // MARK: - Liens externes : ouverts dans Safari

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, ["http", "https", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { UIApplication.shared.open(url) }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}

/// Évite le cycle de rétention entre WKUserContentController et le contrôleur.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

private final class WeakReplyHandler: NSObject, WKScriptMessageHandlerWithReply {
    weak var target: WKScriptMessageHandlerWithReply?
    init(_ target: WKScriptMessageHandlerWithReply) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let target else { replyHandler(nil, "Indisponible"); return }
        target.userContentController(controller, didReceive: message, replyHandler: replyHandler)
    }
}
