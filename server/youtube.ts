// Busca os vídeos mais recentes do canal do YouTube da D'Griffe.
//
// FONTE PRIMÁRIA: YouTube Data API v3 (exige YT_API_KEY). Estável e sem os
// bloqueios do RSS público (que o YouTube passou a barrar, retornando 404/429).
// FALLBACK: RSS público (quando não há API key configurada).
// CACHE: arquivo .youtube-cache.json (persiste entre reinícios/deploys) +
// TTL 10min em memória. Se tudo falhar mas houver cache (mesmo expirado),
// usamos ele — a seção NUNCA fica vazia por culpa de bloqueio.
//
// Configuração (admin, aba APIs, ou env var): YT_API_KEY e YT_CHANNEL_ID.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSecret } from "./db.ts";

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

// --- Fonte 1: YouTube Data API v3 (estável) ---
async function buscarAPI(apiKey: string): Promise<YouTubeItem[]> {
  const url = `https://www.googleapis.com/youtube/v3/search?key=${encodeURIComponent(
    apiKey
  )}&channelId=${CHANNEL_ID}&part=snippet&order=date&maxResults=6&type=video`;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`YouTube API ${r.status}`);
  const json = (await r.json()) as any;
  if (!Array.isArray(json.items)) throw new Error("YouTube API: sem items");
  const items: YouTubeItem[] = json.items
    .filter((it: any) => it?.id?.videoId)
    .map((it: any) => ({
      videoId: it.id.videoId,
      title: dec(it.snippet?.title || ""),
      publishedAt: it.snippet?.publishedAt || "",
      thumb:
        it.snippet?.thumbnails?.medium?.url ||
        `https://i.ytimg.com/vi/${it.id.videoId}/mqdefault.jpg`,
    }));
  if (items.length === 0) throw new Error("YouTube API: nenhum vídeo");
  return items;
}

// --- Fonte 2: RSS público (fallback, sujeito a bloqueio) ---
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
  // Cache fresco?
  const fresco = getCache();
  if (fresco && fresco.expira > Date.now()) return fresco.itens.slice(0, limit);

  const tentar = async (fn: () => Promise<YouTubeItem[]>) => {
    const itens = await fn();
    const c: CacheData = { itens, expira: Date.now() + CACHE_TTL_MS, salvoEm: Date.now() };
    memCache = c;
    salvarArquivo(c);
    return itens;
  };

  // 1) API oficial (se houver chave)
  const apiKey = (await getSecret("YT_API_KEY").catch(() => null)) || process.env.YT_API_KEY || "";
  if (apiKey) {
    try {
      return (await tentar(() => buscarAPI(apiKey))).slice(0, limit);
    } catch (e: any) {
      console.warn("[youtube] API falhou, tentando RSS:", e?.message || e);
    }
  }

  // 2) RSS (fallback)
  try {
    return (await tentar(() => buscarRSS())).slice(0, limit);
  } catch (e: any) {
    // 3) Cache expirado (nunca ficar vazio)
    const stale = getCache();
    if (stale && stale.itens.length > 0) {
      console.warn("[youtube] todas as fontes falharam, usando cache expirado:", e?.message || e);
      return stale.itens.slice(0, limit);
    }
    throw e; // nunca tivemos nenhum vídeo
  }
}
