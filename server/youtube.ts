// Busca os vídeos mais recentes do canal do YouTube da D'Griffe via RSS público
// (não exige API key). O app consome /api/youtube/latest e cai no array
// estático do front se isto falhar.
//
// ROBUSTEZ: o RSS do YouTube rate-limita se chamado demais. Estratégia:
//   1) Cache em ARQUIVO (.youtube-cache.json) — sobrevive a reinícios do server
//      e persiste entre deploys, então nunca ficamos sem vídeos.
//   2) TTL de 10min em memória para não bater no YouTube a toda requisição.
//   3) FALLBACK: se o RSS falhar mas temos cache (mesmo expirado), usamos ele
//      (com warning) — a seção NUNCA fica vazia por culpa de rate-limit.
//   4) Só retorna erro se nunca tivermos conseguido nenhum vídeo.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, ".youtube-cache.json");

const CHANNEL_ID = process.env.YT_CHANNEL_ID || "UCiJZLyvcFQPxSxZaK2PynWg";
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface YouTubeItem {
  videoId: string;
  title: string;
  publishedAt: string;
  thumb: string;
}

type CacheData = { itens: YouTubeItem[]; expira: number; salvoEm: number };

let memCache: CacheData | null = null;

function dec(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#38;/g, "&");
}

function lerArquivo(): CacheData | null {
  try {
    if (fs.existsSync(CACHE_PATH)) return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch {
    /* ignore */
  }
  return null;
}

function salvarArquivo(c: CacheData) {
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(c), { mode: 0o600 });
  } catch {
    /* ignore */
  }
}

function getCache(): CacheData | null {
  if (memCache && memCache.expira > Date.now()) return memCache;
  const f = lerArquivo();
  if (f && f.expira > Date.now()) {
    memCache = f;
    return f;
  }
  return f; // pode ser expirado — usado como fallback
}

// Parser mínimo de Atom (sem dependências): extrai cada <entry>.
async function buscarRSS(): Promise<YouTubeItem[]> {
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
    if (items.length >= 6) break;
  }
  if (items.length === 0) throw new Error("Nenhum vídeo encontrado no RSS");
  return items;
}

export async function listarVideosRecentes(limit = 6): Promise<YouTubeItem[]> {
  // Cache fresco em memória/arquivo?
  const fresco = getCache();
  if (fresco && fresco.expira > Date.now()) return fresco.itens.slice(0, limit);

  try {
    const itens = await buscarRSS();
    const c: CacheData = { itens, expira: Date.now() + CACHE_TTL_MS, salvoEm: Date.now() };
    memCache = c;
    salvarArquivo(c);
    return itens.slice(0, limit);
  } catch (e: any) {
    // Fallback: usa cache expirado se existir (evita seção vazia por rate-limit).
    const stale = getCache();
    if (stale && stale.itens.length > 0) {
      console.warn("[youtube] RSS falhou, usando cache expirado:", e?.message || e);
      return stale.itens.slice(0, limit);
    }
    throw e; // nunca tivemos nenhum vídeo
  }
}
