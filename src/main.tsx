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
    // DESATIVADO TEMPORARIAMENTE para forçar atualização do cache
    // Reativar após confirmar que o novo design está no ar
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => r.unregister());
    });
  });
}
