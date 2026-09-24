import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-luxury-black text-white">
      <div className="container-site py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <img
                src="/logo-dgriffe.png"
                alt="Ótica D'Griffe Wonders"
                className="w-11 h-11 rounded-full object-cover shadow-lg shadow-gold/20"
              />
              <div>
                <p className="text-[11px] text-gold font-semibold uppercase tracking-widest">Ótica</p>
                <p className="text-lg font-bold -mt-0.5">D&apos;Griffe Wonders</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Óculos originals Ray-Ban, Michael Kors, Vogue e mais. Até 5x sem juros ou desconto no Pix.
            </p>
            <div className="flex gap-3 mt-5">
              <a href="https://instagram.com/oticadgriffe" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/></svg>
              </a>
              <a href="https://wa.me/5551992809229" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-gold/20 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            </div>
          </div>

          {/* Navegação */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gold mb-5">Navegação</h4>
            <ul className="space-y-3">
              <li><Link to="/" className="text-sm text-gray-400 hover:text-white transition-colors">Início</Link></li>
              <li><Link to="/catalogo" className="text-sm text-gray-400 hover:text-white transition-colors">Coleção</Link></li>
              <li><Link to="/medicao" className="text-sm text-gray-400 hover:text-white transition-colors">Medição de Lentes</Link></li>
              <li><Link to="/historia" className="text-sm text-gray-400 hover:text-white transition-colors">Nossa História</Link></li>
              <li><Link to="/afiliado" className="text-sm text-gray-400 hover:text-white transition-colors">Programa Afiliado</Link></li>
              <li><Link to="/login" className="text-sm text-gray-400 hover:text-white transition-colors">Entrar / Cadastrar</Link></li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gold mb-5">Contato</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm text-gray-400">
                <MapPin size={16} className="text-gold flex-shrink-0 mt-0.5" />
                Av. Paraguassu, 1629
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-400">
                <Phone size={16} className="text-gold flex-shrink-0" />
                (51) 99280-9229
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-400">
                <Mail size={16} className="text-gold flex-shrink-0" />
                contato@dgriffe.com.br
              </li>
            </ul>
            <div className="mt-6">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">Horário</p>
              <p className="text-sm text-gray-400">Seg–Sex 9h–18h</p>
              <p className="text-sm text-gray-400">Sáb 9h–13h</p>
            </div>
          </div>

          {/* Institucional */}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-gold mb-5">Institucional</h4>
            <ul className="space-y-3">
              <li><Link to="/historia" className="text-sm text-gray-400 hover:text-white transition-colors">Sobre Nós</Link></li>
              <li><Link to="/afiliado" className="text-sm text-gray-400 hover:text-white transition-colors">Trabalhe Conosco</Link></li>
              <li><Link to="/afiliado" className="text-sm text-gray-400 hover:text-white transition-colors">Política de Privacidade</Link></li>
              <li><Link to="/afiliado" className="text-sm text-gray-400 hover:text-white transition-colors">Termos de Uso</Link></li>
              <li><Link to="/afiliado" className="text-sm text-gray-400 hover:text-white transition-colors">Trocas e Devoluções</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            © 2026 Ótica D&apos;Griffe Wonders. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-[10px] text-gray-600 uppercase tracking-wider">Pagamento seguro</span>
            <div className="flex gap-2">
              <div className="px-2 py-1 bg-white/10 rounded text-[10px] font-bold text-gray-300">PIX</div>
              <div className="px-2 py-1 bg-white/10 rounded text-[10px] font-bold text-gray-300">VISA</div>
              <div className="px-2 py-1 bg-white/10 rounded text-[10px] font-bold text-gray-300">MASTER</div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
