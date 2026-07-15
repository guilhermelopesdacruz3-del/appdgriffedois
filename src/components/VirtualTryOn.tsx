import { useState, useEffect, useRef, useCallback } from "react";
import { Product } from "../data";

interface VirtualTryOnProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  onAddToCart: (product: Product) => void;
}

type CameraStatus = "requesting" | "active" | "denied" | "unavailable";

export default function VirtualTryOn({ isOpen, onClose, product, onAddToCart }: VirtualTryOnProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("requesting");
  const [selectedColor, setSelectedColor] = useState(0);
  const [captured, setCaptured] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [glassesVisible, setGlassesVisible] = useState(false);
  const [glassesScale, setGlassesScale] = useState(1);
  const [showTip, setShowTip] = useState(true);
  const [useModel, setUseModel] = useState(false);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setCameraStatus("requesting");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraStatus("active");
      // Simulate face scanning
      setScanning(true);
      setTimeout(() => {
        setScanning(false);
        setGlassesVisible(true);
      }, 2000);
    } catch {
      setCameraStatus("denied");
      setUseModel(true);
      // Show model fallback with scanning
      setTimeout(() => {
        setScanning(true);
        setTimeout(() => {
          setScanning(false);
          setGlassesVisible(true);
        }, 1500);
      }, 500);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Initialize on open
  useEffect(() => {
    if (isOpen) {
      setCaptured(false);
      setCountdown(null);
      setScanning(false);
      setGlassesVisible(false);
      setGlassesScale(1);
      setSelectedColor(0);
      setShowTip(true);
      setUseModel(false);
      startCamera();
      // Hide tip after 4s
      const tipTimer = setTimeout(() => setShowTip(false), 4000);
      return () => clearTimeout(tipTimer);
    } else {
      stopCamera();
      setCameraStatus("requesting");
    }
  }, [isOpen, startCamera, stopCamera]);

  // Countdown logic
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCaptured(true);
      setCountdown(null);
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const handleCapture = () => {
    setCountdown(3);
    setShowTip(false);
  };

  const handleRetake = () => {
    setCaptured(false);
    setGlassesVisible(true);
    setCountdown(null);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const currentColor = product.colors[selectedColor] || "#1A1A1A";
  const frameColor = currentColor;
  const isGoldColor = currentColor === "#D4A853" || currentColor === "#E8C878" || currentColor === "#B8860B" || currentColor === "#FFD700";
  const isSilverColor = currentColor === "#C0C0C0" || currentColor === "#DCDCDC";

  // Generate glasses SVG based on product category and style
  const renderGlassesSVG = (scale: number = 1) => {
    const lensFill = product.category === "Sol" ? "rgba(0,0,0,0.45)" : "rgba(200,200,200,0.1)";
    const frameStroke = isGoldColor ? "#D4A853" : isSilverColor ? "#C0C0C0" : frameColor;
    const bridgeColor = isGoldColor ? "#D4A853" : isSilverColor ? "#C0C0C0" : frameColor;

    return (
      <svg
        width={220 * scale}
        height={90 * scale}
        viewBox="0 0 220 90"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
        style={{
          filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))",
        }}
      >
        {/* Left lens */}
        <ellipse cx="55" cy="45" rx="42" ry="34" fill={lensFill} stroke={frameStroke} strokeWidth={3} />
        {/* Right lens */}
        <ellipse cx="165" cy="45" rx="42" ry="34" fill={lensFill} stroke={frameStroke} strokeWidth={3} />
        {/* Bridge */}
        <path d="M97 40 Q110 30 123 40" stroke={bridgeColor} strokeWidth={3} fill="none" strokeLinecap="round" />
        {/* Left temple (arm) */}
        <path d="M13 38 L2 34" stroke={frameStroke} strokeWidth={3} strokeLinecap="round" />
        {/* Right temple (arm) */}
        <path d="M207 38 L218 34" stroke={frameStroke} strokeWidth={3} strokeLinecap="round" />
        {/* Lens reflections */}
        <ellipse cx="40" cy="35" rx="12" ry="6" fill="rgba(255,255,255,0.12)" transform="rotate(-15 40 35)" />
        <ellipse cx="150" cy="35" rx="12" ry="6" fill="rgba(255,255,255,0.12)" transform="rotate(-15 150 35)" />
      </svg>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black animate-fade-in">
      <div className="relative w-full h-full">
        {/* ========== CAMERA / MODEL VIEW ========== */}
        <div className="absolute inset-0">
          {/* Live camera feed */}
          {cameraStatus === "active" && !useModel && (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
              playsInline
              muted
              autoPlay
            />
          )}

          {/* Model fallback */}
          {(useModel || cameraStatus === "denied") && (
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
              <img
                src="/images/face-silhouette.jpg"
                alt="Modelo"
                className="absolute inset-0 w-full h-full object-cover opacity-80"
              />
              <div className="absolute inset-0 bg-black/20" />
              {/* Camera unavailable notice */}
              {cameraStatus === "denied" && (
                <div className="absolute top-20 left-4 right-4 z-30">
                  <div className="bg-black/60 backdrop-blur-sm rounded-2xl p-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-gold/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A853" strokeWidth="2">
                        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white text-[11px] font-semibold">Câmera não disponível</p>
                      <p className="text-white/50 text-[9px]">Usando modelo para demonstração</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {cameraStatus === "requesting" && !useModel && (
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center">
              <div className="w-16 h-16 border-2 border-gold/30 border-t-gold rounded-full animate-spin mb-4" />
              <p className="text-white/70 text-xs">Acessando câmera...</p>
            </div>
          )}
        </div>

        {/* ========== FACE SCAN ANIMATION ========== */}
        {scanning && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="absolute inset-0 flex items-center justify-center" style={{ marginTop: "-30px" }}>
              <div className="relative w-56 h-72">
                {/* Scan corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-gold rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-gold rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-gold rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-gold rounded-br-lg" />
                {/* Horizontal scan line */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent animate-scan-line"
                  style={{
                    animation: "scanLine 2s ease-in-out infinite",
                    top: "0%",
                  }}
                />
              </div>
            </div>
            <div className="absolute bottom-44 left-0 right-0 text-center">
              <p className="text-gold text-[11px] font-semibold tracking-wider">DETECTANDO ROSTO...</p>
            </div>
          </div>
        )}

        {/* ========== GLASSES OVERLAY ========== */}
        {glassesVisible && !captured && (
          <div
            className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center"
            style={{ marginTop: "-55px" }}
          >
            <div
              className="transition-all duration-300"
              style={{ transform: `scale(${glassesScale})` }}
            >
              {renderGlassesSVG(1)}
            </div>
          </div>
        )}

        {/* ========== CAPTURED STATE ========== */}
        {captured && (
          <div className="absolute inset-0 z-10 animate-fade-in">
            {/* Dim overlay */}
            <div className="absolute inset-0 bg-black/10" />
            {/* Glasses on captured */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ marginTop: "-55px" }}
            >
              {renderGlassesSVG(1)}
            </div>
            {/* "Foto Capturada" badge */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
              <div className="bg-gold text-luxury-black px-4 py-1.5 rounded-full flex items-center gap-1.5 animate-scale-in">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-[11px] font-bold">Foto Capturada</span>
              </div>
            </div>
          </div>
        )}

        {/* ========== COUNTDOWN ========== */}
        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <div className="relative">
              <span className="text-8xl font-bold text-white" style={{
                textShadow: "0 0 40px rgba(212,168,83,0.5), 0 0 80px rgba(212,168,83,0.2)",
              }}>
                {countdown}
              </span>
            </div>
          </div>
        )}

        {/* ========== TOP BAR ========== */}
        <div className="absolute top-0 left-0 right-0 z-20 safe-area-top">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <button
              onClick={handleClose}
              className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center active:scale-95 transition-transform"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="bg-black/40 backdrop-blur-md rounded-full px-4 py-1.5 flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${glassesVisible ? "bg-green-400" : "bg-gold animate-pulse"}`} />
              <span className="text-white text-[11px] font-semibold tracking-wide">
                {scanning ? "Escaneando" : glassesVisible ? "Provador AR" : "Preparando"}
              </span>
            </div>
            <button
              onClick={() => {
                stopCamera();
                setCameraStatus("requesting");
                setUseModel(false);
                setGlassesVisible(false);
                setScanning(false);
                startCamera();
              }}
              className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center active:scale-95 transition-transform"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>

        {/* ========== TIP BANNER ========== */}
        {showTip && glassesVisible && !captured && (
          <div className="absolute top-16 left-4 right-4 z-20 animate-slide-down">
            <div className="bg-gold/90 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="text-lg">💡</span>
              <div>
                <p className="text-luxury-black text-[11px] font-bold">Mantenha o rosto centralizado</p>
                <p className="text-luxury-black/70 text-[9px]">Os óculos se ajustam automaticamente ao seu rosto</p>
              </div>
            </div>
          </div>
        )}

        {/* ========== PRODUCT INFO & COLOR ========== */}
        <div className="absolute bottom-36 left-0 right-0 z-20 px-4">
          <div className="bg-black/50 backdrop-blur-md rounded-2xl p-4 border border-white/5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D4A853" strokeWidth="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-bold truncate">{product.name}</p>
                <p className="text-white/40 text-[9px]">{product.brand}</p>
              </div>
            </div>
            {/* Color selector */}
            <div className="flex items-center justify-center gap-3">
              {product.colors.map((color, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedColor(i)}
                  className={`relative w-9 h-9 rounded-full transition-all duration-200 ${
                    selectedColor === i
                      ? "ring-2 ring-gold ring-offset-2 ring-offset-black/80 scale-110"
                      : "ring-1 ring-white/25 hover:ring-white/50"
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {selectedColor === i && (
                    <svg className="absolute inset-0 m-auto" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <p className="text-white/50 text-[10px] text-center mt-2">{product.colorNames[selectedColor]}</p>
            {/* Size slider */}
            <div className="mt-3 flex items-center gap-3">
              <span className="text-white/40 text-[9px]">A</span>
              <input
                type="range"
                min="0.7"
                max="1.3"
                step="0.05"
                value={glassesScale}
                onChange={(e) => setGlassesScale(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-gold"
              />
              <span className="text-white/40 text-[10px]">A</span>
            </div>
          </div>
        </div>

        {/* ========== BOTTOM CONTROLS ========== */}
        <div className="absolute bottom-6 left-0 right-0 z-20 pb-[env(safe-area-inset-bottom)]">
          {!captured ? (
            <div className="flex items-center justify-center gap-8">
              {/* Gallery button */}
              <button
                onClick={() => {
                  stopCamera();
                  setUseModel(true);
                  setCameraStatus("denied");
                  setGlassesVisible(false);
                  setScanning(true);
                  setTimeout(() => {
                    setScanning(false);
                    setGlassesVisible(true);
                  }, 1500);
                }}
                className="w-12 h-12 bg-black/30 backdrop-blur-md rounded-2xl flex items-center justify-center"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </button>

              {/* Capture button */}
              <button
                onClick={handleCapture}
                disabled={countdown !== null || !glassesVisible}
                className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all disabled:opacity-40 active:scale-95"
              >
                <div className="absolute inset-0 rounded-full border-4 border-white/80" />
                <div className="w-[58px] h-[58px] bg-white rounded-full" />
              </button>

              {/* Flip camera / model toggle */}
              <button
                onClick={() => {
                  stopCamera();
                  setCameraStatus("requesting");
                  setGlassesVisible(false);
                  startCamera();
                }}
                className="w-12 h-12 bg-black/30 backdrop-blur-md rounded-2xl flex items-center justify-center"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-5">
              {/* Retake */}
              <button
                onClick={handleRetake}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="w-14 h-14 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                  </svg>
                </div>
                <span className="text-white/60 text-[10px] font-medium">Refazer</span>
              </button>

              {/* Save */}
              <button className="flex flex-col items-center gap-1.5">
                <div className="w-16 h-16 bg-gold rounded-full flex items-center justify-center shadow-lg shadow-gold/30">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </div>
                <span className="text-white/60 text-[10px] font-medium">Salvar</span>
              </button>

              {/* Add to cart */}
              <button
                onClick={() => {
                  handleClose();
                  onAddToCart(product);
                }}
                className="flex flex-col items-center gap-1.5"
              >
                <div className="w-14 h-14 bg-luxury-black border border-white/20 rounded-full flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 01-8 0" />
                  </svg>
                </div>
                <span className="text-white/60 text-[10px] font-medium">Comprar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
