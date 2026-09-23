import { useState } from 'react';
import { formatPrice } from '../../utils/format';
import type { Product } from '../../data/types';

interface LensesModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (item: any) => void;
}

type LensType = 'sem_grau' | 'grau_simples' | 'grau_alto' | null;
type LensMaterial = 'policarbonato_159' | 'acrilico_156' | null;
type LensTreatment = 'fotossensivel' | 'anti_reflexo_filtro_azul' | 'incolor' | null;

interface DnpValues {
  oe: string;
  od: string;
}

const LENS_PRICES: Record<string, number> = {
  sem_grau: 0,
  grau_simples: 89.90,
  grau_alto: 149.90,
};

const MATERIAL_PRICES: Record<string, number> = {
  policarbonato_159: 59.90,
  acrilico_156: 39.90,
};

const TREATMENT_PRICES: Record<string, number> = {
  fotossensivel: 79.90,
  anti_reflexo_filtro_azul: 49.90,
  incolor: 0,
};

export default function LensesModal({ product, onClose, onAddToCart }: LensesModalProps) {
  const [step, setStep] = useState(1);
  const [lensType, setLensType] = useState<LensType>(null);
  const [material, setMaterial] = useState<LensMaterial>(null);
  const [treatment, setTreatment] = useState<LensTreatment>(null);
  const [cpf, setCpf] = useState('');
  const [sendRecipeNow, setSendRecipeNow] = useState<boolean | null>(null);
  const [recipeFile, setRecipeFile] = useState<File | null>(null);
  const [knowDnp, setKnowDnp] = useState<boolean | null>(null);
  const [dnp, setDnp] = useState<DnpValues>({ oe: '', od: '' });

  const framePrice = product.price;
  const lensesPrice =
    (lensType ? LENS_PRICES[lensType] : 0) +
    (material ? MATERIAL_PRICES[material] : 0) +
    (treatment ? TREATMENT_PRICES[treatment] : 0);
  const totalPrice = framePrice + lensesPrice;

  const progress = (step / 5) * 100;

  const handleFinalize = () => {
    const item = {
      productId: product.id,
      productName: product.name,
      productImage: product.image,
      price: totalPrice,
      quantidade: 1,
      variacao: `${lensType} | ${material} | ${treatment}`,
      frameOnly: false,
      cpf,
      dnp: knowDnp ? dnp : null,
      recipeFile: recipeFile?.name,
    };
    onAddToCart(item);
    onClose();
  };

  const canProceed = () => {
    switch (step) {
      case 1: return lensType !== null;
      case 2: return material !== null;
      case 3: return treatment !== null;
      case 4: return cpf.length >= 11 && sendRecipeNow !== null;
      case 5: return knowDnp !== null && (!knowDnp || (dnp.oe && dnp.od));
      default: return false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-ice-dark px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gold font-semibold uppercase tracking-widest">Monte seu</p>
              <h2 className="text-lg font-bold text-luxury-black">D&apos;Griffe Wonders</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-ice flex items-center justify-center hover:bg-ice-dark transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          {/* Progress Bar */}
          <div className="mt-3 h-1.5 bg-ice rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-gold to-gold-dark transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Etapa {step} de 5</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* ETAPA 1: Tipo de Lente */}
          {step === 1 && (
            <div>
              <h3 className="text-sm font-bold text-luxury-black mb-4">Tipo de Lente</h3>
              <div className="space-y-3">
                {[
                  { id: 'sem_grau', label: 'Sem Grau', desc: 'Lente plana estética com proteção UV', price: 0 },
                  { id: 'grau_simples', label: 'Grau Simples', desc: 'Visão simples: miopia, hipermetropia ou astigmatismo', price: 89.90 },
                  { id: 'grau_alto', label: 'Grau Alto', desc: 'Lentes afinadas para graus mais elevados', price: 149.90 },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setLensType(opt.id as LensType)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      lensType === opt.id ? 'border-gold bg-gold/5' : 'border-ice-dark hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm text-luxury-black">{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                      <span className="text-xs font-bold text-gold">
                        {opt.price > 0 ? `+${formatPrice(opt.price)}` : 'Grátis'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ETAPA 2: Material */}
          {step === 2 && (
            <div>
              <h3 className="text-sm font-bold text-luxury-black mb-4">Tecnologia / Material</h3>
              <div className="space-y-3">
                {[
                  { id: 'policarbonato_159', label: 'Policarbonato 1.59', desc: 'Mais leve e resistente', price: 59.90 },
                  { id: 'acrilico_156', label: 'Acrílico 1.56', desc: 'Transparente e econômico', price: 39.90 },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setMaterial(opt.id as LensMaterial)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      material === opt.id ? 'border-gold bg-gold/5' : 'border-ice-dark hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm text-luxury-black">{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                      <span className="text-xs font-bold text-gold">+{formatPrice(opt.price)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ETAPA 3: Tratamentos */}
          {step === 3 && (
            <div>
              <h3 className="text-sm font-bold text-luxury-black mb-4">Tratamentos</h3>
              <div className="space-y-3">
                {[
                  { id: 'fotossensivel', label: 'Fotossensível', desc: 'Escurece no sol', price: 79.90 },
                  { id: 'anti_reflexo_filtro_azul', label: 'Anti-reflexo + Filtro Azul', desc: 'Proteção para telas digitais', price: 49.90 },
                  { id: 'incolor', label: 'Incolor sem tratamento', desc: 'Lente limpa, sem tratamentos adicionais', price: 0 },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setTreatment(opt.id as LensTreatment)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      treatment === opt.id ? 'border-gold bg-gold/5' : 'border-ice-dark hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm text-luxury-black">{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                      <span className="text-xs font-bold text-gold">
                        {opt.price > 0 ? `+${formatPrice(opt.price)}` : 'Grátis'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ETAPA 4: Receita Médica */}
          {step === 4 && (
            <div>
              <h3 className="text-sm font-bold text-luxury-black mb-4">Receita Médica</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">CPF do cliente</label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="000.000.000-00"
                    className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">Deseja enviar a receita agora?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSendRecipeNow(true)}
                      className={`flex-1 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${
                        sendRecipeNow === true ? 'border-gold bg-gold/10 text-gold' : 'border-ice-dark text-gray-600'
                      }`}
                    >
                      SIM
                    </button>
                    <button
                      onClick={() => setSendRecipeNow(false)}
                      className={`flex-1 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${
                        sendRecipeNow === false ? 'border-gold bg-gold/10 text-gold' : 'border-ice-dark text-gray-600'
                      }`}
                    >
                      NÃO
                    </button>
                  </div>
                </div>
                {sendRecipeNow === true && (
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Upload da receita (JPG, PNG, WEBP, PDF)</label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={(e) => setRecipeFile(e.target.files?.[0] || null)}
                      className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm file:mr-4 file:py-2 file:px-4 file:rounded-l-xl file:border-0 file:bg-ice file:text-xs file:font-semibold"
                    />
                  </div>
                )}
                {sendRecipeNow === false && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs text-amber-700">
                      Sem problemas! Você poderá enviar a receita pós-compra via WhatsApp ou E-mail informando o número do pedido.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ETAPA 5: DNP & Finalização */}
          {step === 5 && (
            <div>
              <h3 className="text-sm font-bold text-luxury-black mb-4">DNP &amp; Finalização</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">Você sabe qual a sua DNP (Distância Naso-Pupilar)?</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setKnowDnp(true)}
                      className={`flex-1 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${
                        knowDnp === true ? 'border-gold bg-gold/10 text-gold' : 'border-ice-dark text-gray-600'
                      }`}
                    >
                      SIM
                    </button>
                    <button
                      onClick={() => setKnowDnp(false)}
                      className={`flex-1 h-10 rounded-xl border-2 text-sm font-semibold transition-all ${
                        knowDnp === false ? 'border-gold bg-gold/10 text-gold' : 'border-ice-dark text-gray-600'
                      }`}
                    >
                      NÃO
                    </button>
                  </div>
                </div>
                {knowDnp === true && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Olho Esquerdo (OE) mm</label>
                      <input
                        type="number"
                        value={dnp.oe}
                        onChange={(e) => setDnp({ ...dnp, oe: e.target.value })}
                        placeholder="30.0"
                        step="0.5"
                        className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">Olho Direito (OD) mm</label>
                      <input
                        type="number"
                        value={dnp.od}
                        onChange={(e) => setDnp({ ...dnp, od: e.target.value })}
                        placeholder="30.0"
                        step="0.5"
                        className="w-full h-11 px-4 rounded-xl border border-ice-dark text-sm focus:outline-none focus:border-gold"
                      />
                    </div>
                  </div>
                )}
                {knowDnp === false && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs text-blue-700 font-medium mb-2">Como tirar a foto com régua:</p>
                    <ol className="text-xs text-blue-600 space-y-1 list-decimal list-inside">
                      <li>Coloque uma régua horizontal no topo dos seus olhos</li>
                      <li>Posicione a câmera na altura dos olhos</li>
                      <li>Tire a foto em ambiente bem iluminado</li>
                      <li>Envie a foto para nosso time D&apos;Griffe Wonders</li>
                    </ol>
                    <p className="text-xs text-blue-600 mt-2">Ou aguarde o contato do nosso time para auxiliá-lo.</p>
                  </div>
                )}

                {/* Resumo */}
                <div className="bg-ice rounded-xl p-4 mt-4">
                  <h4 className="text-xs font-bold text-luxury-black mb-2">Resumo da Configuração</h4>
                  <div className="space-y-1 text-xs text-gray-600">
                    <p>Armação: {product.name} — {formatPrice(framePrice)}</p>
                    {lensType && <p>Tipo: {lensType.replace('_', ' ')} — {formatPrice(LENS_PRICES[lensType])}</p>}
                    {material && <p>Material: {material.replace('_', ' ')} — {formatPrice(MATERIAL_PRICES[material])}</p>}
                    {treatment && <p>Tratamento: {treatment.replace('_', ' ')} — {formatPrice(TREATMENT_PRICES[treatment])}</p>}
                    {cpf && <p>CPF: {cpf}</p>}
                    {knowDnp && dnp.oe && dnp.od && <p>DNP: OE {dnp.oe}mm / OD {dnp.od}mm</p>}
                  </div>
                  <div className="border-t border-ice-dark mt-3 pt-3 flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-600">Total</span>
                    <span className="text-lg font-bold text-luxury-black">{formatPrice(totalPrice)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white rounded-b-2xl border-t border-ice-dark px-6 py-4 flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 h-11 rounded-xl border border-ice-dark text-gray-600 text-sm font-semibold hover:bg-ice transition-colors"
            >
              Voltar
            </button>
          )}
          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1 h-11 rounded-xl bg-luxury-black text-white text-sm font-semibold hover:bg-luxury-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima Etapa
            </button>
          ) : (
            <button
              onClick={handleFinalize}
              disabled={!canProceed()}
              className="flex-1 h-11 rounded-xl btn-gold text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              FINALIZAR COMPRA — {formatPrice(totalPrice)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
