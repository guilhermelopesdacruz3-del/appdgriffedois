import { useState } from 'react';
import { Link } from 'react-router-dom';
import { logoutCliente } from '../services/cliente';
import { API_BASE } from '../config';

/**
 * Exclusão de conta self-service (LGPD / Política de Dados do Google Play).
 * Mesma lógica do app: código de confirmação por e-mail antes de apagar.
 */
export default function ExcluirContaPage() {
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [etapa, setEtapa] = useState<'inicio' | 'codigo' | 'concluido'>('inicio');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const solicitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    setAviso(null);
    try {
      const res = await fetch(`${API_BASE}/api/cliente/excluir-solicitar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      // Contrato 2026-10: falhas chegam como 200 + { ok:false, erro } (a LB do
      // host substitui corpos de 5xx) — o flag manda, não o status HTTP.
      if (!res.ok || body?.ok === false) throw new Error(body?.erro || `Falha ao enviar código (${res.status})`);
      setEtapa('codigo');
      setAviso('Enviamos um código de confirmação para o seu e-mail.');
    } catch (err: any) {
      setErro(err.message || 'Erro ao solicitar exclusão.');
    } finally {
      setLoading(false);
    }
  };

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`${API_BASE}/api/cliente/excluir-confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), token: codigo.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.ok === false) throw new Error(body?.erro || `Falha ao confirmar exclusão (${res.status})`);
      logoutCliente();
      setEtapa('concluido');
    } catch (err: any) {
      setErro(err.message || 'Erro ao confirmar exclusão.');
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

      {etapa === 'concluido' && (
        <div className="mt-8 bg-white rounded-2xl p-6 shadow-card text-center space-y-3">
          <p className="text-sm font-semibold text-neutral-900">Conta excluída com sucesso.</p>
          <p className="text-xs text-neutral-500">Todas as informações associadas à conta foram removidas.</p>
          <Link to="/" className="inline-block mt-2 text-sm font-semibold text-neutral-700 hover:text-neutral-900">
            ← Voltar ao início
          </Link>
        </div>
      )}

      {etapa !== 'concluido' && (
        <form
          onSubmit={etapa === 'inicio' ? solicitar : confirmar}
          className="mt-8 bg-white rounded-2xl p-6 shadow-card space-y-4"
        >
          <div>
            <label className="text-sm text-neutral-600 block mb-1">E-mail da conta</label>
            <input
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              disabled={etapa === 'codigo'}
              placeholder="seu@email.com"
              className="w-full h-11 px-4 rounded-xl border border-neutral-300 text-sm focus:outline-none focus:border-neutral-900 disabled:bg-neutral-100"
            />
          </div>

          {etapa === 'codigo' && (
            <div>
              <label className="text-sm text-neutral-600 block mb-1">Código de confirmação (6 dígitos)</label>
              <input
                type="text"
                inputMode="numeric"
                value={codigo}
                onChange={(ev) => setCodigo(ev.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="000000"
                className="w-full h-11 px-4 rounded-xl border border-neutral-300 text-sm tracking-widest focus:outline-none focus:border-neutral-900"
              />
            </div>
          )}

          {aviso && <p className="text-xs text-neutral-500">{aviso}</p>}
          {erro && <p className="text-xs text-red-500">{erro}</p>}

          <button
            type="submit"
            disabled={loading || !email || (etapa === 'codigo' && codigo.length !== 6)}
            className="w-full h-11 btn-primary disabled:opacity-50"
          >
            {etapa === 'inicio'
              ? loading
                ? 'Enviando código...'
                : 'Solicitar código de exclusão'
              : loading
                ? 'Excluindo...'
                : 'Excluir minha conta definitivamente'}
          </button>

          {etapa === 'codigo' && (
            <button
              type="button"
              onClick={() => { setEtapa('inicio'); setCodigo(''); setAviso(null); }}
              className="w-full text-xs text-neutral-500 hover:text-neutral-700 underline"
            >
              Me arrependi — voltar
            </button>
          )}
        </form>
      )}
    </div>
  );
}
