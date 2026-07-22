import { useEffect, useState } from "react";

interface YouTubeVideoProps {
  videoId: string;
  title: string;
  description?: string;
  date?: string;
  publishedAt?: string;
}

// Fallback caso a API do YouTube falhe (mantém a seção funcionando offline).
const FALLBACK: YouTubeVideoProps[] = [
  {
    videoId: "kvRBUpvzow0",
    title: "Desvio Ocular Latente / Manifesto",
    description:
      "Um desvio ocular pode começar de forma quase imperceptível… Mas quando não tratado, pode evoluir e causar consequências sérias.",
    date: "21 Mai 2026",
  },
  {
    videoId: "wR1fuFuFjrk",
    title: "Como Curar O Desvio Ocular",
    description:
      "Nem todo desvio ocular é visível. Muitas pessoas convivem com o estrabismo sem entender os sinais.",
    date: "14 Mai 2026",
  },
  {
    videoId: "4Bep6dEmx50",
    title: "Ambliopia / Olho Preguiçoso",
    description:
      "Você sabia que pode perder a visão de um dos olhos de forma irreversível se não tratado a tempo?",
    date: "12 Mar 2026",
  },
];

function formatarData(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

// Mescla os dados da API com descrições do fallback (a API não devolve descrição).
function mesclar(api: YouTubeVideoProps[]): YouTubeVideoProps[] {
  return api.map((v) => {
    const fb = FALLBACK.find((f) => f.videoId === v.videoId);
    return {
      ...v,
      description: fb?.description,
      date: formatarData(v.publishedAt),
    };
  });
}

export default function YouTubeSection() {
  const [videos, setVideos] = useState<YouTubeVideoProps[]>(FALLBACK);

  useEffect(() => {
    let ativo = true;
    fetch("/api/youtube/latest")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const lista = Array.isArray(d?.videos) ? d.videos : [];
        if (ativo && lista.length > 0) setVideos(mesclar(lista));
      })
      .catch(() => {
        /* mantém o fallback */
      })
      .finally(() => {
        ativo = false;
      });
    return () => {
      ativo = false;
    };
  }, []);

  const latestVideo = videos[0];

  return (
    <div className="mx-4 mb-5">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-luxury-black leading-tight">D'Griffe no YouTube</h3>
            <p className="text-[9px] text-gray-400">Dicas de saúde visual</p>
          </div>
        </div>
        <a
          href="https://youtube.com/@dgriffe"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-semibold text-gold uppercase tracking-wider flex items-center gap-1 hover:text-gold-dark transition-colors"
        >
          Inscreva-se
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </a>
      </div>

      {/* Featured Video - Large */}
      <div className="bg-luxury-black rounded-3xl overflow-hidden shadow-lg">
        {/* Video Player */}
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${latestVideo.videoId}?rel=0&modestbranding=1`}
            title={latestVideo.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>

        {/* Video Info */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-luxury-gray rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-gold-gradient text-xs font-bold">D'G</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white text-sm font-bold leading-tight mb-1 line-clamp-2">
                {latestVideo.title}
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-[10px]">Ótica D'Griffe</span>
                <span className="text-white/20 text-[8px]">•</span>
                <span className="text-white/40 text-[10px]">{latestVideo.date}</span>
              </div>
              <p className="text-white/30 text-[10px] leading-relaxed mt-1.5 line-clamp-2">
                {latestVideo.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* More Videos - Horizontal */}
      <div className="flex gap-3 mt-3 overflow-x-auto no-scrollbar -mx-1 px-1">
        {videos.slice(1).map((video) => (
          <a
            key={video.videoId}
            href={`https://www.youtube.com/watch?v=${video.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 w-44 group"
          >
            {/* Thumbnail */}
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-luxury-dark mb-2">
              <img
                src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
                alt={video.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              {/* Play overlay */}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A0A0A">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              {/* Duration badge */}
              <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[8px] text-white font-medium">
                ▶ YouTube
              </div>
            </div>
            <p className="text-[11px] font-semibold text-luxury-black leading-tight line-clamp-2 group-hover:text-gold transition-colors">
              {video.title}
            </p>
            <p className="text-[9px] text-gray-400 mt-0.5">{video.date}</p>
          </a>
        ))}
      </div>

      {/* Subscribe CTA */}
      <div className="mt-4 bg-gradient-to-r from-red-600/10 to-red-600/5 border border-red-600/20 rounded-2xl p-3.5 flex items-center gap-3">
        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-luxury-black">Inscreva-se no canal</p>
          <p className="text-[9px] text-gray-500">Receba dicas de saúde visual e novidades</p>
        </div>
        <a
          href="https://youtube.com/@dgriffe"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-red-600 text-white text-[10px] font-bold rounded-xl hover:bg-red-700 active:scale-95 transition-all flex-shrink-0"
        >
          Inscrever
        </a>
      </div>
    </div>
  );
}
