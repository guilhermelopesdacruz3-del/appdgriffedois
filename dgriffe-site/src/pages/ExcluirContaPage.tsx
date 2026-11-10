import { useState } from 'react';
import { Link } from 'react-router-dom';
import { logoutCliente } from '../services/cliente';
import { API_BASE } from '../config';

/**
 * Exclusão de conta self-service (LGPD / Política de Dados do Google Play).
 * Fluxo por SENHA (sem e-mail): e-mail + senha da conta, o mesmo critério de
 * identidade do login. Um único POST no backend faz a verificação e a cascata.
 */
export default function ExcluirContaPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [etapa, setEtapa] = useState<'inicio' | 'concluido'>('inicio');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (confirmar.trim().toUpperCase() !== 'EXCLUIR') {
      setErro('Digite EXCLUIR para confirmar.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/cliente/excluir-confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), senha }),
      });
      const body = await res.json().catch(() => ({}));
      // Contrato 2026-10: falhas de infra chegam como 200 + { ok:false, erro }
      // (a LB do host substitui corpos de 5xx) — o flag manda, não o status.
      if (!res.ok || body?.ok === false) throw new Error(body?.erro || `Falha ao excluir conta (${res.status})`);
      logoutCliente();
      setEtapa('concluido');
    } catch (err: any) {
      setErro(err.message || 'Erro ao excluir conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-site py-10 max-w-md">
      <h1 className="text-2xl font-bold text-neutral-900">Excluir minha conta</h1>
      <p className="text-sm text-neutral-500 mt-2">
        Ação definitiva. Ao excluir, apagamos seu perfil, endereços, favoritos, históricos de
        fidelidade, notificações e o acesso à conta. Dados de pedidos passados podem ser mantidos
        anonimizados por razões fiscais (Lei 13.709/2018 — LGPD).
      </p>

      {etapa === 'concluido' ? (
        <div className="mt-8 bg-white rounded-2xl p-6 shadow-card text-center space-y-3">
          <p className="text-sm font-semibold text-neutral-900">Conta excluída com sucesso.</p>
          <p className="text-xs text-neutral-500">Todas as informações associadas à conta foram removidas.</p>
          <Link to="/" className="inline-block mt-2 text-sm font-semibold text-neutral-700 hover:text-neutral-900">
            ← Voltar ao início
          </Link>
        </div>
      ) : (
        <form onSubmit={enviar} className="mt-8 bg-white rounded-2xl p-6 shadow-card space-y-4">
          <div>
            <label className="text-sm text-neutral-600 block mb-1">E-mail da conta</label>
            <input
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              placeholder="seu@email.com"
              className="w-full h-11 px-4 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div>
            <label className="text-sm text-neutral-600 block mb-1">Senha da conta</label>
            <input
              type="password"
              value={senha}
              onChange={(ev) => setSenha(ev.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full h-11 px-4 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900"
            />
          </div>

          <div>
            <label className="text-sm text-neutral-600 block mb-1">
              Confirmação <span className="text-neutral-400">(digite EXCLUIR)</span>
            </label>
            <input
              type="text"
              value={confirmar}
              onChange={(ev) => setConfirmar(ev.target.value.toUpperCase().slice(0, 10))}
              required
              placeholder="EXCLUIR"
              className="w-full h-11 px-4 rounded-xl border border-neutral-300 text-sm tracking-widest text-center focus:outline-none focus:border-neutral-900"
            />
          </div>

          {erro && <p className="text-xs text-red-500">{erro}</p>}

          <button
            type="submit"
            disabled={loading || !email || !senha}
            className="w-full h-11 btn-primary disabled:opacity-50"
          >
            {loading ? 'Excluindo...' : 'Excluir minha conta definitivamente'}
          </button>

          <p className="text-[11px] text-neutral-400 text-center">
            Não lembra a senha? Entre no app, redefina-a e volte aqui — a confirmação usa as
            mesmas credenciais do login.
          </p>
        </form>
      )}
    </div>
  );
}
