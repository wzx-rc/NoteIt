import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/bricolage-grotesque/500.css";
import "@fontsource/bricolage-grotesque/600.css";
import "@fontsource/bricolage-grotesque/700.css";
import "@fontsource/bricolage-grotesque/800.css";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "./styles.css";
import { App } from "./App";
import { Widget } from "./widget/Widget";

/** Every renderer error goes to the crash journal kept by the desktop app. */
const report = (where: string, e: unknown) => {
  const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
  window.harvest?.log("error", where, msg);
};
window.addEventListener("error", (e) => report("window.onerror", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => report("unhandledrejection", e.reason));
if (window.harvest) document.documentElement.classList.add("desktop", `os-${window.harvest.platform}`);

/** Shows a way out instead of a blank window when a view crashes. */
class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    report("react", `${error.message}\n${error.stack ?? ""}\n${info.componentStack ?? ""}`);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <h2>Oups, cette vue a planté.</h2>
        <p>{this.state.error.message}</p>
        <p className="dim">Le détail est noté dans le journal de l'app.</p>
        <div className="actions">
          <button className="btn primary" onClick={() => this.setState({ error: undefined })}>Réessayer</button>
          {window.harvest ? <button className="btn" onClick={() => window.harvest?.openLogs()}>Ouvrir le journal</button> : null}
        </div>
      </div>
    );
  }
}

const isWidget = location.hash === "#widget";
if (isWidget) { document.documentElement.classList.add("widget-mode"); document.title = "Harvest Desk widget"; }
createRoot(document.getElementById("root")!).render(<StrictMode><Boundary>{isWidget ? <Widget /> : <App />}</Boundary></StrictMode>);
