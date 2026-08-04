import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useCliente } from "../hooks/useCliente";
import { type EnderecoCliente } from "../services/cliente";
import { usePedidos } from "../hooks/usePedidos";
import { usePedidoDetalhe } from "../hooks/usePedidoDetalhe";
import OrderDetail from "../components/cliente/OrderDetail";
import EditarPerfil from "../components/cliente/EditarPerfil";
import MeusCupons from "./MeusCupons";
import { formatPrice } from "../utils";

import { getReceitas, criarReceita, atualizarReceita, apagarReceita } from "../services/receitas";
import type { Receita } from "../types";
import { cadastrarCliente, verificarOtp } from "../services/cliente";
import { salvarClienteSessao } from "../utils/cookies";

import { getFavoritos, apagarFavorito } from "../services/favoritos";
import type { Favorito } from "../types";

function ReceitasSalvas({ email }: { email: string }) {
  const [itens, setItens] = useState<Receita[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<{
    tipo: Receita["tipo"];
    descricao: string;
    nome: string;
    medico: string;
    data_receita: string;
    esf_od_longe: string;
    cil_od_longe: string;
    eixo_od_longe: string;
    esf_oe_longe: string;
    cil_oe_longe: string;
    eixo_oe_longe: string;
    esf_od_perto: string;
    cil_od_perto: string;
    eixo_od_perto: string;
    esf_oe_perto: string;
    cil_oe_perto: string;
    eixo_oe_perto: string;
    dip: string;
  }>({
    tipo: "grau", descricao: "", nome: "", medico: "", data_receita: "",
    esf_od_longe: "", cil_od_longe: "", eixo_od_longe: "",
    esf_oe_longe: "", cil_oe_longe: "", eixo_oe_longe: "",
    esf_od_perto: "", cil_od_perto: "", eixo_od_perto: "",
    esf_oe_perto: "", cil_oe_perto: "", eixo_oe_perto: "",
    dip: "",
  });

  const carregar = async () => {
    setLoading(true); setErro(null);
    try { setItens(await getReceitas(email)); } catch (e) { setErro((e as Error).message); } finally { setLoading(false); }
  };

  useEffect(() => { if (!email) return; carregar(); }, [email]);

  const salvar = async () => {
    if (!form.descricao.trim()) return;
    try {
      const criada = await criarReceita(email, {
        tipo: form.tipo, descricao: form.descricao.trim(),
        nome: form.nome || null, medico: form.medico || null, data_receita: form.data_receita || null,
        esf_od_longe: form.esf_od_longe ? Number(form.esf_od_longe) : null,
        cil_od_longe: form.cil_od_longe ? Number(form.cil_od_longe) : null,
        eixo_od_longe: form.eixo_od_longe ? Number(form.eixo_od_longe) : null,
        esf_oe_longe: form.esf_oe_longe ? Number(form.esf_oe_longe) : null,
        cil_oe_longe: form.cil_oe_longe ? Number(form.cil_oe_longe) : null,
        eixo_oe_longe: form.eixo_oe_longe ? Number(form.eixo_oe_longe) : null,
        esf_od_perto: form.esf_od_perto ? Number(form.esf_od_perto) : null,
        cil_od_perto: form.cil_od_perto ? Number(form.cil_od_perto) : null,
        eixo_od_perto: form.eixo_od_perto ? Number(form.eixo_od_perto) : null,
        esf_oe_perto: form.esf_oe_perto ? Number(form.esf_oe_perto) : null,
        cil_oe_perto: form.cil_oe_perto ? Number(form.cil_oe_perto) : null,
        eixo_oe_perto: form.eixo_oe_perto ? Number(form.eixo_oe_perto) : null,
        dip: form.dip ? Number(form.dip) : null,
      });
      setItens((prev) => [criada, ...prev]);
      setForm({ tipo: "grau", descricao: "", nome: "", medico: "", data_receita: "", esf_od_longe: "", cil_od_longe: "", eixo_od_longe: "", esf_oe_longe: "", cil_oe_longe: "", eixo_oe_longe: "", esf_od_perto: "", cil_od_perto: "", eixo_od_perto: "", esf_oe_perto: "", cil_oe_perto: "", eixo_oe_perto: "", dip: "" });
    } catch (e) { setErro((e as Error).message); }
  };

  const iniciarEdicao = (r: Receita) => {
    setEditando(r.id);
    setForm({
      tipo: r.tipo, descricao: r.descricao || "", nome: r.nome || "", medico: r.medico || "", data_receita: r.data_receita || "",
      esf_od_longe: r.esf_od_longe != null ? String(r.esf_od_longe) : "", cil_od_longe: r.cil_od_longe != null ? String(r.cil_od_longe) : "", eixo_od_longe: r.eixo_od_longe != null ? String(r.eixo_od_longe) : "",
      esf_oe_longe: r.esf_oe_longe != null ? String(r.esf_oe_longe) : "", cil_oe_longe: r.cil_oe_longe != null ? String(r.cil_oe_longe) : "", eixo_oe_longe: r.eixo_oe_longe != null ? String(r.eixo_oe_longe) : "",
      esf_od_perto: r.esf_od_perto != null ? String(r.esf_od_perto) : "", cil_od_perto: r.cil_od_perto != null ? String(r.cil_od_perto) : "", eixo_od_perto: r.eixo_od_perto != null ? String(r.eixo_od_perto) : "",
      esf_oe_perto: r.esf_oe_perto != null ? String(r.esf_oe_perto) : "", cil_oe_perto: r.cil_oe_perto != null ? String(r.cil_oe_perto) : "", eixo_oe_perto: r.eixo_oe_perto != null ? String(r.eixo_oe_perto) : "",
      dip: r.dip != null ? String(r.dip) : "",
    });
  };

  const cancelarEdicao = () => { setEditando(null); setForm({ tipo: "grau", descricao: "", nome: "", medico: "", data_receita: "", esf_od_longe: "", cil_od_longe: "", eixo_od_longe: "", esf_oe_longe: "", cil_oe_longe: "", eixo_oe_longe: "", esf_od_perto: "", cil_od_perto: "", eixo_od_perto: "", esf_oe_perto: "", cil_oe_perto: "", eixo_oe_perto: "", dip: "" }); };

  const salvarEdicao = async () => {
    if (!editando || !form.descricao.trim()) return;
    try {
      await atualizarReceita(editando, email, {
        tipo: form.tipo, descricao: form.descricao.trim(),
        nome: form.nome || null, medico: form.medico || null, data_receita: form.data_receita || null,
        esf_od_longe: form.esf_od_longe ? Number(form.esf_od_longe) : null,
        cil_od_longe: form.cil_od_longe ? Number(form.cil_od_longe) : null,
        eixo_od_longe: form.eixo_od_longe ? Number(form.eixo_od_longe) : null,
        esf_oe_longe: form.esf_oe_longe ? Number(form.esf_oe_longe) : null,
        cil_oe_longe: form.cil_oe_longe ? Number(form.cil_oe_longe) : null,
        eixo_oe_longe: form.eixo_oe_longe ? Number(form.eixo_oe_longe) : null,
        esf_od_perto: form.esf_od_perto ? Number(form.esf_od_perto) : null,
        cil_od_perto: form.cil_od_perto ? Number(form.cil_od_perto) : null,
        eixo_od_perto: form.eixo_od_perto ? Number(form.eixo_od_perto) : null,
        esf_oe_perto: form.esf_oe_perto ? Number(form.esf_oe_perto) : null,
        cil_oe_perto: form.cil_oe_perto ? Number(form.cil_oe_perto) : null,
        eixo_oe_perto: form.eixo_oe_perto ? Number(form.eixo_oe_perto) : null,
        dip: form.dip ? Number(form.dip) : null,
      });
      setEditando(null);
      carregar();
    } catch (e) { setErro((e as Error).message); }
  };

  const apagar = async (id: string) => {
    try { await apagarReceita(id, email); setItens((prev) => prev.filter((x) => x.id !== id)); } catch (e) { setErro((e as Error).message); }
  };

  const numInput = (val: string, onChange: (v: string) => void) => (
    <input type="number" step="0.25" value={val} onChange={(e) => onChange(e.target.value)} placeholder="—" className="w-14 h-8 px-1 rounded-lg border border-gray-200 text-[10px] text-center focus:outline-none focus:border-gold" />
  );

  const Campo = (label: string, val: string, onChange: (v: string) => void) => (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9px] text-gray-400 text-center">{label}</label>
      <input value={val} onChange={(e) => onChange(e.target.value)} placeholder="—" className="h-8 px-1 rounded-lg border border-gray-200 text-[10px] text-center focus:outline-none focus:border-gold" />
    </div>
  );

  const TabelaReceita = (r: Receita) => {
    const n = (v: number | null | undefined) => v != null ? v.toFixed(2) : "—";
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-ice text-gray-500">
              <th className="p-1 border border-ice-dark" colSpan={4}>OD (Direito)</th>
              <th className="p-1 border border-ice-dark" colSpan={4}>OE (Esquerdo)</th>
            </tr>
            <tr className="bg-ice text-gray-400">
              <th className="p-1 border border-ice-dark">Esf.</th>
              <th className="p-1 border border-ice-dark">Cil.</th>
              <th className="p-1 border border-ice-dark">Eixo</th>
              <th className="p-1 border border-ice-dark">DIP</th>
              <th className="p-1 border border-ice-dark">Esf.</th>
              <th className="p-1 border border-ice-dark">Cil.</th>
              <th className="p-1 border border-ice-dark">Eixo</th>
              <th className="p-1 border border-ice-dark">DIP</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-1 border border-ice-dark text-center">{n(r.esf_od_longe)}</td>
              <td className="p-1 border border-ice-dark text-center">{n(r.cil_od_longe)}</td>
              <td className="p-1 border border-ice-dark text-center">{n(r.eixo_od_longe)}</td>
              <td className="p-1 border border-ice-dark text-center" rowSpan={2}>{n(r.dip)} mm</td>
              <td className="p-1 border border-ice-dark text-center">{n(r.esf_oe_longe)}</td>
              <td className="p-1 border border-ice-dark text-center">{n(r.cil_oe_longe)}</td>
              <td className="p-1 border border-ice-dark text-center">{n(r.eixo_oe_longe)}</td>
              <td className="p-1 border border-ice-dark" />
            </tr>
            <tr>
              <td className="p-1 border border-ice-dark text-center">{n(r.esf_od_perto)}</td>
              <td className="p-1 border border-ice-dark text-center">{n(r.cil_od_perto)}</td>
              <td className="p-1 border border-ice-dark text-center">{n(r.eixo_od_perto)}</td>
              <td className="p-1 border border-ice-dark text-center">{n(r.esf_oe_perto)}</td>
              <td className="p-1 border border-ice-dark text-center">{n(r.cil_oe_perto)}</td>
              <td className="p-1 border border-ice-dark text-center">{n(r.eixo_oe_perto)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {erro && <p className="text-[11px] text-red-500">{erro}</p>}

      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-xs font-bold text-luxury-black">Nova receita</p>
        <div className="grid grid-cols-2 gap-2">
          <select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as Receita["tipo"] }))} className="h-10 px-3 rounded-xl border border-gray-200 text-xs">
            <option value="grau">Grau</option>
            <option value="lente">Lente</option>
          </select>
          <input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Nome do paciente" className="h-10 px-3 rounded-xl border border-gray-200 text-xs" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={form.medico} onChange={(e) => setForm((p) => ({ ...p, medico: e.target.value }))} placeholder="Médico" className="h-10 px-3 rounded-xl border border-gray-200 text-xs" />
          <input type="date" value={form.data_receita} onChange={(e) => setForm((p) => ({ ...p, data_receita: e.target.value }))} className="h-10 px-3 rounded-xl border border-gray-200 text-xs" />
        </div>

        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Para Longe</p>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center"><p className="text-[9px] text-gray-400 mb-1">OD</p><div className="grid grid-cols-4 gap-1">{numInput(form.esf_od_longe, (v) => setForm((p) => ({ ...p, esf_od_longe: v })))}</div></div>
          <div className="text-center"><p className="text-[9px] text-gray-400 mb-1">OE</p><div className="grid grid-cols-4 gap-1">{numInput(form.esf_oe_longe, (v) => setForm((p) => ({ ...p, esf_oe_longe: v })))}</div></div>
        </div>

        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Para Perto</p>
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center"><p className="text-[9px] text-gray-400 mb-1">OD</p><div className="grid grid-cols-4 gap-1">{numInput(form.esf_od_perto, (v) => setForm((p) => ({ ...p, esf_od_perto: v })))}</div></div>
          <div className="text-center"><p className="text-[9px] text-gray-400 mb-1">OE</p><div className="grid grid-cols-4 gap-1">{numInput(form.esf_oe_perto, (v) => setForm((p) => ({ ...p, esf_oe_perto: v })))}</div></div>
        </div>

        <div className="flex gap-2 items-center">
          {Campo("DIP (mm)", form.dip, (v) => setForm((p) => ({ ...p, dip: v })))}
        </div>

        <textarea value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} placeholder="Observações" className="w-full h-20 px-3 py-2 rounded-xl border border-gray-200 text-xs resize-none focus:outline-none focus:border-gold" />
        <button onClick={salvar} disabled={!form.descricao.trim()} className="w-full h-10 bg-luxury-black text-white text-xs font-bold rounded-xl disabled:opacity-50">Salvar receita</button>
      </div>

      {loading && <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">Carregando receitas...</div>}
      {!loading && itens.length === 0 && <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">Nenhuma receita salva.</div>}

      <div className="space-y-2">
        {itens.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-gray-400">{r.tipo}</span>
                {r.nome && <span className="text-[10px] font-semibold text-luxury-black">{r.nome}</span>}
                {r.medico && <span className="text-[10px] text-gray-400">— {r.medico}</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => iniciarEdicao(r)} className="text-[10px] font-bold text-gold">Editar</button>
                <button onClick={() => apagar(r.id)} className="text-[10px] font-bold text-red-500">Apagar</button>
              </div>
            </div>
            {TabelaReceita(r)}
            {r.descricao && <p className="text-[10px] text-gray-400 whitespace-pre-wrap">{r.descricao}</p>}
            {r.data_receita && <p className="text-[10px] text-gray-400">{new Date(r.data_receita).toLocaleDateString("pt-BR")}</p>}
            <p className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </div>

      {editando && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center" onClick={cancelarEdicao}>
          <div className="bg-white rounded-2xl p-5 max-w-md w-full mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-luxury-black">Editar receita</p>
            <textarea value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} className="w-full h-20 px-3 py-2 rounded-xl border border-gray-200 text-xs resize-none focus:outline-none focus:border-gold" />
            <div className="flex gap-2">
              <button onClick={cancelarEdicao} className="flex-1 h-10 border border-gray-200 text-xs font-bold rounded-xl">Cancelar</button>
              <button onClick={salvarEdicao} className="flex-1 h-10 bg-luxury-black text-white text-xs font-bold rounded-xl">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FavoritosSalvos({ email }: { email: string }) {
  const [itens, setItens] = useState<Favorito[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const lista = await getFavoritos(email);
      setItens(lista);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!email) return;
    carregar();
  }, [email]);

  const remover = async (id: string) => {
    try {
      await apagarFavorito(id, email);
      setItens((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      {erro && <p className="text-[11px] text-red-500">{erro}</p>}

      {loading && (
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">
          Carregando favoritos...
        </div>
      )}

      {!loading && itens.length === 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">
          Você ainda não tem favoritos salvos.
        </div>
      )}

      <div className="space-y-2">
        {itens.map((f) => (
          <div key={f.id} className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-gray-400">
                Produto #{f.produto_id}
              </span>
              <button
                onClick={() => remover(f.id)}
                className="text-[10px] font-bold text-red-500"
              >
                Remover
              </button>
            </div>
            <p className="text-xs text-luxury-black">{f.nome}</p>
            {f.imagem && (
              <img src={f.imagem} alt={f.nome} className="w-full h-32 object-cover rounded-xl" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

type SubTela = "favoritos" | "cupons" | "dados" | "editar-perfil" | "seguranca" | "config" | "embreve" | "meus-pedidos" | "receitas" | "enderecos" | "preferencias";

// ---------------------------------------------------------------------------
// C3 — Livro de endereços
// ---------------------------------------------------------------------------
function EnderecosPage({ voltar }: { voltar: () => void }) {
  const { enderecos, carregarEnderecos, salvarEndereco, removerEndereco } = useCliente();
  const [form, setForm] = useState<Omit<EnderecoCliente, "id" | "email">>({
    nome: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "", principal: false,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { carregarEnderecos(); }, [carregarEnderecos]);
  useEffect(() => {
    const handler = () => carregarEnderecos();
    window.addEventListener("enderecos-atualizados", handler);
    return () => window.removeEventListener("enderecos-atualizados", handler);
  }, [carregarEnderecos]);

  const submit = async () => {
    setErro(null);
    if (!form.nome || !form.endereco || !form.numero || !form.cidade || !form.estado || !form.cep) {
      setErro("Preencha os campos obrigatórios.");
      return;
    }
    setSalvando(true);
    try {
      await salvarEndereco(form);
      setForm({ nome: "", endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", cep: "", principal: false });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="px-5 pt-6 pb-4">
      <button onClick={voltar} className="text-xs text-gray-400 mb-3">‹ Voltar</button>
      <h3 className="text-base font-bold text-luxury-black mb-4">Meus Endereços</h3>

      <div className="space-y-2">
        {enderecos.map((en) => (
          <div key={en.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-luxury-black">{en.nome}{en.principal && " · principal"}</p>
                <p className="text-[11px] text-gray-500">{en.endereco}, {en.numero}{en.complemento ? ` - ${en.complemento}` : ""}</p>
                <p className="text-[11px] text-gray-500">{en.bairro ? `${en.bairro}, ` : ""}{en.cidade}/{en.estado} - {en.cep}</p>
              </div>
              <button onClick={() => removerEndereco(en.id!)} className="text-[10px] font-bold text-red-500">Excluir</button>
            </div>
          </div>
        ))}
        {enderecos.length === 0 && <p className="text-xs text-gray-400 text-center">Nenhum endereço salvo.</p>}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm mt-4 space-y-2">
        <p className="text-xs font-bold text-luxury-black mb-1">Adicionar endereço</p>
        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Apelido (Casa, Trabalho) *" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs" />
        <div className="flex gap-2">
          <input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Logradouro *" className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs" />
          <input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="Número *" className="w-24 h-10 px-3 rounded-xl border border-gray-200 text-xs" />
        </div>
        <input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} placeholder="Complemento" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs" />
        <input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} placeholder="Bairro" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs" />
        <div className="flex gap-2">
          <input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Cidade *" className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-xs" />
          <input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} placeholder="UF *" className="w-20 h-10 px-3 rounded-xl border border-gray-200 text-xs" />
        </div>
        <input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} placeholder="CEP *" className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs" />
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.checked })} className="w-4 h-4 accent-gold" />
          Endereço principal
        </label>
        {erro && <p className="text-[11px] text-red-500">{erro}</p>}
        <button onClick={submit} disabled={salvando} className="w-full h-10 bg-luxury-black text-white text-xs font-bold rounded-xl disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar endereço"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// C7 — Preferências de notificação
// ---------------------------------------------------------------------------
function PreferenciasPage({ voltar }: { voltar: () => void }) {
  const { preferencias, salvarPreferencias } = useCliente();
  const [opts, setOpts] = useState<Record<string, boolean>>(preferencias);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => { setOpts(preferencias); }, [preferencias]);

  const items: { key: string; label: string }[] = [
    { key: "email_ofertas", label: "Receber ofertas por e-mail" },
    { key: "email_pedidos", label: "Avisos de pedido por e-mail" },
    { key: "push_promocoes", label: "Cupons e promoções" },
  ];

  return (
    <div className="px-5 pt-6 pb-4">
      <button onClick={voltar} className="text-xs text-gray-400 mb-3">‹ Voltar</button>
      <h3 className="text-base font-bold text-luxury-black mb-4">Configurações</h3>
      <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
        {items.map((it) => (
          <label key={it.key} className="flex items-center justify-between cursor-pointer">
            <span className="text-xs font-semibold text-luxury-black">{it.label}</span>
            <input type="checkbox" checked={Boolean(opts[it.key])} onChange={() => setOpts({ ...opts, [it.key]: !opts[it.key] })} className="w-5 h-5 accent-gold" />
          </label>
        ))}
        <button
          onClick={async () => { await salvarPreferencias(opts); setSalvo(true); setTimeout(() => setSalvo(false), 2000); }}
          className="w-full h-10 bg-luxury-black text-white text-xs font-bold rounded-xl mt-2"
        >
          {salvo ? "Salvo!" : "Salvar preferências"}
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage({ onNavigate, fidelidade: fidInfo }: { onNavigate?: (page: string) => void; fidelidade?: any }) {
  const { cliente, entrarComEmail, sair, atualizarCliente } = useCliente();
  const [email, setEmail] = useState("");
  const { carregarPerfil, carregarPreferencias } = useCliente();
  useEffect(() => {
    const h1 = () => carregarPerfil();
    window.addEventListener("cliente-atualizado", h1);
    return () => window.removeEventListener("cliente-atualizado", h1);
  }, [carregarPerfil]);
  useEffect(() => {
    const h2 = () => carregarPreferencias();
    window.addEventListener("preferencias-atualizadas", h2);
    return () => window.removeEventListener("preferencias-atualizadas", h2);
  }, [carregarPreferencias]);
  const { pedidos, loading: loadingPedidos, error: erroPedidos } = usePedidos(cliente?.id ?? null);
  const [subTela, setSubTela] = useState<SubTela | null>(null);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<string | number | null>(null);
  const { pedido, loading: loadingPedidoDetalhe } = usePedidoDetalhe(pedidoSelecionado);

  // Estado de exclusão de conta (LGPD / Política de Dados do Google Play).
  const [excluindo, setExcluindo] = useState(false);
  const [exOtp, setExOtp] = useState("");
  const [exMsg, setExMsg] = useState<string | null>(null);
  const [exErr, setExErr] = useState<string | null>(null);
  const [exEnviado, setExEnviado] = useState(false);

  const exSolicitar = async () => {
    setExErr(null); setExMsg(null); setExcluindo(true);
    try {
      const r = await fetch("/api/cliente/excluir-solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cliente?.email }),
      });
      const j = await r.json();
      if (!r.ok) { setExErr(j.erro || "Falha ao solicitar exclusão."); return; }
      setExEnviado(true);
      setExMsg(j.mensagem || "Código enviado para seu e-mail.");
    } catch {
      setExErr("Falha de conexão. Tente novamente.");
    } finally {
      setExcluindo(false);
    }
  };

  const exConfirmar = async () => {
    setExErr(null); setExMsg(null); setExcluindo(true);
    try {
      const r = await fetch("/api/cliente/excluir-confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cliente?.email, token: exOtp }),
      });
      const j = await r.json();
      if (!r.ok) { setExErr(j.erro || "Falha ao excluir conta."); return; }
      setExMsg(j.mensagem || "Conta excluída.");
      await sair();
      setSubTela(null);
    } catch {
      setExErr("Falha de conexão. Tente novamente.");
    } finally {
      setExcluindo(false);
    }
  };

  const menuItems: { icon: ReactNode; label: string; subtitle: string; action: SubTela | null }[] = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      label: "Meus Dados",
      subtitle: "Nome, e-mail e telefone",
      action: "editar-perfil",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
      label: "Meus Pedidos",
      subtitle: "Acompanhe suas entregas",
      action: "meus-pedidos",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
      label: "Meus Endereços",
      subtitle: "Livro de endereços",
      action: "enderecos",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
      label: "Receitas Salvas",
      subtitle: "Óculos de grau e lentes",
      action: "receitas",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
        </svg>
      ),
      label: "Favoritos",
      subtitle: "Peças que você amou",
      action: "favoritos",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      ),
      label: "Meus Cupons",
      subtitle: "Cupons e descontos",
      action: "cupons",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      ),
      label: "Segurança",
      subtitle: "Senha e autenticação",
      action: "seguranca",
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
      label: "Configurações",
      subtitle: "Notificações e preferências",
      action: "config",
    },
  ];

  // Ninguém logado ainda: pede o e-mail + código OTP (gera/renova a sessão
  // Supabase, necessária para cupons, pontos, perfil e endereços) e depois
  // busca o cliente via API da Loja Integrada (src/hooks/useCliente.ts).
  const [etapaLogin, setEtapaLogin] = useState<"email" | "codigo">("email");
  const [codigoLogin, setCodigoLogin] = useState("");
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [erroLogin, setErroLogin] = useState<string | null>(null);
  const [msgLogin, setMsgLogin] = useState<string | null>(null);

  const enviarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setErroLogin(null);
    setMsgLogin(null);
    setEnviandoCodigo(true);
    try {
      const r = await cadastrarCliente({ email: email.trim() });
      setMsgLogin(r.mensagem || "Enviamos um código para seu e-mail.");
      setEtapaLogin("codigo");
      setCodigoLogin("");
    } catch (err) {
      setErroLogin((err as Error).message);
    } finally {
      setEnviandoCodigo(false);
    }
  };

  const confirmarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codigoLogin.length !== 6) return;
    setErroLogin(null);
    setMsgLogin(null);
    setEnviandoCodigo(true);
    try {
      const r = await verificarOtp(email.trim(), codigoLogin);
      if (!r.ok) {
        setErroLogin("Não foi possível confirmar o código.");
        return;
      }
      // Sessão Supabase (access + refresh) salva → cupons/pontos/perfil funcionam.
      try {
        const sess = r.session as any;
        if (sess?.access_token) {
          salvarClienteSessao({ access_token: sess.access_token, refresh_token: sess.refresh_token });
        }
      } catch { /* ignora */ }
      // Busca o cliente na Loja Integrada e entra na conta.
      await entrarComEmail(email.trim());
      setEtapaLogin("email");
      setCodigoLogin("");
    } catch (err) {
      setErroLogin((err as Error).message);
    } finally {
      setEnviandoCodigo(false);
    }
  };

  if (!cliente) {
    return (
      <div className="px-5 pt-10 pb-4">
        <div className="bg-white rounded-3xl p-6 shadow-sm text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/20 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-luxury-black">Entrar na minha conta</h2>
          <p className="text-xs text-gray-500 mt-1">
            {etapaLogin === "email"
              ? "Informe o e-mail que você usou para comprar na loja"
              : `Enviamos um código de 6 dígitos para ${email}.`}
          </p>

          {etapaLogin === "email" ? (
            <form
              className="mt-5 space-y-3"
              onSubmit={enviarCodigo}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={enviandoCodigo || !email.trim()}
                className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {enviandoCodigo ? "Enviando..." : "Enviar código"}
              </button>
            </form>
          ) : (
            <form
              className="mt-5 space-y-3"
              onSubmit={confirmarLogin}
            >
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={codigoLogin}
                onChange={(e) => setCodigoLogin(e.target.value.replace(/\D/g, ""))}
                placeholder="Código de 6 dígitos"
                className="w-full h-12 px-4 rounded-2xl border border-gray-200 text-sm text-center tracking-[0.5em] focus:outline-none focus:border-gold"
              />
              <button
                type="submit"
                disabled={enviandoCodigo || codigoLogin.length !== 6}
                className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {enviandoCodigo ? "Confirmando..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => { setEtapaLogin("email"); setErroLogin(null); setMsgLogin(null); }}
                className="w-full text-[10px] text-gray-400 underline mt-1"
              >
                Usar outro e-mail
              </button>
            </form>
          )}

          {erroLogin && <p className="text-[11px] text-red-500 mt-3">{erroLogin}</p>}
          {msgLogin && !erroLogin && <p className="text-[11px] text-green-600 mt-3">{msgLogin}</p>}

          <button
            type="button"
            onClick={() => onNavigate?.("cadastro")}
            className="w-full mt-4 h-12 bg-gradient-to-br from-gold to-gold-dark text-luxury-black text-xs font-bold rounded-2xl active:scale-[0.98] transition-all"
          >
            Criar minha conta
          </button>

          <p className="text-[10px] text-gray-400 mt-4">
            Seus dados de cliente e pedidos vêm diretamente da sua loja na Loja Integrada.
          </p>
        </div>
      </div>
    );
  }

  if (subTela) {
    const voltar = (
      <button
        onClick={() => setSubTela(null)}
        className="flex items-center gap-1 text-xs font-bold text-luxury-black mb-3"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>
    );

    if (subTela === "meus-pedidos") {
      return (
        <div className="px-4 pt-6 pb-4">
          {voltar}
          <h3 className="text-base font-bold text-luxury-black mb-4">Meus Pedidos</h3>
          {loadingPedidos && (
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">
              Carregando pedidos...
            </div>
          )}
          {erroPedidos && !loadingPedidos && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center text-xs text-red-500">
              Não foi possível carregar seus pedidos agora.
            </div>
          )}
          {!loadingPedidos && !erroPedidos && pedidos.length === 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">
              Você ainda não tem pedidos nessa loja.
            </div>
          )}
          <div className="space-y-2">
            {pedidos.map((order) => (
              <button
                key={order.id}
                onClick={() => setPedidoSelecionado(order.id)}
                className="w-full text-left bg-white rounded-2xl p-4 shadow-sm active:scale-[0.99] transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-luxury-black">Pedido #{order.id}</span>
                  <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[9px] font-bold rounded-full">
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">
                    {order.date} • {order.items} {order.items === 1 ? "item" : "itens"}
                  </span>
                  <span className="text-xs font-bold text-luxury-black">
                    {order.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (subTela === "favoritos") {
      return (
        <div className="px-4 pt-6 pb-4">
          {voltar}
          <h3 className="text-base font-bold text-luxury-black mb-4">Favoritos</h3>
          {cliente?.email ? <FavoritosSalvos email={cliente.email} /> : <p className="text-xs text-gray-400 text-center mt-10">Faça login para ver seus favoritos.</p>}
        </div>
      );
    }

    if (subTela === "cupons") {
      return (
        <div className="px-4 pt-6 pb-4">
          {voltar}
          <MeusCupons onLogin={() => onNavigate?.("cadastro")} />
        </div>
      );
    }

    if (subTela === "editar-perfil") {
      return (
        <EditarPerfil
          cliente={cliente}
          onVoltar={() => setSubTela("dados")}
          onSalvar={atualizarCliente}
        />
      );
    }

    if (subTela === "dados") {
      const linha = (k: string, v?: string | null) => (
        <div className="flex justify-between py-3 border-b border-gray-100">
          <span className="text-xs text-gray-400">{k}</span>
          <span className="text-xs font-semibold text-luxury-black text-right max-w-[60%] truncate">{v || "—"}</span>
        </div>
      );
      return (
        <div className="px-5 pt-6 pb-4">
          {voltar}
          <h3 className="text-base font-bold text-luxury-black mb-4">Meus Dados</h3>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            {linha("Nome", cliente?.nome)}
            {linha("E-mail", cliente?.email)}
            {linha("Telefone", cliente?.telefone)}
            {linha("CPF", cliente?.cpf)}
            {linha("Pontos de fidelidade", fidInfo ? `${fidInfo.pontos} pts` : "0 pts")}
            {fidInfo && fidInfo.desconto_max > 0 && (
              <div className="py-2 text-[11px] text-green-600">
                Você tem {formatPrice(fidInfo.desconto_max)} de desconto disponível para usar no checkout.
              </div>
            )}
            {linha("Cidade", cliente?.cidade ? `${cliente.cidade}${cliente.estado ? "/" + cliente.estado : ""}` : null)}
            {cliente?.rua && linha("Endereço", `${cliente.rua}${cliente.numero ? ", " + cliente.numero : ""}`)}
            {cliente?.bairro && linha("Bairro", cliente.bairro)}
            {cliente?.cep && linha("CEP", cliente.cep)}
          </div>
        </div>
      );
    }

    if (subTela === "seguranca") {
      return (
        <div className="px-5 pt-6 pb-4">
          {voltar}
          <h3 className="text-base font-bold text-luxury-black mb-4">Segurança</h3>
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-xs text-gray-400">Conta vinculada</span>
              <span className="text-xs font-semibold text-luxury-black text-right max-w-[60%] truncate">{cliente?.email}</span>
            </div>
            <p className="text-[11px] text-gray-400">
              Sua conta é gerenciada pela Loja Integrada. A senha e autenticação
              são definidas no site da loja.
            </p>
            <button
              onClick={sair}
              className="w-full h-11 bg-red-50 text-red-500 text-xs font-bold rounded-xl active:scale-95 transition-all"
            >
              Sair da conta
            </button>
          </div>
        </div>
      );
    }

    if (subTela === "enderecos") {
      return (
        <EnderecosPage
          voltar={() => setSubTela(null)}
        />
      );
    }

    if (subTela === "config") {
      return (
        <PreferenciasPage voltar={() => setSubTela(null)} />
      );
    }

    if (subTela === "receitas") {
      return (
        <div className="px-5 pt-6 pb-4">
          {voltar}
          <h3 className="text-base font-bold text-luxury-black mb-4">Receitas Salvas</h3>
          <ReceitasSalvas email={cliente?.email || email} />
        </div>
      );
    }

    return (
      <div className="px-5 pt-10 pb-4">
        {voltar}
        <div className="bg-white rounded-3xl p-6 shadow-sm text-center">
          <p className="text-sm font-bold text-luxury-black">Em breve</p>
          <p className="text-xs text-gray-400 mt-2">Esta funcionalidade estará disponível nas próximas atualizações.</p>
        </div>
      </div>
    );
  }

  const pontosFidelidade = 0; // Integre com seu programa de fidelidade, se houver.

  return (
    <div className="pb-4">
      {/* Profile Header */}
      <div className="mx-4 mt-2 bg-white rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center shadow-lg shadow-gold/20">
            <span className="text-xl font-bold text-luxury-black">
              {(cliente.nome?.trim() || "").split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join("") || "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-luxury-black truncate">{cliente.nome}</h2>
            <p className="text-xs text-gray-500 truncate">{cliente.email}</p>
            <div className="flex items-center gap-2 mt-1">
              {cliente.cidade && (
                <span className="text-[10px] text-gray-400">
                  {cliente.cidade}
                  {cliente.estado ? ` - ${cliente.estado}` : ""}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={sair}
            className="text-[10px] font-bold text-gray-400 hover:text-luxury-black flex-shrink-0"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="flex gap-3 px-4 mt-4">
        <div className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="text-xl font-bold text-luxury-black">{pedidos.length}</p>
          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Pedidos</p>
        </div>
        <div className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="text-xl font-bold text-gold">{pontosFidelidade}</p>
          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Pontos</p>
        </div>
        <div className="flex-1 bg-white rounded-2xl p-3 text-center shadow-sm">
          <p className="text-xl font-bold text-luxury-black">{cliente.cpf ? "✓" : "—"}</p>
          <p className="text-[9px] text-gray-400 uppercase tracking-wider">CPF</p>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="px-5 mt-6 mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-luxury-black">Pedidos Recentes</h3>
      </div>

      <div className="px-4 space-y-2">
        {loadingPedidos && (
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">
            Carregando pedidos...
          </div>
        )}

        {erroPedidos && !loadingPedidos && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center text-xs text-red-500">
            Não foi possível carregar seus pedidos agora.
          </div>
        )}

        {!loadingPedidos && !erroPedidos && pedidos.length === 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">
            Você ainda não tem pedidos nessa loja.
          </div>
        )}

        {pedidos.map((order) => (
          <button
            key={order.id}
            onClick={() => setPedidoSelecionado(order.id)}
            className="w-full text-left bg-white rounded-2xl p-4 shadow-sm active:scale-[0.99] transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-luxury-black">{order.id}</span>
              <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[9px] font-bold rounded-full">
                {order.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400">{order.date} • {order.items} {order.items === 1 ? 'item' : 'itens'}</span>
              <span className="text-xs font-bold text-luxury-black">
                {order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <div className="px-5 mt-6 mb-3">
        <h3 className="text-sm font-bold text-luxury-black">Minha Conta</h3>
      </div>

      <div className="px-4 space-y-1.5">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={() => item.action && setSubTela(item.action)}
            disabled={!item.action}
            className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.99] text-left disabled:opacity-60"
          >
            <div className="w-9 h-9 rounded-xl bg-ice flex items-center justify-center text-gray-600 flex-shrink-0">
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-luxury-black">{item.label}</p>
              <p className="text-[10px] text-gray-400">{item.subtitle}</p>
            </div>
            {item.action ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C0C0C0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            ) : (
              <span className="text-[9px] text-gray-300">abaixo</span>
            )}
          </button>
        ))}

      </div>

        {/* Excluir minha conta (LGPD / Política de Dados do Google Play) */}
        <div className="px-4 mt-4 mb-8">
        <button
        onClick={() => { setExErr(null); setExMsg(null); setExEnviado(false); setExOtp(""); setExcluindo(true); }}
        className="w-full h-11 bg-red-50 text-red-500 text-xs font-bold rounded-xl active:scale-95 transition-all"
        >
        Excluir minha conta
        </button>
        <p className="text-[10px] text-gray-400 text-center mt-2 px-2">
        Remove seus dados de forma definitiva. Enviaremos um código de confirmação por e-mail.
        </p>
        </div>

        {/* Modal de exclusão de conta */}
        {excluindo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-6" onClick={() => setExcluindo(false)}>
        <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-base font-bold text-luxury-black mb-1">Excluir conta</h3>
          <p className="text-[11px] text-gray-500 mb-4">
            Esta ação é irreversível e remove todos os seus dados (pedidos, favoritos, pontos e acesso).
          </p>

          {!exEnviado ? (
            <button
              onClick={exSolicitar}
              className="w-full h-11 bg-red-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-all mb-2"
            >
              Enviar código de confirmação
            </button>
          ) : (
            <>
              <input
                value={exOtp}
                onChange={(e) => setExOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="Código de 6 dígitos"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-center tracking-widest mb-2"
              />
              <button
                onClick={exConfirmar}
                disabled={exOtp.length !== 6}
                className="w-full h-11 bg-red-500 text-white text-xs font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50 mb-2"
              >
                Confirmar exclusão
              </button>
              <button
                onClick={() => setExEnviado(false)}
                className="w-full h-10 text-gray-400 text-[11px] font-bold rounded-xl"
              >
                Reenviar código
              </button>
            </>
          )}

          {exMsg && <p className="text-[11px] text-green-600 text-center mt-2">{exMsg}</p>}
          {exErr && <p className="text-[11px] text-red-500 text-center mt-2">{exErr}</p>}

          <button
            onClick={() => setExcluindo(false)}
            className="w-full h-10 mt-2 text-gray-400 text-[11px] font-bold rounded-xl"
          >
            Cancelar
          </button>
        </div>
        </div>
        )}

        {/* Detalhe do pedido (Utilidade 1) */}
        {pedidoSelecionado && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center">
          <div className="w-full max-w-lg bg-ice rounded-t-3xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {loadingPedidoDetalhe && (
              <div className="p-6 text-center text-xs text-gray-400">Carregando pedido...</div>
            )}
            {!loadingPedidoDetalhe && !pedido && (
              <div className="p-6 text-center text-xs text-red-500">Não foi possível carregar este pedido.</div>
            )}
            {pedido && (
              <OrderDetail pedido={pedido} onClose={() => setPedidoSelecionado(null)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
