// Tela de Termos de Uso e Política de Privacidade (conformidade LGPD).
// Conteúdo padrão de ótica — o Guilherme pode ajustar depois com o jurídico.
export default function TermosPrivacidade({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="px-5 pt-8 pb-8">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onVoltar}
          className="flex items-center gap-1 text-sm font-bold text-luxury-black"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <h2 className="text-base font-bold text-luxury-black">Termos e Privacidade</h2>
      </div>

      <div className="space-y-4 text-[12px] leading-relaxed text-gray-600">
        <section>
          <h3 className="text-sm font-bold text-luxury-black mb-1">1. Quem somos</h3>
          <p>
            D'Griffe Ótica (doravante "D'Griffe"), CNPJ a ser informado, responsável pelo
            tratamento dos seus dados neste aplicativo. Dúvidas: webfinal.dgriffe@gmail.com
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold text-luxury-black mb-1">2. Dados coletados</h3>
          <p>
            Coletamos: e-mail, nome, telefone e CPF (quando informados), endereço de entrega,
            histórico de pedidos e pontos de fidelidade. Se você optar por cadastrar, também
            guardamos sua <b>receita óptica</b> (graus, médico, data e foto da receita) — é um dado
            de saúde sensível e o cadastro é totalmente opcional, para agilizar recompras e
            atendimento. Notificações push são opcionais e podem ser desativadas.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold text-luxury-black mb-1">3. Por que coletamos</h3>
          <ul className="list-disc pl-4 space-y-1">
            <li>Criar e gerenciar sua conta;</li>
            <li>Processar pedidos, emissão de nota fiscal e entrega;</li>
            <li>Programa de fidelidade (pontos e cupons);</li>
            <li>Registrar sua receita óptica e agilizar recompras e o atendimento óptico (se você cadastrá-la);</li>
            <li>Atendimento e comunicações sobre seus pedidos;</li>
            <li>Segurança (prevenção a fraude e uso indevido).</li>
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-bold text-luxury-black mb-1">4. Compartilhamento</h3>
          <p>
            Seus dados são compartilhados apenas com os parceiros necessários à operação: Loja
            Integrada (catálogo e pedidos), Mercado Pago (pagamentos) e Supabase (banco de dados e
            autenticação da conta). Não vendemos seus dados e não os usamos para publicidade.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold text-luxury-black mb-1">5. Seus direitos (LGPD)</h3>
          <p>
            Você pode solicitar a qualquer momento acesso, correção, portabilidade ou exclusão dos
            seus dados, ou revogar consentimento, pelo e-mail webfinal.dgriffe@gmail.com — e pode
            excluir a conta sozinho, sem falar com ninguém: em <b>Perfil → Excluir minha conta</b>,
            informando sua senha de acesso (a exclusão apaga em cascata perfil, endereços, favoritos,
            fidelidade, receitas ópticas e o acesso). Na web, a mesma exclusão está em
            dgriffe-site.pages.dev/excluir-conta.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-bold text-luxury-black mb-1">6. Retenção</h3>
          <p>Mantemos os dados enquanto sua conta estiver ativa ou conforme exigido por lei (ex.: notas fiscais).</p>
        </section>

        <p className="text-[10px] text-gray-400 pt-2">
          Ao marcar o consentimento no cadastro, você concorda com esta Política de Privacidade.
        </p>
      </div>
    </div>
  );
}
