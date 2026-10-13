import { Award, Users, Heart, Star } from 'lucide-react';

export default function HistoriaPage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-luxury-black via-luxury-dark to-luxury-black overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-10 right-10 w-64 h-64 bg-neutral-900 rounded-full blur-3xl" />
        </div>
        <div className="container-site relative py-20 md:py-28 text-center">
          <p className="text-neutral-700 font-semibold uppercase tracking-widest text-sm mb-4">Nossa História</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            Ótica D'Griffe
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Uma história de paixão por óculos e compromisso com a qualidade visual.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="section-title mb-6">Nossa Trajetória</h2>
              <div className="space-y-4 text-neutral-600 leading-relaxed">
                <p>
                  A Ótica D'Griffe nasceu do sonho de oferecer óculos de qualidade premium
                  com preços acessíveis. Desde o início, nosso foco foi proporcionar
                  aos clientes uma experiência única, combinando estilo, conforto e
                  tecnologia.
                </p>
                <p>
                  Trabalhamos com as melhores marcas do mercado — Ray-Ban, Michael Kors,
                  Vogue, Grazi Massafera, Armani Exchange e muitas outras. Cada peça é
                  cuidadosamente selecionada para garantir qualidade e autenticidade.
                </p>
                <p>
                  Nossa loja física está localizada na Av. Paraguassu, 1629, atendendo
                  clientes de toda a região. Além disso, oferecemos serviços especializados
                  como medição de lentes multifocais e programa de fidelidade com
                  benefícios exclusivos.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-6 text-center">
                <Award size={32} className="text-neutral-700 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-neutral-900">5+ Anos</h3>
                <p className="text-sm text-neutral-500">De experiência</p>
              </div>
              <div className="card p-6 text-center">
                <Users size={32} className="text-neutral-700 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-neutral-900">2.500+</h3>
                <p className="text-sm text-neutral-500">Clientes felizes</p>
              </div>
              <div className="card p-6 text-center">
                <Heart size={32} className="text-neutral-700 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-neutral-900">100%</h3>
                <p className="text-sm text-neutral-500">Satisfação</p>
              </div>
              <div className="card p-6 text-center">
                <Star size={32} className="text-neutral-700 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-neutral-900">4.9</h3>
                <p className="text-sm text-neutral-500">Avaliação</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-ice">
        <div className="container-site">
          <h2 className="section-title text-center mb-10">Nossos Valores</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4A853" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">Qualidade</h3>
              <p className="text-sm text-neutral-600">
                Todos os nossos produtos são originais e passam por rigoroso controle de qualidade.
              </p>
            </div>
            <div className="card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4A853" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06 1.06a5.5 5.5 0 000-7.78z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">Paixão</h3>
              <p className="text-sm text-neutral-600">
                Amamos o que fazemos e isso se reflete em cada atendimento.
              </p>
            </div>
            <div className="card p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4A853" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">Confiança</h3>
              <p className="text-sm text-neutral-600">
                Transparência e honestidade em todas as nossas relações.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16 bg-white">
        <div className="container-site text-center">
          <h2 className="section-title mb-4">Venha nos Conhecer</h2>
          <p className="text-neutral-600 mb-8 max-w-xl mx-auto">
            Estamos te esperando na nossa loja para oferecer o melhor atendimento e os melhores óculos para você.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="https://maps.google.com/?q=Av+Paraguassu+1629"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
              Como Chegar
            </a>
            <a
              href="https://wa.me/5551992809229"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-neutral-900 text-white flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></svg>
              WhatsApp
            </a>
          </div>
          <div className="mt-8">
            <p className="text-sm text-neutral-500">
              Av. Paraguassu, 1629 · Seg-Sex 9h-18h · Sáb 9h-13h
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
