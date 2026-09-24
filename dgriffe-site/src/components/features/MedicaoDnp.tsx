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

// MediaPipe FaceMesh landmarks (índices relevantes)
const LANDMARK = {
  NOSE_TIP: 1,      // Ponta do nariz (centro da ponte)
  LEFT_PUPIL: 468,  // Centro da pupila esquerda (íris)
  RIGHT_PUPIL: 473, // Centro da pupila direita (íris)
  LEFT_EYE_OUTER: 33,  // Canto externo olho esquerdo
  LEFT_EYE_INNER: 133, // Canto interno olho esquerdo
  RIGHT_EYE_INNER: 362, // Canto interno olho direito
  RIGHT_EYE_OUTER: 263, // Canto externo olho direito
  FOREHEAD: 10, // Testa (referência)
  CHIN: 152, // Queixo (referência)
  LEFT_EYE_TOP: 159, // Pálpebra superior esquerda
  LEFT_EYE_BOTTOM: 145, // Pálpebra inferior esquerda
  RIGHT_EYE_TOP: 386, // Pálpebra superior direita
  RIGHT_EYE_BOTTOM: 374, // Pálpebra inferior direita
};

export default function MedicaoDnp({ product, onAddToCart, onClose }: MedicaoDnpProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceMeshRef = useRef<any>(null);
  const animationRef = useRef<number | null>(null);

  const [isCalibrated, setIsCalibrated] = useState(false);
  const [mmPerPx, setMmPerPx] = useState(0.182);

  const [landmarks, setLandmarks] = useState<any>(null);
  const [alignment, setAlignment] = useState({
    isFaceDetected: false,
    isLevel: true,
    headTilt: 0,
    distance: 'optimal' as 'too_close' | 'too_far' | 'optimal',
    lighting: 'good' as 'good' | 'low',
  });

  const [measurement, setMeasurement] = useState<DnpMeasurement | null>(null);
  const [takes, setTakes] = useState<DnpMeasurement[]>([]);
  const [activeTab, setActiveTab] = useState<'camera' | 'manual' | 'result'>('camera');

  // Inicializar câmera automaticamente quando entrar na aba camera
  useEffect(() => {
    if (activeTab === 'camera' && !isCalibrated) {
      startCamera('user');
    }
  }, [activeTab]);

  // Inicializar MediaPipe FaceMesh
  useEffect(() => {
    const loadFaceMesh = async () => {
      try {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js';
        script.crossOrigin = 'anonymous';
        script.onload = async () => {
          const faceMesh = new (window as any).FaceMesh({
            locateFile: (file: string) =>
              `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`,
          });
          faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          faceMesh.onResults(handleFaceMeshResults);
          faceMeshRef.current = faceMesh;
        };
        document.body.appendChild(script);
      } catch (err) {
        console.error('Erro ao carregar MediaPipe:', err);
      }
    };
    loadFaceMesh();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Resultados do MediaPipe
  const handleFaceMeshResults = useCallback((results: any) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      setAlignment(prev => ({ ...prev, isFaceDetected: false }));
      setLandmarks(null);
      return;
    }

    const lm = results.multiFaceLandmarks[0];
    setLandmarks(lm);

    // Verificar alinhamento da cabeça
    const leftEye = lm[LANDMARK.LEFT_EYE_OUTER];
    const rightEye = lm[LANDMARK.RIGHT_EYE_OUTER];
    const tilt = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

    const eyeDistance = Math.sqrt(
      Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2)
    );

    let distance: 'too_close' | 'too_far' | 'optimal' = 'optimal';
    if (eyeDistance < 80) distance = 'too_far';
    else if (eyeDistance > 180) distance = 'too_close';

    setAlignment({
      isFaceDetected: true,
      isLevel: Math.abs(tilt) < 5,
      headTilt: tilt,
      distance,
      lighting: 'good',
    });

    // Calcular DNP e altura
    if (isCalibrated && mmPerPx > 0) {
      const pupilL = lm[LANDMARK.LEFT_PUPIL];
      const pupilR = lm[LANDMARK.RIGHT_PUPIL];
      const nose = lm[LANDMARK.NOSE_TIP];

      // DNP horizontal (px → mm)
      const dnpOE = Math.abs(pupilL.x - nose.x) * mmPerPx;
      const dnpOD = Math.abs(pupilR.x - nose.x) * mmPerPx;

      // Altura pupilar (vertical, da pálpebra inferior até a pupila)
      const eyeTopL = lm[LANDMARK.LEFT_EYE_TOP];
      const eyeBottomL = lm[LANDMARK.LEFT_EYE_BOTTOM];
      const eyeTopR = lm[LANDMARK.RIGHT_EYE_TOP];
      const eyeBottomR = lm[LANDMARK.RIGHT_EYE_BOTTOM];

      const eyeHeightPxL = Math.abs(eyeTopL.y - eyeBottomL.y);
      const eyeHeightPxR = Math.abs(eyeTopR.y - eyeBottomR.y);

      const heightOE = eyeHeightPxL * mmPerPx;
      const heightOD = eyeHeightPxR * mmPerPx;

      setMeasurement({
        dnpOD: Math.round(dnpOD * 10) / 10,
        dnpOE: Math.round(dnpOE * 10) / 10,
        heightOD: Math.round(heightOD * 10) / 10,
        heightOE: Math.round(heightOE * 10) / 10,
        headTilt: Math.round(tilt * 10) / 10,
      });
    }
  }, [isCalibrated, mmPerPx]);

  // Iniciar câmera
  const startCamera = useCallback(async (facingMode: 'user' | 'environment' = 'user') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const processFrame = async () => {
        if (videoRef.current && faceMeshRef.current) {
          await faceMeshRef.current.send({ image: videoRef.current });
        }
        animationRef.current = requestAnimationFrame(processFrame);
      };
      processFrame();
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
    }
  }, []);

  // Capturar calibração com cartão
  const handleCalibrate = () => {
    if (!landmarks) return;
    // Medir a largura do rosto entre os olhos como referência
    const leftEye = landmarks[LANDMARK.LEFT_EYE_OUTER];
    const rightEye = landmarks[LANDMARK.RIGHT_EYE_OUTER];
    const faceWidthPx = Math.sqrt(
      Math.pow(rightEye.x - leftEye.x, 2) + Math.pow(rightEye.y - leftEye.y, 2)
    );
    // Cartão de crédito padrão: 85.6mm de largura
    // Assumindo que o cartão está na largura do rosto (aproximação)
    const cardWidthMm = 85.6;
    const calculatedMmPerPx = cardWidthMm / faceWidthPx;
    setMmPerPx(calculatedMmPerPx);
    setIsCalibrated(true);
  };

  // Calcular resultado multifocal
  const calculateMultifocal = useCallback((): MultifocalResult | null => {
    if (!measurement) return null;

    // Altura da lente = altura pupilar + margem inferior (padrão óptico)
    const lensHeightOD = measurement.heightOD + 12; // 12mm abaixo da pupila
    const lensHeightOE = measurement.heightOE + 12;

    // Altura do segmento (visão de perto) = 1/3 da altura da lente
    const segHeightOD = Math.round(lensHeightOD * 0.33 * 10) / 10;
    const segHeightOE = Math.round(lensHeightOE * 0.33 * 10) / 10;

    // Distância de leitura (mm) baseada na altura pupilar
    const readingDistanceOD = Math.round((measurement.heightOD * 2.5) * 10) / 10;
    const readingDistanceOE = Math.round((measurement.heightOE * 2.5) * 10) / 10;

    // Ponto próximo (mm) = distância de leitura - altura pupilar
    const nearPointOD = Math.round((readingDistanceOD - measurement.heightOD) * 10) / 10;
    const nearPointOE = Math.round((readingDistanceOE - measurement.heightOE) * 10) / 10;

    return {
      lensHeightOD: Math.round(lensHeightOD * 10) / 10,
      lensHeightOE: Math.round(lensHeightOE * 10) / 10,
      segHeightOD,
      segHeightOE,
      readingDistanceOD,
      readingDistanceOE,
      nearPointOD,
      nearPointOE,
    };
  }, [measurement]);

  // Salvar tomada
  const handleSaveTake = () => {
    if (!measurement) return;
    setTakes(prev => [measurement, ...prev]);
  };

  // Adicionar ao carrinho com medidas
  const handleAddToCart = () => {
    if (!measurement || !product) return;
    const multifocal = calculateMultifocal();
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
      multifocal,
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
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-ice flex items-center justify-center hover:bg-ice-dark transition-colors">
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
                  activeTab === tab.id
                    ? 'bg-luxury-black text-white'
                    : 'bg-ice text-gray-600 hover:bg-ice-dark'
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
              <div className="relative aspect-video bg-ice rounded-2xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />
                {/* Overlay de alinhamento */}
                <div className="absolute top-4 left-4 bg-black/60 rounded-xl px-3 py-2 text-xs text-white">
                  {!alignment.isFaceDetected ? (
                    <p className="text-yellow-400">⚠️ Posicione seu rosto na câmera</p>
                  ) : !alignment.isLevel ? (
                    <p className="text-yellow-400">⚠️ Alinhe sua cabeça (inclinação: {alignment.headTilt.toFixed(1)}°)</p>
                  ) : alignment.distance === 'too_close' ? (
                    <p className="text-yellow-400">⚠️ Afaste-se um pouco</p>
                  ) : alignment.distance === 'too_far' ? (
                    <p className="text-yellow-400">⚠️ Aproxim-se um pouco</p>
                  ) : (
                    <p className="text-green-400">✅ Alinhamento perfeito!</p>
                  )}
                </div>
                {/* Status da calibração */}
                <div className="absolute top-4 right-4 bg-black/60 rounded-xl px-3 py-2 text-xs">
                  {isCalibrated ? (
                    <p className="text-green-400">✅ Calibrado ({mmPerPx.toFixed(3)} mm/px)</p>
                  ) : (
                    <p className="text-yellow-400">⚠️ Necessário calibrar</p>
                  )}
                </div>
              </div>

              {/* Controles */}
              <div className="flex flex-wrap gap-3">
                {!isCalibrated && (
                  <button
                    onClick={handleCalibrate}
                    className="flex-1 h-12 rounded-xl bg-gold text-luxury-black text-sm font-bold hover:brightness-110 transition-all"
                  >
                    📐 Calibrar com Cartão (85.6mm)
                  </button>
                )}
                {isCalibrated && (
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

              {/* Valores em tempo real */}
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
                  <input
                    type="number"
                    value={measurement?.dnpOD || ''}
                    onChange={(e) => setMeasurement(prev => ({ ...prev!, dnpOD: parseFloat(e.target.value) || 0 }))}
                    placeholder="31.5"
                    className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">DNP OE (mm)</label>
                  <input
                    type="number"
                    value={measurement?.dnpOE || ''}
                    onChange={(e) => setMeasurement(prev => ({ ...prev!, dnpOE: parseFloat(e.target.value) || 0 }))}
                    placeholder="32.0"
                    className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Altura OD (mm)</label>
                  <input
                    type="number"
                    value={measurement?.heightOD || ''}
                    onChange={(e) => setMeasurement(prev => ({ ...prev!, heightOD: parseFloat(e.target.value) || 0 }))}
                    placeholder="19.5"
                    className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Altura OE (mm)</label>
                  <input
                    type="number"
                    value={measurement?.heightOE || ''}
                    onChange={(e) => setMeasurement(prev => ({ ...prev!, heightOE: parseFloat(e.target.value) || 0 }))}
                    placeholder="19.8"
                    className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                  />
                </div>
              </div>
              <button
                onClick={() => setActiveTab('result')}
                className="w-full h-12 rounded-xl btn-gold text-sm font-bold hover:brightness-110 transition-all"
              >
                📊 Calcular Resultado
              </button>
            </div>
          )}

          {/* Resultado Multifocal */}
          {activeTab === 'result' && measurement && multifocal && (
            <div className="space-y-6">
              {/* DNP Horizontal */}
              <div className="bg-ice rounded-2xl p-5">
                <h3 className="text-sm font-bold text-luxury-black mb-4 flex items-center gap-2">
                  👁️ DNP Horizontal (Distância Naso-Pupilar)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Olho Direito (OD)</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.dnpOD}mm</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Olho Esquerdo (OE)</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.dnpOE}mm</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  DP Total: {measurement.dnpOD + measurement.dnpOE}mm | Inclinação: {measurement.headTilt}°
                </p>
              </div>

              {/* Altura Pupilar */}
              <div className="bg-ice rounded-2xl p-5">
                <h3 className="text-sm font-bold text-luxury-black mb-4 flex items-center gap-2">
                  📏 Altura Pupilar (Vertical)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Altura OD</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.heightOD}mm</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Altura OE</p>
                    <p className="text-3xl font-bold text-luxury-black">{measurement.heightOE}mm</p>
                  </div>
                </div>
              </div>

              {/* Cálculo Multifocal */}
              <div className="bg-gradient-to-br from-luxury-black to-luxury-dark rounded-2xl p-5 text-white">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  🔬 Cálculo para Lentes Multifocais
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-[10px] text-gray-300 uppercase tracking-wider">Altura da Lente OD</p>
                    <p className="text-2xl font-bold text-gold">{multifocal.lensHeightOD}mm</p>
                    <p className="text-[10px] text-gray-400 mt-1">Altura pupila + 12mm margem</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-[10px] text-gray-300 uppercase tracking-wider">Altura da Lente OE</p>
                    <p className="text-2xl font-bold text-gold">{multifocal.lensHeightOE}mm</p>
                    <p className="text-[10px] text-gray-400 mt-1">Altura pupila + 12mm margem</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-[10px] text-gray-300 uppercase tracking-wider">Segmento OD</p>
                    <p className="text-2xl font-bold text-gold">{multifocal.segHeightOD}mm</p>
                    <p className="text-[10px] text-gray-400 mt-1">33% da altura da lente</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-[10px] text-gray-300 uppercase tracking-wider">Segmento OE</p>
                    <p className="text-2xl font-bold text-gold">{multifocal.segHeightOE}mm</p>
                    <p className="text-[10px] text-gray-400 mt-1">33% da altura da lente</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-[10px] text-gray-300 uppercase tracking-wider">Distância Leitura OD</p>
                    <p className="text-2xl font-bold text-gold">{multifocal.readingDistanceOD}mm</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <p className="text-[10px] text-gray-300 uppercase tracking-wider">Distância Leitura OE</p>
                    <p className="text-2xl font-bold text-gold">{multifocal.readingDistanceOE}mm</p>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  className="flex-1 h-12 rounded-xl btn-gold text-sm font-bold hover:brightness-110 transition-all"
                >
                  🛒 Adicionar ao Carrinho com Medidas
                </button>
                <button
                  onClick={() => {
                    const data = JSON.stringify({ measurement, multifocal }, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'medidas-multifocal.json';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="h-12 px-4 rounded-xl border border-ice-dark text-gray-600 text-sm font-semibold hover:bg-ice transition-colors"
                >
                  💾 Exportar
                </button>
              </div>
            </div>
          )}

          {/* Tomadas */}
          {takes.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-luxury-black mb-3">Tomadas ({takes.length})</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {takes.map((take, i) => (
                  <div key={i} className="flex items-center justify-between bg-ice rounded-xl px-4 py-2 text-xs">
                    <span className="text-gray-600">#{takes.length - i}</span>
                    <span className="font-semibold text-luxury-black">
                      OD: {take.dnpOD}mm | OE: {take.dnpOE}mm
                    </span>
                    <span className="text-gray-500">
                      Alt: {take.heightOD}/{take.heightOE}mm
                    </span>
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
