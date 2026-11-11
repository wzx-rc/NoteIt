import { createRoot } from "react-dom/client";
import App from "./App";
import { loadIcons } from "./lib/icons";
import "./ui/style.css";

loadIcons().then(() => createRoot(document.getElementById("root")!).render(<App />));
