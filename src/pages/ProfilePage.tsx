import { useState } from "react";
import type { ReactNode } from "react";
import { useCliente } from "../hooks/useCliente";
import { usePedidos } from "../hooks/usePedidos";
import { useFavorites } from "../hooks/useUserLists";
import { useProdutos } from "../hooks/useProdutos";
import { useFidelidade } from "../hooks/useFidelidade";
import { usePedidoDetalhe } from "../hooks/usePedidoDetalhe";
import OrderDetail from "../components/cliente/OrderDetail";
import { formatPrice } from "../utils";
import type { Product } from "../data";
import ProductCard from "../components/ProductCard";

type SubTela = "favoritos" | "dados" | "editar-perfil" | "seguranca" | "config" | "embreve";

export default function ProfilePage() {
  const { cliente, loading: loadingCliente, error: erroCliente, entrarComEmail, sair, atualizarCliente } = useCliente();
  const [email, setEmail] = useState("");
  const { pedidos, loading: loadingPedidos, error: erroPedidos } = usePedidos(cliente?.id ?? null);
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites();
  const { produtos: todosProdutos } = useProdutos({ limit: 100 });
  const { info: fidInfo } = useFidelidade(cliente?.email);
  const [subTela, setSubTela] = useState<SubTela | null>(null);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<string | number | null>(null);
  const { pedido, loading: loadingPedidoDetalhe } = usePedidoDetalhe(pedidoSelecionado);

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
      action: null,
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
      action: "embreve",
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

  // Ninguém logado ainda: pede o e-mail cadastrado na loja e busca o cliente
  // via API da Loja Integrada (src/hooks/useCliente.ts).
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
            Informe o e-mail que você usou para comprar na loja
          </p>

          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) entrarComEmail(email);
            }}
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
              disabled={loadingCliente}
              className="w-full h-12 bg-luxury-black text-white text-xs font-bold rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {loadingCliente ? "Buscando..." : "Continuar"}
            </button>
          </form>

          {erroCliente && (
            <p className="text-[11px] text-red-500 mt-3">{erroCliente}</p>
          )}

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

    if (subTela === "favoritos") {
      const favs = todosProdutos.filter((p: Product) => favoriteIds.includes(p.id));
      return (
        <div className="px-4 pt-6 pb-4">
          {voltar}
          <h3 className="text-base font-bold text-luxury-black mb-4">Favoritos</h3>
          {favs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center mt-10">Você ainda não favoritou nenhuma peça.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {favs.map((p: Product) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  isFavorite={isFavorite(p.id)}
                  onToggleFavorite={() => toggleFavorite(p.id)}
                  onSelect={() => {}}
                  onAddToCart={() => {}}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    if (subTela === "editar-perfil") {
      const nomeAtual = cliente?.nome || "";
      const telefoneAtual = cliente?.telefone || "";
      const [nome, setNome] = useState(nomeAtual);
      const [telefone, setTelefone] = useState(telefoneAtual);
      const [salvando, setSalvando] = useState(false);
      const [salvo, setSalvo] = useState(false);

      const salvar = async () => {
        setSalvando(true);
        setSalvo(false);
        try {
          await atualizarCliente({
            nome: nome.trim() ? nome.trim() : undefined,
            telefone: telefone.trim() ? telefone.trim() : undefined,
          });
          setSalvo(true);
          setTimeout(() => setSubTela("dados"), 800);
        } catch (e) {
          console.error(e);
        } finally {
          setSalvando(false);
        }
      };
      return (
        <div className="px-5 pt-6 pb-4">
          {voltar}
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

    if (subTela === "config") {
      return (
        <div className="px-5 pt-6 pb-4">
          {voltar}
          <h3 className="text-base font-bold text-luxury-black mb-4">Configurações</h3>
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs font-semibold text-luxury-black">Receber ofertas por e-mail</span>
              <input type="checkbox" defaultChecked className="w-5 h-5 accent-gold" />
            </label>
            <div className="flex items-center justify-between py-2 border-t border-gray-100">
              <span className="text-xs text-gray-400">Limpar favoritos</span>
              <button
                onClick={() => favoriteIds.forEach((id) => toggleFavorite(id))}
                className="text-[11px] font-bold text-red-500"
              >
                Limpar
              </button>
            </div>
          </div>
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
              {(cliente.nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() || "").join("") || "?")}
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
