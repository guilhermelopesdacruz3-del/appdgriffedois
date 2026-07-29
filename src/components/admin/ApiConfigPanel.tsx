import { useEffect, useState } from "react";
import { getApiConfigStatus, saveApiConfig, type ApiConfigStatus } from "../../services/apiConfig";

export default function ApiConfigPanel({ onClose }: { onClose: () => void }) {
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
    <form onSubmit={salvar} className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gold-dark">Configuração de APIs</p>
        <button type="button" onClick={onClose} className="text-white/60 hover:text-white text-[11px] font-bold">Fechar</button>
      </div>
      <p className="text-[10px] text-white/50">
        Insira as chaves de produção. Valores secretos não são exibidos após salvos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {status.map((k) => (
          <div key={k.key} className="space-y-1">
            <label className="block text-[9px] text-white/50 mb-0.5 px-1">
              {k.key} {k.set ? "(definida)" : "(não definida)"}
            </label>
            <input
              type="password"
              value={inputs[k.key] || ""}
              onChange={(e) => setInputs((prev) => ({ ...prev, [k.key]: e.target.value }))}
              placeholder={k.set ? "••••••••" : "Insira a chave"}
              className="w-full h-10 px-3 rounded-xl border border-white/10 bg-black/40 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-gold"
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
          className="flex-1 h-10 bg-white text-black text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
        >
          {saving ? "Salvando..." : "Salvar chaves"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-white/10 text-white text-xs font-bold rounded-xl hover:bg-white/5 active:scale-[0.98] transition-all"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}