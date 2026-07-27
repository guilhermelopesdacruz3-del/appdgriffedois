import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Registro do Service Worker (PWA/TWA). Só em produção (https) e fora do dev.
if ("serviceWorker" in navigator && import.meta.env.PROD && window.location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* falha de registro não deve quebrar o app */
    });
  });
}
