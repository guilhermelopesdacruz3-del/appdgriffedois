import { useEffect, useCallback } from "react";

interface ImageViewerProps {
  isOpen: boolean;
  imageUrl: string;
  title: string;
  brand: string;
  onClose: () => void;
}

export default function ImageViewer({ isOpen, imageUrl, title, brand, onClose }: ImageViewerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] animate-fade-in" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/95" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-gold text-[10px] font-semibold uppercase tracking-wider">{brand}</p>
            <p className="text-white text-xs font-bold">{title}</p>
          </div>
          <div className="w-10 h-10" />
        </div>

        {/* Image */}
        <div className="flex-1 flex items-center justify-center px-4 min-h-0">
          <img
            src={imageUrl}
            alt={title}
            className="max-w-full max-h-full object-contain animate-scale-in"
            style={{ borderRadius: "1rem" }}
          />
        </div>

        {/* Bottom hint */}
        <div className="flex-shrink-0 text-center pb-6">
          <p className="text-white/30 text-[10px]">Toque fora para fechar</p>
        </div>
      </div>
    </div>
  );
}
