// Busca os vídeos mais recentes do canal do YouTube da D'Griffe via RSS público
// (não exige API key). O app consome /api/youtube/latest e cai no array
// estático do front se isto falhar.

const CHANNEL_ID = process.env.YT_CHANNEL_ID || "UCiJZLyvcFQPxSxZaK2PynWg";
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export interface YouTubeItem {
  videoId: string;
  title: string;
  publishedAt: string;
  thumb: string;
}

function dec(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Parser mínimo de Atom (sem dependências): extrai cada <entry>.
export async function listarVideosRecentes(limit = 6): Promise<YouTubeItem[]> {
  const r = await fetch(RSS_URL, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`YouTube RSS ${r.status}`);
  const xml = await r.text();

  const entries = xml.split("<entry>").slice(1);
  const items: YouTubeItem[] = [];
  for (const e of entries) {
    const videoId = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]?.trim();
    const title = dec(e.match(/<media:title>([^<]*)<\/media:title>/)?.[1] || "");
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
  return items;
}
