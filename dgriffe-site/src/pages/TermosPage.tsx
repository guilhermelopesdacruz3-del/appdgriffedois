import { Link } from 'react-router-dom';

/**
 * Termos de Uso e Política de Privacidade (conformidade LGPD).
 * Conteúdo padrão da ótica — ajustar CNPJ/contato com o jurídico quando houver.
 */
export default function TermosPage({ modo }: { modo: 'termos' | 'privacidade' }) {
  const titulo = modo === 'termos' ? 'Termos de Uso' : 'Política de Privacidade';

  return (
    <div className="container-site py-10 max-w-3xl">
      <h1 className="text-2xl font-bold text-neutral-900">{titulo}</h1>
      <p className="text-sm text-neutral-500 mt-1">Última atualização: outubro de 2026</p>

      <div className="mt-8 space-y-8 text-[13px] leading-relaxed text-neutral-600">
        {modo === 'termos' && (
          <>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">1. Quem somos</h2>
              <p>
                D&amp;apos;Griffe Wonders é a loja virtual da ótica D&apos;Griffe, responsável pelo
                funcionamento deste site. Dúvidas sobre estes termos: webfinal.dgriffe@gmail.com.
              </p>
            </section>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">2. Como funciona a compra</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Você cria uma conta informando e-mail (com confirmação) e senha;</li>
                <li>Os preços exibidos são validados no servidor antes do pagamento;</li>
                <li>O pagamento é processado pelo Mercado Pago (PIX ou cartão de crédito);</li>
                <li>O pedido é registrado na nossa loja e você recebe o comprovante por e-mail;</li>
                <li>Descontos por pontos de fidelidade e cupons são aplicados conforme as regras descritas no checkout.</li>
              </ul>
            </section>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">3. Pagamentos</h2>
              <p>
                Os dados de cartão de crédito são tokenizados diretamente no navegador pelo SDK do
                Mercado Pago — o número do cartão nunca passa pelos nossos servidores. O valor
                apresentado no checkout é o valor cobrado.
              </p>
            </section>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">4. Trocas e devoluções</h2>
              <p>
                Você tem até 30 dias para solicitar troca ou devolução, conforme o Código de
                Defesa do Consumidor. Fale com a gente pelo WhatsApp (51) 99280-9229.
              </p>
            </section>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">5. Uso do site</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Sua conta é pessoal e intransferível; a senha é sua responsabilidade;</li>
                <li>É proibido usar o site para fins ilícitos ou tentar fraudar pagamentos;</li>
                <li>Pedidos com pagamento rejeitado ou não pago são cancelados automaticamente.</li>
              </ul>
            </section>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">6. Encerramento da conta</h2>
              <p>
                Você pode excluir sua conta a qualquer momento em{' '}
                <Link to="/excluir-conta" className="text-neutral-900 font-semibold underline decoration-neutral-300 hover:decoration-neutral-900">
                  Excluir minha conta
                </Link>
                . Confira também a nossa{' '}
                <Link to="/privacidade" className="text-neutral-900 font-semibold underline decoration-neutral-300 hover:decoration-neutral-900">
                  Política de Privacidade
                </Link>
                .
              </p>
            </section>
          </>
        )}

        {modo === 'privacidade' && (
          <>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">1. Quem trata seus dados</h2>
              <p>
                Ótica D&apos;Griffe (CNPJ a informar) é a controladora dos dados coletados neste site e
                no aplicativo. Dúvidas e Solicitações LGPD: webfinal.dgriffe@gmail.com.
              </p>
            </section>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">2. Dados coletados</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Conta: e-mail, nome, telefone e CPF (quando informados);</li>
                <li>Pedidos: itens, valores, forma de entrega, endereço e observações;</li>
                <li>Pagamentos: registro do meio (PIX/cartão) e status — dados de cartão não são coletados por nós;</li>
                <li>Fidelidade: saldo de pontos, cupons resgatados e histórico;</li>
                <li>Endereços de entrega e preferências de conta;</li>
                <li>Notificações push (função opcional, você pode desativar).</li>
              </ul>
            </section>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">3. Para que usamos</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Criar e gerenciar sua conta;</li>
                <li>Processar pedidos, nota fiscal e entrega;</li>
                <li>Programa de fidelidade (pontos e cupons);</li>
                <li>Atendimento e comunicações sobre seus pedidos;</li>
                <li>Segurança (prevenção a fraudes e uso indevido).</li>
              </ul>
            </section>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">4. Compartilhamento</h2>
              <p>
                Compartilhamos apenas o necessário com parceiros técnicos: Loja Integrada (catálogo,
                pedidos e estoque), Mercado Pago (pagamentos) e Supabase (infraestrutura de banco de
                dados e autenticação). Não vendemos e não cedemos seus dados a terceiros para marketing.
              </p>
            </section>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">5. Seus direitos (LGPD)</h2>
              <p>
                Você pode solicitar a qualquer momento acesso, correção, portabilidade ou exclusão dos
                seus dados, ou revogar um consentimento, pelo e-mail webfinal.dgriffe@gmail.com. Também
                pode excluir a conta sozinho:{' '}
                <Link to="/excluir-conta" className="text-neutral-900 font-semibold underline decoration-neutral-300 hover:decoration-neutral-900">
                  Excluir minha conta
                </Link>{' '}
                (confirmação por código enviado ao seu e-mail).
              </p>
            </section>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">6. Retenção</h2>
              <p>
                Mantemos os seus dados enquanto a conta estiver ativa ou conforme exigido por lei
                (por exemplo, notas fiscais e comprovantes fiscais). Dados de pedidos antigos podem
                ser mantidos anonimizados para fins contábeis.
              </p>
            </section>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">7. Segurança</h2>
              <p>
                Usamos autenticação com tokens (sessão renovada automaticamente), criptografia em
                trânsito (HTTPS) e acesso a dados restrito por permissões. Seus dados nunca ficam
                expostos no navegador além do necessário para o funcionamento.
              </p>
            </section>
            <section>
              <h2 className="text-base font-bold text-neutral-900 mb-2">8. Consentimento</h2>
              <p>
                O uso do site com conta criada implica concordância com esta Política. O aceite é
                registrado quando você marca a caixa de consentimento no cadastro.
              </p>
            </section>
          </>
        )}
      </div>

      <div className="mt-10">
        <Link to="/" className="text-sm font-semibold text-neutral-700 hover:text-neutral-900">
          ← Voltar ao início
        </Link>
      </div>
    </div>
  );
}
