import type { CapacitorConfig } from "@capacitor/cli";

// Configuração do Capacitor para gerar o app Android (APK).
//
// IMPORTANTE — conectividade em produção:
// O app web fala com o proxy da Loja Integrada via VITE_LOJA_INTEGRADA_PROXY_URL.
// No emulador/celular, "localhost" aponta para o PRÓPRIO aparelho, não para o seu
// PC. Por isso, em produção, defina VITE_LOJA_INTEGRADA_PROXY_URL para a URL
// PÚBLICA do seu proxy (Render/Railway/VPS) ANTES de rodar `npm run build`.
//
// Para testar localmente no emulador Android, use `npx cap run android` — o
// Capacitor faz um "proxy reverso" automático de localhost:8787 do emulador
// para o localhost:8787 do seu PC. Em um celular físico (APK instalado), será
// necessário hospedar o proxy e ajustar a env.

const config: CapacitorConfig = {
  appId: "com.dgriffe.app",
  appName: "D'Griffe Ótica",
  webDir: "dist",
  server: {
    // Em dev com `npx cap run android` + emulador, o Capacitor redireciona
    // localhost:8787 do emulador para o PC. Em produção (APK), o app usará a
    // URL definida em VITE_LOJA_INTEGRADA_PROXY_URL (build-time).
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#0A0A0A",
    allowMixedContent: true,
  },
};

export default config;
