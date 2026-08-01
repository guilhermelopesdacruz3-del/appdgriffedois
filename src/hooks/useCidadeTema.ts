// Detecção de cidade por geolocalização para aplicar o tema local.
// Capão da Canoa -> tema padrão; Osório -> tema "pirâmides" (deserto/dourado).
import { useEffect } from "react";

const CIDADES: Record<string, { lat: number; lng: number; raioKm: number }> = {
  "capao-da-canoa": { lat: -29.7464, lng: -50.0136, raioKm: 15 },
  osorio: { lat: -29.885, lng: -50.2639, raioKm: 15 },
};

function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function cidadeMaisProxima(lat: number, lng: number): string {
  let melhor = "capao-da-canoa";
  let menor = Infinity;
  for (const [nome, c] of Object.entries(CIDADES)) {
    const d = distanciaKm(lat, lng, c.lat, c.lng);
    if (d <= c.raioKm && d < menor) {
      melhor = nome;
      menor = d;
    }
  }
  return melhor;
}

export function useCidadeTema() {
  useEffect(() => {
    let ativo = true;

    const aplicar = (cidade: string) => {
      try {
        const root = document.documentElement;
        if (cidade === "osorio") root.setAttribute("data-cidade", "osorio");
        else root.removeAttribute("data-cidade");
        window.localStorage.setItem("dgriffe:cidade", cidade);
      } catch { /* ignora */ }
    };

    // Cache por 10 min para não pedir permissão a cada reload.
    try {
      const raw = window.localStorage.getItem("dgriffe:cidade_cache");
      if (raw) {
        const c = JSON.parse(raw) as { cidade: string; em: number };
        if (Date.now() - c.em < 10 * 60_000) {
          aplicar(c.cidade);
          return;
        }
      }
    } catch { /* ignora */ }

    if (!("geolocation" in navigator)) {
      aplicar("capao-da-canoa");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!ativo) return;
        const cidade = cidadeMaisProxima(pos.coords.latitude, pos.coords.longitude);
        aplicar(cidade);
        try {
          window.localStorage.setItem(
            "dgriffe:cidade_cache",
            JSON.stringify({ cidade, em: Date.now() })
          );
        } catch { /* ignora */ }
      },
      () => {
        // Sem permissão/erro: usa o padrão (Capão da Canoa).
        if (ativo) aplicar("capao-da-canoa");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60_000 }
    );

    return () => { ativo = false; };
  }, []);
}
