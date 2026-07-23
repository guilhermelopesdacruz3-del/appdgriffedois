import { useState } from "react";

interface Props {
  cliente: { nome?: string | null; telefone?: string | null };
  onVoltar: () => void;
  onSalvar: (dados: { nome?: string; telefone?: string }) => Promise<void>;
}

export default function EditarPerfil({ cliente, onVoltar, onSalvar }: Props) {
  const [nome, setNome] = useState(cliente.nome || "");
  const [telefone, setTelefone] = useState(cliente.telefone || "");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const salvar = async () => {
    setSalvando(true);
    setSalvo(false);
    try {
      await onSalvar({
        nome: nome.trim() ? nome.trim() : undefined,
        telefone: telefone.trim() ? telefone.trim() : undefined,
      });
      setSalvo(true);
      setTimeout(() => onVoltar(), 800);
    } catch (e) {
      console.error(e);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="px-5 pt-6 pb-4">
      <button
        onClick={onVoltar}
        className="flex items-center gap-1 text-xs font-bold text-luxury-black mb-3"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>
      <h3 className="text-base font-bold text-luxury-black mb-4">Editar dados</h3>
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div>
          <label className="text-[11px] font-semibold text-luxury-black mb-1 block">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full h-11 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-luxury-black mb-1 block">Telefone</label>
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="w-full h-11 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
          />
        </div>
        <button
          onClick={salvar}
          disabled={salvando || (!nome.trim() && !telefone.trim())}
          className="w-full h-11 bg-black text-white text-xs font-bold rounded-xl disabled:opacity-50 active:scale-95 transition-all"
        >
          {salvando ? "Salvando..." : salvo ? "Salvo!" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
