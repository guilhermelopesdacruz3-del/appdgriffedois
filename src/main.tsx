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
if ("serviceWorker" in navigator && import.meta.env.PROD && window.location.protocol === "https") {
  window.addEventListener("load", () => {
    // Desativar service workers antigos
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister());
    });
    // Registrar novo service worker
    navigator.serviceWorker.register("/sw-v2.js").then((registration) => {
      registration.update();
    }).catch(() => {
      /* falha de registro não deve quebrar o app */
    });
  });
}
