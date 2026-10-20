import UIKit
import WebKit
import UniformTypeIdentifiers

/// Affiche Notely Hub depuis notely://app/ : une vraie origine pour IndexedDB, servie depuis le dossier Web de l'app.
final class HubViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private let store = HubStore()
    private let voice = HubVoice()
    private var webView: WKWebView!
    private static let background = UIColor(red: 0x17 / 255, green: 0x18 / 255, blue: 0x1C / 255, alpha: 1)

    override func loadView() {
        let content = WKUserContentController()
        content.addUserScript(WKUserScript(source: "window.__notelyIPad = true;",
                                           injectionTime: .atDocumentStart, forMainFrameOnly: true))
        // pas de zoom de page ni de double-tap zoom : le board gère lui-même le pincement
        content.addUserScript(WKUserScript(source: """
            (function(){var m=document.querySelector('meta[name=viewport]');if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}
            m.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';})();
            """, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        content.add(WeakHandler(self), name: "hubStore")
        content.add(WeakHandler(self), name: "hubFile")
        content.add(WeakHandler(self), name: "hubVoice")

        let config = WKWebViewConfiguration()
        config.userContentController = content
        config.websiteDataStore = .default()
        config.setURLSchemeHandler(BundleSchemeHandler(store: store), forURLScheme: "notely")
        config.dataDetectorTypes = []
        config.allowsInlineMediaPlayback = true

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = Self.background
        web.scrollView.backgroundColor = Self.background
        web.scrollView.bounces = false
        web.scrollView.isScrollEnabled = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.navigationDelegate = self
        web.uiDelegate = self
        if #available(iOS 16.4, *) { web.isInspectable = true }
        webView = web
        voice.webView = web

        let root = UIView()
        root.backgroundColor = Self.background
        web.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: root.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: root.trailingAnchor)
        ])
        view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if let url = URL(string: "notely://app/index.html") { webView.load(URLRequest(url: url)) }
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
    }

    // MARK: - Messages de la page

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        if message.name == "hubStore" { store.handle(body); return }
        if message.name == "hubVoice" { voice.handle(body); return }
        if message.name == "hubFile", let name = body["name"] as? String, let data = body["data"] as? String,
           let url = store.saveExport(name: name, base64: data) {
            let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let pop = share.popoverPresentationController {
                pop.sourceView = view
                pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
                pop.permittedArrowDirections = []
            }
            present(share, animated: true)
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
        if let url = navigationAction.request.url, ["http", "https"].contains(url.scheme?.lowercased() ?? "") { UIApplication.shared.open(url) }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}

/// Sert les fichiers du dossier Web de l'app, et la copie de secours sous /__store/.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let store: HubStore
    private let web: URL?
    init(store: HubStore) {
        self.store = store
        self.web = Bundle.main.url(forResource: "Web", withExtension: nil)
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        var result: (Data, String)?
        if path.hasPrefix("/__store/") {
            result = store.read(String(path.dropFirst("/__store/".count)))
        } else if path.hasPrefix("/__voice/") {
            if let data = HubVoice.read(String(path.dropFirst("/__voice/".count))) { result = (data, "audio/mp4") }
        } else if let web = web {
            let file = web.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
            if file.path.hasPrefix(web.standardizedFileURL.path), let data = try? Data(contentsOf: file) {
                let mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
                result = (data, mime)
            }
        }
        guard let found = result else {
            let res = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: ["Content-Length": "0"])!
            task.didReceive(res); task.didFinish(); return
        }
        let (data, mime) = found
        let headers = ["Content-Type": mime, "Content-Length": String(data.count), "Cache-Control": "no-store"]
        let res = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(res)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

/// Évite le cycle de rétention entre WKUserContentController et le contrôleur.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
