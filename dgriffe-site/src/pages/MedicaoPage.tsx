import { useState } from 'react';
import { Ruler, Info } from 'lucide-react';

export default function MedicaoPage() {
  const [activeTab, setActiveTab] = useState<'multifocal' | 'dnp' | 'info'>('multifocal');
  const [unidade, setUnidade] = useState<'mm' | 'cm'>('mm');
  const [altura, setAltura] = useState('');
  const [dnp, setDnp] = useState('');
  const [resultado, setResultado] = useState<string | null>(null);

  const calcular = () => {
    const h = parseFloat(altura);
    const d = parseFloat(dnp);
    if (isNaN(h) || isNaN(d) || h <= 0 || d <= 0) {
      setResultado('Preencha todos os campos com valores válidos.');
      return;
    }
    const fator = unidade === 'mm' ? 1 : 10;
    const hMM = h * fator;
    const dMM = d * fator;
    setResultado(
      `Altura da lente: ${hMM.toFixed(0)} mm\nDNP (Distância Naso-Pupilar): ${dMM.toFixed(0)} mm\n\nEstes valores devem ser informados na sua receita oftalmológica.`
    );
  };

  return (
    <div className="container-site py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <p className="text-neutral-700 font-semibold uppercase tracking-widest text-sm mb-2">Ótica D'Griffe</p>
        <h1 className="section-title mb-4">Medição de Lentes Multifocais</h1>
        <p className="text-neutral-600 max-w-2xl mx-auto">
          Informe os valores da sua receita para obtermos as medidas corretas das suas lentes multifocais.
          Esta ferramenta é para referência — a medição final deve ser feita por um profissional.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        <button
          onClick={() => setActiveTab('multifocal')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'multifocal' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          Lentes Multifocais
        </button>
        <button
          onClick={() => setActiveTab('dnp')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'dnp' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          Medição DNP
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'info' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
          }`}
        >
          Como Medir
        </button>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Conteúdo: Multifocal */}
        {activeTab === 'multifocal' && (
          <div className="card p-6 md:p-8 animate-fade-in">
            <h2 className="text-xl font-bold text-neutral-900 mb-6 flex items-center gap-2">
              <Ruler size={20} className="text-neutral-700" />
              Calculadora de Lentes Multifocais
            </h2>

            {/* Unidade */}
            <div className="flex items-center gap-3 mb-6">
              <p className="text-sm font-medium text-neutral-600">Unidade:</p>
              <button
                onClick={() => setUnidade('mm')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  unidade === 'mm' ? 'bg-neutral-900 text-neutral-900' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                Milímetros (mm)
              </button>
              <button
                onClick={() => setUnidade('cm')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  unidade === 'cm' ? 'bg-neutral-900 text-neutral-900' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                Centímetros (cm)
              </button>
            </div>

            {/* Campos */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Altura da lente ({unidade})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={altura}
                  onChange={(e) => setAltura(e.target.value)}
                  placeholder={`Ex.: ${unidade === 'mm' ? '35' : '3.5'}`}
                  className="w-full h-11 px-4 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
                />
                <p className="text-[10px] text-neutral-400 mt-1">
                  Altura vertical da lente (em {unidade})
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  DNP — Distância Naso-Pupilar ({unidade})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={dnp}
                  onChange={(e) => setDnp(e.target.value)}
                  placeholder={`Ex.: ${unidade === 'mm' ? '60' : '6.0'}`}
                  className="w-full h-11 px-4 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
                />
                <p className="text-[10px] text-neutral-400 mt-1">
                  Distância entre o centro das duas pupilas (em {unidade})
                </p>
              </div>
            </div>

            {/* Resultado */}
            {resultado && (
              <div className="mt-6 bg-neutral-100 rounded-xl p-4 border border-neutral-300">
                <p className="text-sm font-medium text-gray-700 mb-1">Resultado:</p>
                <pre className="text-sm text-neutral-900 whitespace-pre-wrap font-mono">
                  {resultado}
                </pre>
              </div>
            )}

            <button
              onClick={calcular}
              className="mt-6 w-full h-12 btn-primary flex items-center justify-center gap-2 text-sm"
            >
              <Ruler size={16} />
              Calcular Medidas
            </button>

            <p className="text-[10px] text-neutral-400 text-center mt-4">
              ⚠️ Esta ferramenta é para referência apenas. A medição final deve ser feita por um profissional.
            </p>
          </div>
        )}

        {/* Conteúdo: DNP */}
        {activeTab === 'dnp' && (
          <div className="card p-6 md:p-8 animate-fade-in">
            <h2 className="text-xl font-bold text-neutral-900 mb-6 flex items-center gap-2">
              <Ruler size={20} className="text-neutral-700" />
              Medição DNP (Distância Naso-Pupilar)
            </h2>

            <div className="bg-neutral-100 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong>DNP (Distância Naso-Pupilar)</strong> é a distância entre o centro das duas pupilas.
                Esta medida é essencial para o correto alinhamento das lentes multifocais.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Olho direito ({unidade})
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ex.: 30"
                  className="w-full h-11 px-4 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Olho esquerdo ({unidade})
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ex.: 30"
                  className="w-full h-11 px-4 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
                />
              </div>
            </div>

            <button className="mt-6 w-full h-12 btn-primary flex items-center justify-center gap-2 text-sm">
              <Ruler size={16} />
              Calcular DNP Total
            </button>
          </div>
        )}

        {/* Conteúdo: Como Medir */}
        {activeTab === 'info' && (
          <div className="card p-6 md:p-8 animate-fade-in">
            <h2 className="text-xl font-bold text-neutral-900 mb-6 flex items-center gap-2">
              <Info size={20} className="text-neutral-700" />
              Como Medir Suas Lentes
            </h2>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-neutral-700 font-bold text-sm">1</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 mb-1">Altura da Lente</h4>
                  <p className="text-[13px] text-neutral-600 leading-relaxed">
                    Meça a altura vertical da lente, do topo até a base, usando uma régua.
                    O valor típico varia entre 30mm e 40mm.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-neutral-700 font-bold text-sm">2</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 mb-1">DNP (Distância Naso-Pupilar)</h4>
                  <p className="text-[13px] text-neutral-600 leading-relaxed">
                    Posicione-se em frente a um espelho e marque o centro de cada pupila.
                    Meça a distância entre as marcas. O valor típico varia entre 54mm e 72mm.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-neutral-700 font-bold text-sm">3</span>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 mb-1">Informe na Receita</h4>
                  <p className="text-[13px] text-neutral-600 leading-relaxed">
                    Leve estes valores ao seu oftalmologista e solicite que sejam incluídos na receita.
                    A DNP correta é fundamental para o conforto visual com lentes multifocais.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-amber-50 rounded-xl p-4 border border-amber-100">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Importante:</strong> Esta ferramenta é apenas uma referência. A medição final deve ser feita por um profissional qualificado na nossa loja.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
