import type { CapacitorConfig } from "@capacitor/cli";

// Configuração do Capacitor para gerar o app Android como AAB
// (Android App Bundle) — formato EXIGIDO pela Google Play Store.
//
// PROXY EM PRODUÇÃO:
// O app web fala com o backend (checkout MP + Loja Integrada) via
// VITE_LOJA_INTEGRADA_PROXY_URL. No celular, "localhost" aponta para o
// PRÓPRIO aparelho. Por isso, em produção, defina essa env para a URL
// PÚBLICA do proxy (Render/Railway/VPS) ANTES do `npm run build`.
// O build do AAB (GitHub Actions) injeta essa env automaticamente.
//
// Para testar localmente no emulador: `npx cap run android` faz o proxy
// reverso de localhost:8787 do emulador -> localhost:8787 do PC.

const PROXY_URL = (process.env.VITE_LOJA_INTEGRADA_PROXY_URL || "").replace(/\/$/, "");

const config: CapacitorConfig = {
  appId: "com.dgriffe.app",
  appName: "D'Griffe Ótica",
  webDir: "dist",
  server: {
    // Em produção (AAB), o app consome a URL definida em build-time.
    androidScheme: "https",
    // Garante que a URL do proxy seja embutida no bundle.
    ...(PROXY_URL ? { hostname: PROXY_URL.replace(/^https?:\/\//, "") } : {}),
  },
  android: {
    backgroundColor: "#0A0A0A",
    allowMixedContent: true,
    // AAB único (sem splits por ABI) — mais simples de publicar.
    buildOptions: {
      // O Gradle gera app-release.aab em android/app/build/outputs/bundle/release/
    },
  },
};

export default config;
