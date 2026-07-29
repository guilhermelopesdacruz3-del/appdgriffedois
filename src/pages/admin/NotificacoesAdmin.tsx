import { useEffect, useState } from "react";
import { listarClientesAdmin, type ClienteRelatorio } from "../../services/admin";
import { notificarClientesAdmin, type FiltrosNotificar } from "../../services/notificacoes";

type Tipo = "cupom" | "promocao" | "produto" | "carrinho" | "geral";

export default function NotificacoesAdmin() {
  const [clientes, setClientes] = useState<ClienteRelatorio[]>([]);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [tipo, setTipo] = useState<Tipo>("cupom");
  const [fEmail, setFEmail] = useState("");
  const [fNome, setFNome] = useState("");
  const [fPontosMin, setFPontosMin] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    listarClientesAdmin()
      .then((r) => setClientes(r.clientes))
      .catch(() => setClientes([]));
  }, []);

  const previewFiltro = () => {
    return clientes.filter((c) => {
      if (fEmail && !c.email.toLowerCase().includes(fEmail.toLowerCase())) return false;
      if (fNome && !c.nome.toLowerCase().includes(fNome.toLowerCase())) return false;
      if (fPontosMin && Number(fPontosMin) > 0 && ((c as any).pontos ?? 0) < Number(fPontosMin)) return false;
      return true;
    });
  };
  const preview = previewFiltro();

  const enviar = async () => {
    if (!titulo.trim() || !corpo.trim()) {
      setStatus("Preencha título e mensagem.");
      return;
    }
    setEnviando(true);
    setStatus(null);
    const filtros: FiltrosNotificar = {};
    if (fEmail.trim()) filtros.email = fEmail.trim();
    if (fNome.trim()) filtros.nome = fNome.trim();
    if (fPontosMin && Number(fPontosMin) > 0) filtros.pontosMin = Number(fPontosMin);
    try {
      const r = await notificarClientesAdmin({ titulo, corpo, tipo, filtros });
      setStatus(`Enviado para ${r.enviadas} cliente(s).`);
      setTitulo("");
      setCorpo("");
    } catch (e: any) {
      setStatus(e.message || "Falha ao enviar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <h2 className="text-base font-bold text-luxury-black">Enviar notificação</h2>

      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <div>
          <label className="text-[11px] text-gray-500">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as Tipo)}
            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
          >
            <option value="cupom">Cupom</option>
            <option value="promocao">Promoção</option>
            <option value="produto">Produto exclusivo</option>
            <option value="carrinho">Aviso de carrinho</option>
            <option value="geral">Geral</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-gray-500">Título</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Cupom de 10% OFF"
            className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">Mensagem</label>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Ex: Use o cupom SAUDE10 e ganhe 10%..."
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-[11px] font-bold text-gray-500">Destinatários (filtros)</p>
        <input
          value={fEmail}
          onChange={(e) => setFEmail(e.target.value)}
          placeholder="Filtrar por e-mail (parte)"
          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
        />
        <input
          value={fNome}
          onChange={(e) => setFNome(e.target.value)}
          placeholder="Filtrar por nome"
          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
        />
        <input
          value={fPontosMin}
          onChange={(e) => setFPontosMin(e.target.value.replace(/\D/g, ""))}
          placeholder="Nível mínimo de fidelidade (pontos)"
          className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
        />
        <p className="text-[11px] text-gray-400">
          {preview.length} cliente(s) correspondem aos filtros.
        </p>
      </div>

      {status && <p className="text-[11px] text-center text-gold">{status}</p>}

      <button
        onClick={enviar}
        disabled={enviando}
        className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl disabled:opacity-60"
      >
        {enviando ? "Enviando..." : "Enviar notificação"}
      </button>
    </div>
  );
}
