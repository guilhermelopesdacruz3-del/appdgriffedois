import { useEffect, useState } from "react";
import { meusCupons, type CupomUsuario } from "../services/cupomApp";

export default function MeusCupons() {
  const [cupons, setCupons] = useState<CupomUsuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await meusCupons();
      setCupons(data);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-luxury-black">Meus Cupons</h3>
      {erro && <p className="text-[11px] text-red-500">{erro}</p>}
      {loading && <p className="text-xs text-gray-400">Carregando...</p>}
      {!loading && cupons.length === 0 && (
        <p className="text-xs text-gray-400">Você ainda não tem cupons.</p>
      )}
      <div className="space-y-2">
        {cupons.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl p-3 shadow-sm flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-luxury-black">{c.codigo || c.cupom_id}</p>
              <p className="text-[10px] text-gray-500">
                {c.tipo === "percentual" ? `${c.valor}%` : `R$ ${Number(c.valor).toFixed(2)}`}
                {c.data_fim ? ` · válido até ${new Date(c.data_fim).toLocaleDateString("pt-BR")}` : ""}
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${c.usado ? "bg-gray-100 text-gray-500" : "bg-green-50 text-green-600"}`}>
              {c.usado ? "Usado" : "Ativo"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
