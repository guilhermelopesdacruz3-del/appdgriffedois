// Mantém o backend do Render acordado (plano free dorme após ~15 min sem
// tráfego; cold start >30s estoura o limite do Pages Function -> 502 no admin).
export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      fetch("https://appdgriffedois.onrender.com/health", {
        signal: AbortSignal.timeout(30000),
      })
        .then((r) => r.text())
        .catch((e) => console.error("keepalive falhou:", String(e)))
    );
  },
};
