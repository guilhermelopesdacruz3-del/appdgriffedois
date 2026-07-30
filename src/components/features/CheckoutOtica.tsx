import { useState, useEffect, useCallback } from "react";
import { useCliente } from "../../hooks/useCliente";
import type { Product } from "../../data";
import { formatPrice } from "../../utils";

interface Props {
  produto: Product;
  isOpen: boolean;
  onClose: () => void;
}

export default function CheckoutOtica({ produto, isOpen, onClose }: Props) {
  const { cliente } = useCliente();
  const [passo, setPasso] = useState<"uso" | "receita" | "lentes" | "resumo" | "processando" | "sucesso" | "erro">("uso");
  const [tipoUso, setTipoUso] = useState<"sol" | "grau_longe" | "grau_perto" | "multifocal" | "bifocal" | "ocupacional">("sol");
  const [temGrauLonge, setTemGrauLonge] = useState(false);
  const [temGrauPerto, setTemGrauPerto] = useState(false);
  const [temAdicao, setTemAdicao] = useState(false);
  const [lente, setLente] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pontosC, setPontosC] = useState(0);
  const [pix, setPix] = useState<{ qr: string; copia: string } | null>(null);

  const precisaReceita = temGrauLonge || temGrauPerto || temAdicao;

  const lentesDisponiveis = (): string[] => {
    if (tipoUso === "sol") return ["Solar simples"];
    if (!temGrauPerto) return ["Visão simples longe"];
    if (!temGrauLonge) return ["Visão simples perto"];
    return ["Visão simples longe/perto", "Multifocal", "Ocupacional", "Bifocal"];
  };

  const valorLente = (): number => {
    const base = produto.price;
    if (tipoUso === "sol") return 0;
    if (lente.includes("Multifocal")) return base * 0.8;
    if (lente.includes("Ocupacional")) return base * 0.5;
    if (lente.includes("Bifocal")) return base * 0.6;
    if (lente.includes("simples")) return base * 0.3;
    return base * 0.4;
  };

  const subtotal = produto.price + valorLente();
  const totalFinal = subtotal;

  useEffect(() => {
    if (!isOpen) return;
    setPasso("uso");
    setTipoUso("sol");
    setTemGrauLonge(false);
    setTemGrauPerto(false);
    setTemAdicao(false);
    setLente("");
    setErro(null);
    setPix(null);
  }, [isOpen]);

  const confirmarPedido = useCallback(async () => {
    setErro(null);
    const email = cliente?.email || "";
    if (!email) return setErro("Faça login para finalizar o pedido.");

    setPasso("processando");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, meio: "pix" }),
      });

      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(data?.erro || `Falha (${res.status})`);

      setPix({ qr: data.pix_qr_base64 || "", copia: data.pix_copia_cola || "" });
      setPontosC(Number(data.pontos_creditados || 0));
      setPasso("sucesso");
      window.dispatchEvent(new Event("fidelidade-atualizada"));
    } catch (e: any) {
      setErro(e?.message || "Falha ao finalizar.");
      setPasso("erro");
    }
  }, [cliente?.email]);

  const proximo = () => {
    switch (passo) {
      case "uso":
        setPasso("receita");
        break;
      case "receita":
        setPasso("lentes");
        break;
      case "lentes":
        setPasso("resumo");
        break;
      default:
        break;
    }
  };

  const voltar = () => {
    switch (passo) {
      case "receita":
        setPasso("uso");
        break;
      case "lentes":
        setPasso("receita");
        break;
      case "resumo":
        setPasso("lentes");
        break;
      default:
        onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/70" onClick={onClose}>
      <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto bg-white rounded-t-[2rem] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pb-10">
          <div className="flex items-center justify-between mb-6 pt-4">
            <h3 className="text-base font-bold text-luxury-black">Montar pedido</h3>
            <button onClick={onClose} className="w-8 h-8 bg-ice rounded-full flex items-center justify-center text-gray-400">×</button>
          </div>

          {passo === "uso" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-1">Como você vai usar?</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k: "sol", t: "Óculos de sol" },
                  { k: "grau_longe", t: "Grau / longe" },
                  { k: "grau_perto", t: "Grau / perto" },
                  { k: "multifocal", t: "Multifocal" },
                ].map((op) => (
                  <button key={op.k} onClick={() => setTipoUso(op.k as typeof tipoUso)} className={`h-14 rounded-2xl border text-xs font-semibold transition-all ${tipoUso === op.k ? "border-gold bg-gold/10 text-gold" : "border-ice-dark text-gray-600"}`}>
                    {op.t}
                  </button>
                ))}
              </div>
              <button onClick={proximo} className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl">Continuar</button>
            </div>
          )}

          {passo === "receita" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-luxury-black mb-1">Você tem receita?</p>
              <div className="flex gap-2">
                <button onClick={() => { setTemGrauLonge(true); setTemGrauPerto(false); setTemAdicao(false); proximo(); }} className="flex-1 h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl">Sim, tenho receita</button>
                <button onClick={() => { setTemGrauLonge(false); setTemGrauPerto(false); setTemAdicao(false); proximo(); }} className="flex-1 h-12 border border-ice-dark text-xs font-bold rounded-2xl">Ainda não tenho</button>
              </div>
            </div>
          )}

          {passo === "lentes" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-luxury-black mb-1">Escolha a lente</p>
              <div className="grid grid-cols-1 gap-2">
                {lentesDisponiveis().map((op) => (
                  <button key={op} onClick={() => { setLente(op); proximo(); }} className={`h-12 rounded-2xl border text-left px-4 text-[11px] font-semibold transition-all ${lente === op ? "border-gold bg-gold/10 text-gold" : "border-ice-dark text-gray-700"}`}>
                    {op}
                  </button>
                ))}
              </div>
            </div>
          )}

          {passo === "resumo" && (
            <div className="space-y-3">
              <div className="bg-ice rounded-2xl p-3">
                <p className="text-[10px] text-gray-500">Produto</p>
                <p className="text-xs font-bold text-luxury-black">{produto.name}</p>
              </div>
              <div className="bg-ice rounded-2xl p-3">
                <p className="text-[10px] text-gray-500">Lente</p>
                <p className="text-xs font-bold text-luxury-black">{precisaReceita ? lente : "Sem grau — solar simples"}</p>
              </div>
              <div className="bg-ice rounded-2xl p-3">
                <p className="text-[10px] text-gray-500">Total</p>
                <p className="text-sm font-bold text-luxury-black">{formatPrice(totalFinal)}</p>
              </div>
              <button onClick={confirmarPedido} className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl">Confirmar pedido</button>
            </div>
          )}

          {passo === "processando" && (
            <div className="flex flex-col items-center py-10">
              <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-400 mt-3">Processando...</p>
            </div>
          )}

          {passo === "sucesso" && (
            <div className="flex flex-col items-center py-8 space-y-3">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <p className="text-sm font-bold text-luxury-black">Pedido criado!</p>
              {pix?.qr && <img src={`data:image/png;base64,${pix.qr}`} alt="PIX" className="w-44 h-44 mx-auto rounded-2xl" />}
              {pix?.copia && (
                <div className="bg-ice rounded-2xl p-3 w-full">
                  <p className="text-[10px] text-gray-500 mb-1">Copia e cola</p>
                  <p className="text-[11px] text-luxury-black break-all">{pix.copia}</p>
                  <button onClick={() => navigator.clipboard?.writeText(pix.copia)} className="mt-2 w-full h-10 bg-luxury-black text-white text-[11px] font-bold rounded-xl">Copiar PIX</button>
                </div>
              )}
              {pontosC > 0 && (
                <div className="bg-ice rounded-2xl p-3 w-full text-center">
                  <p className="text-[11px] text-gray-500">Pontos creditados</p>
                  <p className="text-lg font-bold text-gold">+{pontosC} pts</p>
                </div>
              )}
              <button onClick={onClose} className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl">Concluir</button>
            </div>
          )}

          {passo === "erro" && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs text-red-500">{erro}</div>
              <button onClick={() => setPasso("resumo")} className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl">Tentar novamente</button>
            </div>
          )}

          <div className="mt-4">
            <button onClick={voltar} className="text-[11px] font-bold text-gray-400">Voltar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
