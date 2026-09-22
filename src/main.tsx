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
    // Cache-busting: força o browser a buscar o SW novo a cada deploy
    const swUrl = "/sw.js?v=" + Date.now();
    navigator.serviceWorker.register(swUrl).then((registration) => {
      // Forçar atualização do service worker quando houver nova versão
      registration.update();
    }).catch(() => {
      /* falha de registro não deve quebrar o app */
    });
  });
}
