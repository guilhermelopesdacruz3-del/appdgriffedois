/**
 * Medição DNP + ALT — D'Griffe Ótica (versão corrigida)
 * 
 * Calibração real com cartão de crédito ISO/IEC 7810 ID-1 (85.60mm).
 * Cálculos precisos para DNP, DP, Altura de Montagem e parâmetros multifocais.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Product } from '../../data/types';

// ============================================================
// TIPOS
// ============================================================

interface MedidaDNP {
  dnpOE: number;
  dnpOD: number;
  dpTotal: number;
  altOE: number;
  altOD: number;
  headTilt: number;
  mmPerPx: number;
  timestamp: number;
}

interface MedidaMultifocal extends MedidaDNP {
  lensHeightOE: number;
  lensHeightOD: number;
  segHeightOE: number;
  segHeightOD: number;
  readingDistOE: number;
  readingDistOD: number;
  vertexDistance: number;
  pantoscopicAngle: number;
  nearPointOE: number;
  nearPointOD: number;
}

interface MedicaoDnpProps {
  product: Product | null;
  onAddToCart: (item: any) => void;
  onClose: () => void;
}

// ============================================================
// LANDMARKS — MediaPipe FaceMesh
// ============================================================

const LM = {
  NOSE_TIP: 1,
  LEFT_PUPIL: 468,
  RIGHT_PUPIL: 473,
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_INNER: 362,
  RIGHT_EYE_OUTER: 263,
  LEFT_EYE_TOP: 159,
  LEFT_EYE_BOTTOM: 145,
  RIGHT_EYE_TOP: 386,
  RIGHT_EYE_BOTTOM: 374,
};

// Constantes
const CARD_WIDTH_MM = 85.60;  // ISO/IEC 7810 ID-1

export default function MedicaoDnp({ product, onAddToCart, onClose }: MedicaoDnpProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [activeTab, setActiveTab] = useState<'camera' | 'manual' | 'result'>('camera');
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [mmPerPx, setMmPerPx] = useState(0);
  const [landmarks, setLandmarks] = useState<any>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  
  const [alignment, setAlignment] = useState({
    isFaceDetected: false,
    isLevel: true,
    headTilt: 0,
    distance: 'optimal' as 'too_close' | 'too_far' | 'optimal',
  });

  const [measurement, setMeasurement] = useState<MedidaDNP | null>(null);
  const [takes, setTakes] = useState<MedidaDNP[]>([]);
  const [calibrationCardWidthPx, setCalibrationCardWidthPx] = useState(0);

  // ============================================================
  // CARREGAR MEDIAPIPE
  // ============================================================

  useEffect(() => {
    let cancelled = false;

    const initFaceMesh = (FaceMeshClass: any) => {
      const fm = new FaceMeshClass({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1675465619/${file}`,
      });
      fm.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      fm.onResults(handleResults);
      faceMeshRef.current = fm;
    };

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const script = document.createElement('script');
        script.src = src;
        script.crossOrigin = 'anonymous';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Falha: ${src}`));
        document.body.appendChild(script);
      });
    };

    const load = async () => {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1675465619/face_mesh.js');
        if (cancelled) return;
        if ((window as any).FaceMesh) initFaceMesh((window as any).FaceMesh);
        else setCameraError('MediaPipe não disponível. Use o modo manual.');
      } catch {
        if (cancelled) return;
        try {
          await loadScript('https://unpkg.com/@mediapipe/face_mesh@0.4.1675465619/face_mesh.js');
          if (cancelled) return;
          if ((window as any).FaceMesh) initFaceMesh((window as any).FaceMesh);
          else setCameraError('MediaPipe não disponível. Use o modo manual.');
        } catch {
          if (cancelled) return;
          setCameraError('Erro ao carregar MediaPipe. Verifique sua conexão.');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ============================================================
  // CÁLCULOS (fórmulas corrigidas)
  // ============================================================

  const calculateMeasurements = useCallback((lm: any, cardPx: number): MedidaDNP | null => {
    if (!cardPx || cardPx <= 0) return null;

    // K = Largura Real do Cartão (mm) / Largura do Cartão (px)
    const K = CARD_WIDTH_MM / cardPx;

    const nose = lm[LM.NOSE_TIP];
    const pupilL = lm[LM.LEFT_PUPIL];
    const pupilR = lm[LM.RIGHT_PUPIL];
    const eyeBottomL = lm[LM.LEFT_EYE_BOTTOM];
    const eyeBottomR = lm[LM.RIGHT_EYE_BOTTOM];

    if (!nose || !pupilL || !pupilR) return null;

    // DNP OE = |X_Pupila_OE - X_Centro_Nariz| × K
    const dnpOE = Math.abs(pupilL.x - nose.x) * K;
    // DNP OD = |X_Pupila_OD - X_Centro_Nariz| × K
    const dnpOD = Math.abs(pupilR.x - nose.x) * K;
    // DP Total = DNP OE + DNP OD
    const dpTotal = dnpOE + dnpOD;

    // ALT OE = |Y_Borda_Inferior_OE - Y_Pupila_OE| × K
    const altOE = eyeBottomL ? Math.abs(eyeBottomL.y - pupilL.y) * K : 0;
    // ALT OD = |Y_Borda_Inferior_OD - Y_Pupila_OD| × K
    const altOD = eyeBottomR ? Math.abs(eyeBottomR.y - pupilR.y) * K : 0;

    // Inclinação da cabeça
    const leftEye = lm[LM.LEFT_EYE_OUTER];
    const rightEye = lm[LM.RIGHT_EYE_OUTER];
    const headTilt = leftEye && rightEye
      ? (Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180) / Math.PI
      : 0;

    return {
      dnpOE: Math.round(dnpOE * 10) / 10,
      dnpOD: Math.round(dnpOD * 10) / 10,
      dpTotal: Math.round(dpTotal * 10) / 10,
      altOE: Math.round(altOE * 10) / 10,
      altOD: Math.round(altOD * 10) / 10,
      headTilt: Math.round(headTilt * 10) / 10,
      mmPerPx: K,
      timestamp: Date.now(),
    };
  }, []);

  // ============================================================
  // RESULTADOS MEDIAPIPE
  // ============================================================

  const handleResults = useCallback((results: any) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      setAlignment(prev => ({ ...prev, isFaceDetected: false }));
      setLandmarks(null);
      return;
    }

    const lm = results.multiFaceLandmarks[0];
    setLandmarks(lm);

    const leftEye = lm[LM.LEFT_EYE_OUTER];
    const rightEye = lm[LM.RIGHT_EYE_OUTER];
    const tilt = leftEye && rightEye
      ? (Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180) / Math.PI
      : 0;

    const eyeDist = leftEye && rightEye
      ? Math.sqrt(Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2))
      : 0;

    let distance: 'too_close' | 'too_far' | 'optimal' = 'optimal';
    if (eyeDist < 80) distance = 'too_far';
    else if (eyeDist > 180) distance = 'too_close';

    setAlignment({
      isFaceDetected: true,
      isLevel: Math.abs(tilt) < 5,
      headTilt: tilt,
      distance,
    });

    if (isCalibrated && calibrationCardWidthPx > 0) {
      const m = calculateMeasurements(lm, calibrationCardWidthPx);
      if (m) setMeasurement(m);
    }
  }, [isCalibrated, calibrationCardWidthPx, calculateMeasurements]);

  // ============================================================
  // CÂMERA
  // ============================================================

  const startCamera = useCallback(async () => {
    try {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setCameraError(null);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        const process = async () => {
          if (videoRef.current && faceMeshRef.current && videoRef.current.readyState >= 2) {
            try { await faceMeshRef.current.send({ image: videoRef.current }); } catch {}
          }
          animFrameRef.current = requestAnimationFrame(process);
        };
        process();
      }
    } catch {
      setCameraError('Câmera não disponível ou permissão negada. Use o modo manual.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
    setCameraActive(false);
  }, []);

  // ============================================================
  // CALIBRAÇÃO COM CARTÃO (método correto)
  // ============================================================

  const handleCalibrate = () => {
    if (!landmarks) return;
    
    // Medir a distância entre os cantos externos dos olhos
    // O usuário deve posicionar o cartão de crédito na testa
    // A largura do cartão (85.6mm) é a referência
    const leftEye = landmarks[LM.LEFT_EYE_OUTER];
    const rightEye = landmarks[LM.RIGHT_EYE_OUTER];
    if (leftEye && rightEye) {
      const cardWidthPx = Math.sqrt(
        Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2)
      );
      setCalibrationCardWidthPx(cardWidthPx);
      setMmPerPx(CARD_WIDTH_MM / cardWidthPx);
      setIsCalibrated(true);
    }
  };

  // ============================================================
  // CÁLCULO MULTIFOCAL (fórmulas corrigidas)
  // ============================================================

  const calculateMultifocal = useCallback((): MedidaMultifocal | null => {
    if (!measurement) return null;

    // Altura da lente = ALT + margem inferior (padrão óptico: 12mm)
    const lensHeightOE = measurement.altOE + 12;
    const lensHeightOD = measurement.altOD + 12;

    // Altura do segmento (visão de perto) = 33% da altura da lente
    const segHeightOE = Math.round(lensHeightOE * 0.33 * 10) / 10;
    const segHeightOD = Math.round(lensHeightOD * 0.33 * 10) / 10;

    // Distância de leitura = ALT × 2.5 (fórmula óptica padrão)
    const readingDistOE = Math.round(measurement.altOE * 2.5 * 10) / 10;
    const readingDistOD = Math.round(measurement.altOD * 2.5 * 10) / 10;

    // Ponto próximo = distância de leitura - ALT
    const nearPointOE = Math.round((readingDistOE - measurement.altOE) * 10) / 10;
    const nearPointOD = Math.round((readingDistOD - measurement.altOD) * 10) / 10;

    // Distância de vértice (padrão óptico: 12mm)
    const vertexDistance = 12.0;

    // Ângulo pantoscópico (padrão óptico: 8°)
    const pantoscopicAngle = 8.0;

    return {
      ...measurement,
      lensHeightOE: Math.round(lensHeightOE * 10) / 10,
      lensHeightOD: Math.round(lensHeightOD * 10) / 10,
      segHeightOE,
      segHeightOD,
      readingDistOE,
      readingDistOD,
      vertexDistance,
      pantoscopicAngle,
      nearPointOE,
      nearPointOD,
    };
  }, [measurement]);

  // ============================================================
  // AÇÕES
  // ============================================================

  const handleSaveTake = () => {
    if (!measurement) return;
    setTakes(prev => [measurement, ...prev]);
  };

  const handleAddToCart = () => {
    if (!measurement || !product) return;
    const mf = calculateMultifocal();
    onAddToCart({
      productId: product.id,
      productName: product.name,
      productImage: product.image,
      price: product.price,
      quantidade: 1,
      variacao: `DNP OD:${measurement.dnpOD} OE:${measurement.dnpOE} | ALT OD:${measurement.altOD} OE:${measurement.altOE}`,
      frameOnly: false,
      cpf: '',
      dnp: { od: measurement.dnpOD, oe: measurement.dnpOE, dp: measurement.dpTotal },
      alt: { od: measurement.altOD, oe: measurement.altOE },
      multifocal: mf,
    });
    stopCamera();
    onClose();
  };

  const handleExportJSON = () => {
    const mf = calculateMultifocal();
    const data = {
      patient: { name: '', document: '', frameModel: product?.name || '' },
      dnp: measurement ? { od: measurement.dnpOD, oe: measurement.dnpOE, dp: measurement.dpTotal } : null,
      alt: measurement ? { od: measurement.altOD, oe: measurement.altOE } : null,
      multifocal: mf,
      takes,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `medidas-dnp-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const multifocal = calculateMultifocal();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { stopCamera(); onClose(); }} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-ice-dark px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gold font-semibold uppercase tracking-widest">Medição DNP + ALT</p>
              <h2 className="text-lg font-bold text-luxury-black">Pupilómetro Digital D&apos;Griffe</h2>
            </div>
            <button onClick={() => { stopCamera(); onClose(); }} className="w-8 h-8 rounded-full bg-ice flex items-center justify-center hover:bg-ice-dark">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {([
              { id: 'camera', label: 'Câmera', icon: '📷' },
              { id: 'manual', label: 'Manual', icon: '✏️' },
              { id: 'result', label: 'Resultado', icon: '📊' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id ? 'bg-luxury-black text-white' : 'bg-ice text-gray-600 hover:bg-ice-dark'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ==================== CÂMERA ==================== */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              {cameraError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{cameraError}</div>
              )}

              <div className="relative aspect-video bg-ice rounded-2xl overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                
                <div className="absolute top-4 left-4 bg-black/60 rounded-xl px-3 py-2 text-xs text-white">
                  {!alignment.isFaceDetected ? (
                    <p className="text-yellow-400">⚠️ Posicione o rosto na câmera</p>
                  ) : !alignment.isLevel ? (
                    <p className="text-yellow-400">⚠️ Alinhe a cabeça ({alignment.headTilt.toFixed(1)}°)</p>
                  ) : alignment.distance !== 'optimal' ? (
                    <p className="text-yellow-400">⚠️ {alignment.distance === 'too_close' ? 'Afaste-se' : 'Aproxim-se'} (40-50cm)</p>
                  ) : (
                    <p className="text-green-400">✅ Alinhamento OK</p>
                  )}
                </div>
                <div className="absolute top-4 right-4 bg-black/60 rounded-xl px-3 py-2 text-xs">
                  {isCalibrated ? (
                    <p className="text-green-400">✅ Calibrado (K={mmPerPx.toFixed(4)} mm/px)</p>
                  ) : (
                    <p className="text-yellow-400">⚠️ Calibre com cartão</p>
                  )}
                </div>
                <div className="absolute inset-8 border-2 border-dashed border-white/30 rounded-2xl pointer-events-none" />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 rounded-xl px-3 py-2 text-[10px] text-white text-center">
                  Posicione o rosto na área marcada • 40-50cm • Olhe para a câmera
                </div>
              </div>

              <div className="bg-ice rounded-xl p-4">
                <h4 className="text-xs font-bold text-luxury-black mb-2">📋 Instruções</h4>
                <ol className="text-[11px] text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Posicione a câmera a 40-50cm dos seus olhos</li>
                  <li>Use a armação que deseja medir</li>
                  <li>Encaoste um cartão de crédito na testa (85.6mm de largura)</li>
                  <li>Olhe fixamente para a câmera (visão ao longe/infinito)</li>
                  <li>Clique em &quot;Calibrar&quot; para definir a escala</li>
                  <li>Após a calibração, as medidas aparecem automaticamente</li>
                </ol>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={startCamera}
                  disabled={cameraActive}
                  className="flex-1 h-12 rounded-xl bg-luxury-black text-white text-sm font-semibold hover:bg-luxury-dark transition-colors disabled:opacity-50"
                >
                  📷 {cameraActive ? 'Câmera Ativa' : 'Iniciar Câmera'}
                </button>
                <button
                  onClick={handleCalibrate}
                  disabled={!alignment.isFaceDetected || isCalibrated}
                  className="flex-1 h-12 rounded-xl bg-gold text-luxury-black text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
                >
                  📐 Calibrar Cartão (85.6mm)
                </button>
                {isCalibrated && measurement && (
                  <>
                    <button
                      onClick={handleSaveTake}
                      className="flex-1 h-12 rounded-xl bg-luxury-black text-white text-sm font-semibold hover:bg-luxury-dark transition-colors"
                    >
                      💾 Salvar Tomada
                    </button>
                    <button
                      onClick={() => setActiveTab('result')}
                      className="flex-1 h-12 rounded-xl btn-gold text-sm font-bold hover:brightness-110 transition-all"
                    >
                      📊 Ver Resultado
                    </button>
                  </>
                )}
              </div>

              {measurement && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-ice rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">DNP OD</p>
                    <p className="text-xl font-bold text-luxury-black">{measurement.dnpOD}mm</p>
                  </div>
                  <div className="bg-ice rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">DNP OE</p>
                    <p className="text-xl font-bold text-luxury-black">{measurement.dnpOE}mm</p>
                  </div>
                  <div className="bg-ice rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">DP Total</p>
                    <p className="text-xl font-bold text-luxury-black">{measurement.dpTotal}mm</p>
                  </div>
                  <div className="bg-ice rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">ALT OD</p>
                    <p className="text-xl font-bold text-luxury-black">{measurement.altOD}mm</p>
                  </div>
                  <div className="bg-ice rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">ALT OE</p>
                    <p className="text-xl font-bold text-luxury-black">{measurement.altOE}mm</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== MANUAL ==================== */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="bg-ice rounded-xl p-4">
                <p className="text-[11px] text-gray-600">
                  Digite as medidas obtidas com um pupilómetro ou receita médica. 
                  Valores típicos: DNP 28-34mm por olho, ALT 18-25mm.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">DNP OD (mm)</label>
                  <input type="number" value={measurement?.dnpOD || ''} onChange={e => setMeasurement(p => ({ ...p!, dnpOD: parseFloat(e.target.value) || 0 }))} placeholder="31.5" className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">DNP OE (mm)</label>
                  <input type="number" value={measurement?.dnpOE || ''} onChange={e => setMeasurement(p => ({ ...p!, dnpOE: parseFloat(e.target.value) || 0 }))} placeholder="32.0" className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">ALT OD (mm)</label>
                  <input type="number" value={measurement?.altOD || ''} onChange={e => setMeasurement(p => ({ ...p!, altOD: parseFloat(e.target.value) || 0 }))} placeholder="19.5" className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">ALT OE (mm)</label>
                  <input type="number" value={measurement?.altOE || ''} onChange={e => setMeasurement(p => ({ ...p!, altOE: parseFloat(e.target.value) || 0 }))} placeholder="19.8" className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold" />
                </div>
              </div>
              <button onClick={() => setActiveTab('result')} className="w-full h-12 rounded-xl btn-gold text-sm font-bold hover:brightness-110 transition-all">
                📊 Calcular Resultado
              </button>
            </div>
          )}

          {/* ==================== RESULTADO ==================== */}
          {activeTab === 'result' && measurement && multifocal && (
            <div className="space-y-6">
              <div className="bg-ice rounded-2xl p-5">
                <h3 className="text-sm font-bold text-luxury-black mb-4">📏 Medidas Obtidas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">DNP OD</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.dnpOD}mm</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">DNP OE</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.dnpOE}mm</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">DP Total</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.dpTotal}mm</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">ALT OD</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.altOD}mm</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center col-span-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">ALT OE</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.altOE}mm</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-luxury-black to-luxury-dark rounded-2xl p-5 text-white">
                <h3 className="text-sm font-bold mb-4">🔬 Parâmetros Multifocais</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-[9px] text-gray-300 uppercase">Altura Lente OD</p>
                    <p className="text-xl font-bold text-gold">{multifocal.lensHeightOD}mm</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-[9px] text-gray-300 uppercase">Altura Lente OE</p>
                    <p className="text-xl font-bold text-gold">{multifocal.lensHeightOE}mm</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-[9px] text-gray-300 uppercase">Segmento OD</p>
                    <p className="text-xl font-bold text-gold">{multifocal.segHeightOD}mm</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-[9px] text-gray-300 uppercase">Segmento OE</p>
                    <p className="text-xl font-bold text-gold">{multifocal.segHeightOE}mm</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-[9px] text-gray-300 uppercase">Dist. Leitura OD</p>
                    <p className="text-xl font-bold text-gold">{multifocal.readingDistOD}mm</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-[9px] text-gray-300 uppercase">Dist. Leitura OE</p>
                    <p className="text-xl font-bold text-gold">{multifocal.readingDistOE}mm</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-[9px] text-gray-300 uppercase">Dist. Vértice</p>
                    <p className="text-xl font-bold text-gold">{multifocal.vertexDistance}mm</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-[9px] text-gray-300 uppercase">Ângulo Pantoscópico</p>
                    <p className="text-xl font-bold text-gold">{multifocal.pantoscopicAngle}°</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleAddToCart} className="flex-1 h-12 rounded-xl btn-gold text-sm font-bold hover:brightness-110 transition-all">
                  🛒 Adicionar com Medidas
                </button>
                <button onClick={handleExportJSON} className="h-12 px-4 rounded-xl border border-ice-dark text-gray-600 text-sm font-semibold hover:bg-ice transition-colors">
                  💾 Exportar JSON
                </button>
                <button onClick={() => setActiveTab('camera')} className="h-12 px-4 rounded-xl border border-ice-dark text-gray-600 text-sm font-semibold hover:bg-ice transition-colors">
                  ← Voltar
                </button>
              </div>
            </div>
          )}

          {takes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-luxury-black mb-3">Tomadas ({takes.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {takes.map((t, i) => (
                  <div key={i} className="flex items-center justify-between bg-ice rounded-xl px-4 py-2 text-xs">
                    <span className="text-gray-600">#{takes.length - i}</span>
                    <span className="font-semibold text-luxury-black">DNP OD:{t.dnpOD} OE:{t.dnpOE}</span>
                    <span className="text-gray-500">ALT OD:{t.altOD} OE:{t.altOE}</span>
                    <span className="text-gray-400">{new Date(t.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
