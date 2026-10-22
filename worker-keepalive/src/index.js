// Ping periódico no /health do backend (Hospede Aqui). O plano dele não dorme
// como o free do Render, então este keepalive perdeu a função — se quiser
// desativar, remova o cron trigger do wrangler.toml e rode `wrangler deploy`.
export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      fetch("https://appdgriffedois.hospedeaqui.cloud/health", {
        signal: AbortSignal.timeout(30000),
      })
        .then((r) => r.text())
        .catch((e) => console.error("keepalive falhou:", String(e)))
    );
  },
};
