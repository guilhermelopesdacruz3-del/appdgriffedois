import { useEffect, useState } from "react";
import { getApiConfigStatus, saveApiConfig, type ApiConfigStatus } from "../../services/apiConfig";

export function ApiConfigPanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<ApiConfigStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const d = await getApiConfigStatus();
      setStatus(d);
      const initial: Record<string, string> = {};
      d.forEach((k) => { initial[k.key] = ""; });
      setInputs(initial);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErro(null);
    setMsg(null);
    try {
      await saveApiConfig(inputs);
      setMsg("Chaves salvas com sucesso.");
      carregar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <form onSubmit={salvar} className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-gold/20 rounded-2xl p-4 space-y-3 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gold flex items-center gap-2"><span className="w-1 h-3.5 rounded-full bg-gold inline-block" />Configuração de APIs</p>
        <button type="button" onClick={onClose} className="text-white/60 hover:text-white text-[11px] font-bold transition-colors">Fechar</button>
      </div>
      <p className="text-[10px] text-white/50">
        Insira as chaves de produção. Valores secretos não são exibidos após salvos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {status.map((k) => (
          <div key={k.key} className="space-y-1">
            <label className="block text-[9px] mb-0.5 px-1 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <span className={k.set ? "text-emerald-400" : "text-red-400"}>●</span>
              <span className={k.set ? "text-gold/80" : "text-white/60"}>{k.key}</span>
              <span className="text-white/40 normal-case tracking-normal">{k.set ? "(definida)" : "(não definida)"}</span>
            </label>
            <input
              type="password"
              value={inputs[k.key] || ""}
              onChange={(e) => setInputs((prev) => ({ ...prev, [k.key]: e.target.value }))}
              placeholder={k.set ? "••••••••" : "Insira a chave"}
              className={`w-full h-10 px-3 rounded-xl border bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold/20 transition-all ${k.set ? "border-emerald-400/25 focus:border-emerald-400" : "border-white/15 focus:border-gold"}`}
              autoComplete="off"
            />
          </div>
        ))}
      </div>

      {erro && <p className="text-[11px] text-red-400">{erro}</p>}
      {msg && <p className="text-[11px] text-emerald-400">{msg}</p>}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 h-10 bg-gradient-to-r from-gold to-gold-dark text-black text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-gold/20 hover:brightness-110"
        >
          {saving ? "Salvando..." : "Salvar chaves"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-white/15 text-white text-xs font-bold rounded-xl hover:bg-white/10 active:scale-[0.98] transition-all"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
