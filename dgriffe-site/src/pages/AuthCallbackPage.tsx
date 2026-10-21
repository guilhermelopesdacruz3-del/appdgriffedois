import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import { setClienteSession, type Session } from '../services/cliente';

/**
 * Retorno do link de confirmação de e-mail do Supabase.
 *
 * O Supabase pode devolver a sessão de duas formas:
 *  - #access_token=...&refresh_token=... (fragmento);
 *  - ?token_hash=...&type=signup (query) — trocamos por sessão no backend.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelado = false;

    const concluir = (session: Session, destino = '/checkout') => {
      if (cancelado) return;
      setClienteSession(session);
      setOk(true);
      setTimeout(() => navigate(destino, { replace: true }), 700);
    };

    try {
      const hash = window.location.hash;
      if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token') || '';
        if (access_token) {
          concluir({ access_token, refresh_token });
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
      }

      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get('token_hash');
      if (!tokenHash) {
        setErro('Link inválido ou expirado. Faça login novamente.');
        return;
      }

      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/cliente/confirmar-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token_hash: tokenHash,
              type: params.get('type') || 'magiclink',
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json?.session?.access_token) {
            throw new Error(json?.erro || 'Não foi possível confirmar o e-mail.');
          }
          concluir(json.session as Session);
        } catch (err) {
          if (!cancelado) setErro((err as Error).message || 'Não foi possível confirmar o e-mail.');
        }
      })();
    } catch {
      setErro('Link inválido ou expirado. Faça login novamente.');
    }

    return () => { cancelado = true; };
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md w-full text-center">
        {erro ? (
          <>
            <h1 className="text-lg font-semibold text-neutral-900">Não foi possível confirmar</h1>
            <p className="text-sm text-neutral-600 mt-2">{erro}</p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="mt-5 px-5 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium"
            >
              Ir para o login
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-neutral-900">
              {ok ? 'E-mail confirmado!' : 'Confirmando seu e-mail...'}
            </h1>
            <p className="text-sm text-neutral-600 mt-2">
              {ok ? 'Redirecionando para o checkout.' : 'Aguarde um instante.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
