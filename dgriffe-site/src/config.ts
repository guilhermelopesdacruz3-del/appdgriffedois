// Ponto ÚNICO de verdade para a URL base da API do D'Griffe.
//
// Todos os services/páginas do SITE devem importar daqui — nunca repetir
// `import.meta.env.VITE_API_URL` solto. Antes cada arquivo declarava o seu
// próprio API_BASE; se a URL mudasse, dava para esquecer um e quebrar.
//
// - Em produção (Cloudflare Pages) a URL vem de VITE_API_URL (build-time),
//   apontando para o Render: https://appdgriffedois.onrender.com
// - Sem VITE_API_URL definida, cai no Render por padrão (backend canônico).
export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://appdgriffedois.onrender.com";
