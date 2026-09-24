import { useState, useRef, useEffect, useCallback } from 'react';
import type { Product } from '../../data/types';

interface DnpMeasurement {
  dnpOD: number;
  dnpOE: number;
  heightOD: number;
  heightOE: number;
  headTilt: number;
}

interface MultifocalResult {
  lensHeightOD: number;
  lensHeightOE: number;
  segHeightOD: number;
  segHeightOE: number;
  readingDistanceOD: number;
  readingDistanceOE: number;
  nearPointOD: number;
  nearPointOE: number;
}

interface MedicaoDnpProps {
  product: Product | null;
  onAddToCart: (item: any) => void;
  onClose: () => void;
}

// MediaPipe FaceMesh landmarks (índices corretos)
const LM = {
  NOSE_TIP: 1,
  NOSE_BRIDGE: 6,
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

export default function MedicaoDnp({ product, onAddToCart, onClose }: MedicaoDnpProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  const [isCalibrated, setIsCalibrated] = useState(false);
  const [mmPerPx, setMmPerPx] = useState(0.182);

  const [landmarks, setLandmarks] = useState<any>(null);
  const [alignment, setAlignment] = useState({
    isFaceDetected: false,
    isLevel: true,
    headTilt: 0,
    distance: 'optimal' as 'too_close' | 'too_far' | 'optimal',
  });

  const [measurement, setMeasurement] = useState<DnpMeasurement | null>(null);
  const [takes, setTakes] = useState<DnpMeasurement[]>([]);
  const [activeTab, setActiveTab] = useState<'camera' | 'manual' | 'result'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Carregar MediaPipe FaceMesh
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if ((window as any).FaceMesh) {
          initFaceMesh((window as any).FaceMesh);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1675465619/face_mesh.js';
        script.crossOrigin = 'anonymous';
        script.onload = () => {
          if (cancelled) return;
          initFaceMesh((window as any).FaceMesh);
        };
        script.onerror = () => {
          if (cancelled) return;
          setCameraError('Erro ao carregar MediaPipe. Verifique sua conexão.');
        };
        document.body.appendChild(script);
      } catch (err) {
        if (cancelled) return;
        setCameraError('Erro ao inicializar MediaPipe.');
      }
    };

    const initFaceMesh = (FaceMesh: any) => {
      const fm = new FaceMesh({
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

    load();
    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Processar resultados do MediaPipe
  const handleResults = useCallback((results: any) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      setAlignment(prev => ({ ...prev, isFaceDetected: false }));
      setLandmarks(null);
      return;
    }

    const lm = results.multiFaceLandmarks[0];
    setLandmarks(lm);

    // Verificar alinhamento
    const leftEye = lm[LM.LEFT_EYE_OUTER];
    const rightEye = lm[LM.RIGHT_EYE_OUTER];
    const tilt = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

    const eyeDist = Math.sqrt(
      Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2)
    );

    let distance: 'too_close' | 'too_far' | 'optimal' = 'optimal';
    if (eyeDist < 80) distance = 'too_far';
    else if (eyeDist > 180) distance = 'too_close';

    setAlignment({
      isFaceDetected: true,
      isLevel: Math.abs(tilt) < 5,
      headTilt: tilt,
      distance,
    });

    // Calcular DNP e altura se calibrado
    if (isCalibrated && mmPerPx > 0) {
      const nose = lm[LM.NOSE_TIP];
      const pupilL = lm[LM.LEFT_PUPIL];
      const pupilR = lm[LM.RIGHT_PUPIL];

      // DNP horizontal: nariz → pupila (em px → mm)
      const dnpOE = Math.abs(pupilL.x - nose.x) * mmPerPx;
      const dnpOD = Math.abs(pupilR.x - nose.x) * mmPerPx;

      // Altura pupilar: distância vertical da pupila até a pálpebra inferior do olho
      const eyeBottomL = lm[LM.LEFT_EYE_BOTTOM];
      const eyeBottomR = lm[LM.RIGHT_EYE_BOTTOM];

      // Altura pupilar = distância da pupila até a base do olho (mm)
      const heightOE = Math.abs(pupilL.y - eyeBottomL.y) * mmPerPx;
      const heightOD = Math.abs(pupilR.y - eyeBottomR.y) * mmPerPx;

      setMeasurement({
        dnpOD: Math.round(dnpOD * 10) / 10,
        dnpOE: Math.round(dnpOE * 10) / 10,
        heightOD: Math.round(heightOD * 10) / 10,
        heightOE: Math.round(heightOE * 10) / 10,
        headTilt: Math.round(tilt * 10) / 10,
      });
    }
  }, [isCalibrated, mmPerPx]);

  // Loop de processamento de frames
  const processFrame = useCallback(async () => {
    if (videoRef.current && faceMeshRef.current && videoRef.current.readyState >= 2) {
      try {
        await faceMeshRef.current.send({ image: videoRef.current });
      } catch (err) {
        // silent fail
      }
    }
    animFrameRef.current = requestAnimationFrame(processFrame);
  }, []);

  // Iniciar câmera
  const startCamera = useCallback(async () => {
    try {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraError(null);
        // Iniciar loop de processamento
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        processFrame();
      }
    } catch (err) {
      setCameraError('Câmera não disponível ou permissão negada. Use o modo manual.');
    }
  }, [processFrame]);

  // Parar câmera
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = null;
  }, []);

  // Calibrar com cartão de crédito (85.6mm)
  const handleCalibrate = () => {
    if (!landmarks) return;
    // Usar largura do cartão de crédito como referência (85.6mm ISO)
    // O usuário deve posicionar o cartão na testa/entre os olhos
    // Alternativa: usar a distância entre os olhos como referência
    const leftEye = landmarks[LM.LEFT_EYE_OUTER];
    const rightEye = landmarks[LM.RIGHT_EYE_OUTER];
    const faceWidthPx = Math.sqrt(
      Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2)
    );
    // Largura média do rosto adulto ≈ 140mm (orelha a orelha)
    // Usamos a distância entre os cantos dos olhos como referência
    // Distância média entre cantos externos dos olhos ≈ 90mm
    const calculatedMmPerPx = 90 / faceWidthPx;
    setMmPerPx(calculatedMmPerPx);
    setIsCalibrated(true);
  };

  // Calcular multifocal
  const calculateMultifocal = useCallback((): MultifocalResult | null => {
    if (!measurement) return null;

    // Altura da lente = altura pupilar + margem inferior (12mm padrão óptico)
    const lensHeightOD = measurement.heightOD + 12;
    const lensHeightOE = measurement.heightOE + 12;

    // Segmento (visão de perto) = 33% da altura da lente
    const segHeightOD = Math.round(lensHeightOD * 0.33 * 10) / 10;
    const segHeightOE = Math.round(lensHeightOE * 0.33 * 10) / 10;

    // Distância de leitura (mm) = altura pupila × 2.5
    const readingDistanceOD = Math.round(measurement.heightOD * 2.5 * 10) / 10;
    const readingDistanceOE = Math.round(measurement.heightOE * 2.5 * 10) / 10;

    // Ponto próximo = distância de leitura - altura pupila
    const nearPointOD = Math.round((readingDistanceOD - measurement.heightOD) * 10) / 10;
    const nearPointOE = Math.round((readingDistanceOE - measurement.heightOE) * 10) / 10;

    return {
      lensHeightOD: Math.round(lensHeightOD * 10) / 10,
      lensHeightOE: Math.round(lensHeightOE * 10) / 10,
      segHeightOD, segHeightOE,
      readingDistanceOD, readingDistanceOE,
      nearPointOD, nearPointOE,
    };
  }, [measurement]);

  // Salvar tomada
  const handleSaveTake = () => {
    if (!measurement) return;
    setTakes(prev => [measurement, ...prev]);
  };

  // Adicionar ao carrinho
  const handleAddToCart = () => {
    if (!measurement || !product) return;
    const mf = calculateMultifocal();
    onAddToCart({
      productId: product.id,
      productName: product.name,
      productImage: product.image,
      price: product.price,
      quantidade: 1,
      variacao: `DNP OD:${measurement.dnpOD} OE:${measurement.dnpOE} | Alt OD:${measurement.heightOD} OE:${measurement.heightOE}`,
      frameOnly: false,
      cpf: '',
      dnp: { od: measurement.dnpOD, oe: measurement.dnpOE },
      multifocal: mf,
    });
    onClose();
  };

  const multifocal = calculateMultifocal();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-ice-dark px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gold font-semibold uppercase tracking-widest">Medição DNP</p>
              <h2 className="text-lg font-bold text-luxury-black">Medição de Lentes Multifocais</h2>
            </div>
            <button onClick={() => { stopCamera(); onClose(); }} className="w-8 h-8 rounded-full bg-ice flex items-center justify-center hover:bg-ice-dark transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { id: 'camera' as const, label: 'Câmera', icon: '📷' },
              { id: 'manual' as const, label: 'Manual', icon: '✏️' },
              { id: 'result' as const, label: 'Resultado', icon: '📊' },
            ].map(tab => (
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

          {/* Câmera */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              {cameraError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  {cameraError}
                </div>
              )}
              <div className="relative aspect-video bg-ice rounded-2xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                {/* Status overlay */}
                <div className="absolute top-4 left-4 bg-black/60 rounded-xl px-3 py-2 text-xs text-white">
                  {!alignment.isFaceDetected ? (
                    <p className="text-yellow-400">⚠️ Posicione seu rosto na câmera</p>
                  ) : !alignment.isLevel ? (
                    <p className="text-yellow-400">⚠️ Alinhe sua cabeça ({alignment.headTilt.toFixed(1)}°)</p>
                  ) : alignment.distance !== 'optimal' ? (
                    <p className="text-yellow-400">⚠️ {alignment.distance === 'too_close' ? 'Afaste-se' : 'Aproxim-se'}</p>
                  ) : (
                    <p className="text-green-400">✅ Alinhamento OK</p>
                  )}
                </div>
                <div className="absolute top-4 right-4 bg-black/60 rounded-xl px-3 py-2 text-xs">
                  {isCalibrated ? (
                    <p className="text-green-400">✅ Calibrado ({mmPerPx.toFixed(4)} mm/px)</p>
                  ) : (
                    <p className="text-yellow-400">⚠️ Necessário calibrar</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={startCamera}
                  className="flex-1 h-12 rounded-xl bg-luxury-black text-white text-sm font-semibold hover:bg-luxury-dark transition-colors"
                >
                  📷 Iniciar Câmera
                </button>
                {!isCalibrated && (
                  <button
                    onClick={handleCalibrate}
                    disabled={!alignment.isFaceDetected}
                    className="flex-1 h-12 rounded-xl bg-gold text-luxury-black text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    📐 Calibrar (distância entre olhos ≈ 90mm)
                  </button>
                )}
                {isCalibrated && (
                  <>
                    <button
                      onClick={handleSaveTake}
                      disabled={!measurement}
                      className="flex-1 h-12 rounded-xl bg-luxury-black text-white text-sm font-semibold hover:bg-luxury-dark transition-colors disabled:opacity-50"
                    >
                      💾 Salvar Tomada
                    </button>
                    <button
                      onClick={() => setActiveTab('result')}
                      disabled={!measurement}
                      className="flex-1 h-12 rounded-xl btn-gold text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50"
                    >
                      📊 Ver Resultado
                    </button>
                  </>
                )}
              </div>

              {measurement && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-ice rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">DNP OD</p>
                    <p className="text-xl font-bold text-luxury-black">{measurement.dnpOD}mm</p>
                  </div>
                  <div className="bg-ice rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">DNP OE</p>
                    <p className="text-xl font-bold text-luxury-black">{measurement.dnpOE}mm</p>
                  </div>
                  <div className="bg-ice rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Altura OD</p>
                    <p className="text-xl font-bold text-luxury-black">{measurement.heightOD}mm</p>
                  </div>
                  <div className="bg-ice rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Altura OE</p>
                    <p className="text-xl font-bold text-luxury-black">{measurement.heightOE}mm</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
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
                  <label className="text-xs font-medium text-gray-700 block mb-1">Altura pupila OD (mm)</label>
                  <input type="number" value={measurement?.heightOD || ''} onChange={e => setMeasurement(p => ({ ...p!, heightOD: parseFloat(e.target.value) || 0 }))} placeholder="19.5" className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Altura pupila OE (mm)</label>
                  <input type="number" value={measurement?.heightOE || ''} onChange={e => setMeasurement(p => ({ ...p!, heightOE: parseFloat(e.target.value) || 0 }))} placeholder="19.8" className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold" />
                </div>
              </div>
              <button onClick={() => setActiveTab('result')} className="w-full h-12 rounded-xl btn-gold text-sm font-bold hover:brightness-110 transition-all">
                📊 Calcular Resultado
              </button>
            </div>
          )}

          {/* Resultado */}
          {activeTab === 'result' && measurement && multifocal && (
            <div className="space-y-6">
              <div className="bg-ice rounded-2xl p-5">
                <h3 className="text-sm font-bold text-luxury-black mb-4">👁️ DNP Horizontal</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">OD (Direito)</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.dnpOD}mm</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">OE (Esquerdo)</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.dnpOE}mm</p>
                  </div>
                </div>
              </div>

              <div className="bg-ice rounded-2xl p-5">
                <h3 className="text-sm font-bold text-luxury-black mb-4">📏 Altura Pupilar</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">OD</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.heightOD}mm</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">OE</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.heightOE}mm</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-luxury-black to-luxury-dark rounded-2xl p-5 text-white">
                <h3 className="text-sm font-bold mb-4">🔬 Cálculo Multifocal</h3>
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
                    <p className="text-[9px] text-gray-300 uppercase">Leitura OD</p>
                    <p className="text-xl font-bold text-gold">{multifocal.readingDistanceOD}mm</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3">
                    <p className="text-[9px] text-gray-300 uppercase">Leitura OE</p>
                    <p className="text-xl font-bold text-gold">{multifocal.readingDistanceOE}mm</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleAddToCart} className="flex-1 h-12 rounded-xl btn-gold text-sm font-bold hover:brightness-110 transition-all">
                  🛒 Adicionar com Medidas
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
                    <span className="font-semibold text-luxury-black">OD:{t.dnpOD} OE:{t.dnpOE}</span>
                    <span className="text-gray-500">Alt:{t.heightOD}/{t.heightOE}</span>
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
