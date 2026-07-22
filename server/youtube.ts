// Busca os vídeos mais recentes do canal do YouTube da D'Griffe via RSS público
// (não exige API key). O app consome /api/youtube/latest e cai no array
// estático do front se isto falhar.
//
// ROBUSTEZ: o RSS do YouTube pode rate-limitar se chamado a toda requisição,
// então cacheamos em memória (TTL 10min). Também logamos erros para diagnóstico.

const CHANNEL_ID = process.env.YT_CHANNEL_ID || "UCiJZLyvcFQPxSxZaK2PynWg";
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface YouTubeItem {
  videoId: string;
  title: string;
  publishedAt: string;
  thumb: string;
}

// Cache simples em memória (por processo). Em produção com vários processos
// cada um tem seu cache — aceitável, já que o TTL é curto.
let cache: { itens: YouTubeItem[]; expira: number } | null = null;

function dec(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#38;/g, "&");
}

// Parser mínimo de Atom (sem dependências): extrai cada <entry>.
export async function listarVideosRecentes(limit = 6): Promise<YouTubeItem[]> {
  if (cache && cache.expira > Date.now()) return cache.itens;

  const r = await fetch(RSS_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Accept: "application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`YouTube RSS ${r.status}`);
  const xml = await r.text();

  const entries = xml.split("<entry>").slice(1);
  const items: YouTubeItem[] = [];
  for (const e of entries) {
    const videoId = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim();
    // O RSS do YouTube usa <title> dentro de <entry> (não <media:title>).
    const title = dec(e.match(/<title>([^<]*)<\/title>/)?.[1] || "");
    const publishedAt = e.match(/<published>([^<]+)<\/published>/)?.[1]?.trim() || "";
    if (!videoId) continue;
    items.push({
      videoId,
      title,
      publishedAt,
      thumb: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    });
    if (items.length >= limit) break;
  }

  if (items.length === 0) throw new Error("Nenhum vídeo encontrado no RSS");
  cache = { itens: items, expira: Date.now() + CACHE_TTL_MS };
  return items;
}
