# Avaliação de parceiros para conversão BRL → BTC

**Data de referência:** 9 de setembro de 2026  
**Autor:** Manus AI  
**Escopo:** triagem técnica, operacional e regulatória para a RendeBit. Este documento não substitui parecer jurídico, regulatório, tributário, de prevenção à lavagem de dinheiro ou de contratação.

## Conclusão

A RendeBit deve manter o parceiro de conversão como **não selecionado** no ambiente de produção até concluir uma diligência formal e contratar uma contraparte que confirme por escrito o seu escopo regulatório e operacional. A **Bitso Brasil** é a primeira candidata para uma prova de conceito institucional porque sua documentação pública cobre operações em reais, Pix, cotação, conversão, RFQ e webhooks de funding/withdrawal. O **Mercado Bitcoin** é a alternativa principal por reunir mercado BTC/BRL, API de ordens, MB Cloud e oferta Prime. A **Foxbit** pode participar da diligência, mas sua própria divulgação informa processo de autorização SPSAV. O **Mercado Pago** deve permanecer restrito ao recebimento e à confirmação de Pix; a documentação pública não comprova uma API institucional para executar BRL → BTC.

A conclusão não equivale a uma aprovação regulatória de qualquer empresa. O Banco Central do Brasil diferencia ativos virtuais, moeda eletrônica e serviços de pagamento. A regulamentação de prestadoras de serviços de ativos virtuais exige avaliação do enquadramento e autorização aplicável; uma autorização como instituição de pagamento ou para operar câmbio não prova, sozinha, a autorização para intermediar ou custodiar ativos virtuais. [1] [2] [3]

> **Decisão de arquitetura:** a integração permanece em sandbox. A RendeBit agora registra cotação com validade, mínimo protegido contra slippage, dupla aprovação administrativa e reconciliação diária antes de qualquer liquidação demonstrativa. A ativação de mainnet, chave de API institucional, compra real, bridge, custódia e broadcast continuam bloqueados.

## Comparação dos candidatos

| Candidato           | Evidência de BRL → BTC e integração                                                                                                                                                                                                          | Situação regulatória identificada                                                                                                                                                                | Papel recomendado                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Bitso Brasil**    | A documentação Business lista APIs de pay-in/out, Pix, RFQ, conversão e trading. A documentação de webhooks informa que eventos podem ser repetidos ou fora de ordem, exigindo idempotência e reconciliação. [4] [5] [6]                     | A Nvio Brasil Bitso IP é listada pelo BCB como habilitada a operar câmbio. Não foi localizada confirmação pública de autorização PSAV específica para a entidade nas fontes consultadas. [2] [7] | **Candidata principal condicional** para onboarding, RFQ e piloto fechado.                                           |
| **Mercado Bitcoin** | A API documenta contas, saldos, BTC-BRL e ordens; MB Cloud e MB Prime descrevem soluções institucionais e liquidação em reais. [8] [9] [10]                                                                                                  | Há referência oficial à autorização da Mercado Bitcoin IP como emissor de moeda eletrônica. A autorização PSAV específica não foi confirmada nas fontes pesquisadas. [2] [11]                    | **Alternativa principal condicional**, mediante contrato institucional que prevaleça sobre os termos da API pública. |
| **Foxbit**          | A documentação Invest/Prime Desk expõe BTC/BRL, RFQ, execução e histórico. A página Gateway informa APIs e sandbox, mas os eventos BTC específicos precisam de confirmação comercial. [12] [13]                                              | A Foxbit informa que está em processo de autorização como SPSAV. A concessão final não foi confirmada nas fontes revisadas. [3] [12]                                                             | **Candidata de diligência**; não ativar até confirmar autorização, entidade contratante e eventos.                   |
| **Mercado Pago**    | As APIs públicas confirmam Pix e webhooks de pagamentos. O produto de cripto é anunciado para o aplicativo, com a Paxos mencionada como parceira; não foi encontrada API institucional de ordens, carteira ou liquidação BTC. [14] [15] [16] | O BCB identifica Mercado Pago como instituição de pagamento. Isso não estabelece, por si só, escopo PSAV ou conversão institucional BRL → BTC. [1] [17]                                          | **Somente trilho Pix/pagamentos**.                                                                                   |

## Requisitos mínimos antes de contratar

O parceiro selecionado deve assinar um contrato institucional que identifique a entidade jurídica brasileira responsável pela execução, pela custódia e pela liquidação. O contrato precisa explicitar se a RendeBit atua em conta própria, como introducing broker, como agente de usuários finais ou em outro modelo admitido. Também deve definir o tratamento de KYC/KYB, beneficiários finais, origem de recursos, sanções, monitoramento transacional, Travel Rule e obrigações de reporte.

A prova técnica deve validar uma cotação executável assinada ou vinculada a um identificador externo, validade, preço de referência, spread, tarifa, valor mínimo recebido, slippage máximo, cancelamento, rejeição e idempotência. Ela deve incluir eventos de depósitos, ordens, conversões, saques e liquidações, além de uma consulta de status independente para compensar webhooks duplicados ou fora de ordem. A RendeBit deve armazenar a cotação, o identificador da contraparte, a ordem e os eventos em um ledger auditável.

A diligência de custódia deve confirmar carteira de origem e destino, política de saque, rede Bitcoin, finalização, segregação patrimonial e operacional, limites, janelas de liquidação, SLA, continuidade, plano de falhas, auditoria e responsabilidade por incidentes. Não se deve inferir que prova de reservas, custódia de varejo ou controles anunciados atendem ao contrato específico da RendeBit sem confirmação documental.

## Controles implementados no sandbox

A tesouraria passou a exigir **duas aprovações de administradores distintos** para concluir um sweep de lucro em stBTC. A primeira aprovação permanece pendente; apenas a segunda pode consumir a cotação executável e registrar os dois lados do ledger demonstrativo. O sistema bloqueia a operação se a cotação expirar antes da segunda aprovação e preserva chaves idempotentes para evitar duplicidade.

A cotação sandbox é emitida como RFQ demonstrativa com identificador externo, preço de referência, estimativa, mínimo protegido por slippage e validade. Ela representa uma interface substituível para o parceiro contratado e não uma oferta vinculante de compra ou venda. A rota continua explícita: BRL → BTC → sBTC → stBTC.

A reconciliação diária persiste um registro por data e organização. Ela verifica os lançamentos do dia, o estágio das aprovações, a vigência da cotação e a existência dos dois lançamentos esperados para cada sweep concluído. O controle atual é interno ao ledger sandbox; uma reconciliação independente de produção deve confrontar os registros com extratos bancários, eventos do parceiro, posições de custódia e confirmações on-chain.

## Próxima decisão recomendada

A RendeBit deve iniciar a diligência com **Bitso Brasil** e **Mercado Bitcoin** em paralelo, usando o mesmo questionário e os mesmos cenários de teste. A seleção final deve ser feita somente após obter respostas contratuais e técnicas verificáveis sobre o escopo brasileiro, as permissões de API, as contas de liquidação, os limites, o modelo de custódia, a retirada de BTC, os eventos e o SLA. Foxbit permanece como alternativa de acompanhamento. Mercado Pago continua adequado ao Pix já preparado no produto, mas não à execução de cripto.

**Base:** a análise considera conversão institucional BRL → BTC, não preço de varejo nem recomendação de investimento.  
**Tempo:** fontes consultadas em 9 de setembro de 2026.  
**Premissas:** a RendeBit opera apenas em sandbox/testnet e não movimenta fundos reais.  
**Fontes e confiança:** fontes primárias do BCB e documentações oficiais das plataformas. A confirmação de escopo contratual e autorização PSAV específica continua pendente em vários casos.  
**Compliance:** isto é pesquisa e análise operacional, não aconselhamento financeiro personalizado.

## References

[1]: https://www.bcb.gov.br/meubc/faqs/p/moedas-virtuais-criptomoedas-ou-criptograficas "Banco Central do Brasil — FAQ sobre ativos virtuais"
[2]: https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20BCB&numero=520 "Banco Central do Brasil — Resolução BCB nº 520 de 2025"
[3]: https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20BCB&numero=519 "Banco Central do Brasil — Resolução BCB nº 519 de 2025"
[4]: https://bitso.com/business/developers "Bitso Business — Developers"
[5]: https://bitso.com/business/products/rfq "Bitso Business — RFQ"
[6]: https://docs.bitso.com/bitso-payouts-funding/docs/webhooks.md "Bitso Payouts and Funding — Webhooks"
[7]: https://www.bcb.gov.br/content/estabilidadefinanceira/evolucaosfnmes/202604%20-%20Quadro%2004%20-%20Autoriza%C3%A7%C3%B5es%20e%20altera%C3%A7%C3%B5es%20societ%C3%A1rias%20-%20principais%20ocorr%C3%AAncias.pdf "Banco Central do Brasil — Quadro de autorizações e alterações societárias de abril de 2026"
[8]: https://api.mercadobitcoin.net/api/v4/docs "Mercado Bitcoin — Documentação API"
[9]: https://www.mercadobitcoin.com.br/cloud "Mercado Bitcoin — MB Cloud"
[10]: https://www.mercadobitcoin.com.br/prime-services "Mercado Bitcoin — MB Prime Services"
[11]: https://www.bcb.gov.br/content/publicacoes/evolucaosfn/r202312/T2DO_Quadro%2004%20-%20Principais%20publica%C3%A7%C3%B5es%20no%20Di%C3%A1rio%20Oficial%20da%20Uni%C3%A3o.pdf "Banco Central do Brasil — Publicações do Diário Oficial da União de 2023"
[12]: https://infra.foxbit.com.br/regulacao-e-licencas/ "Foxbit Infra — Regulação e licenças"
[13]: https://docs-otc.foxbit.com.br/ "Foxbit Invest — Documentação REST API"
[14]: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks "Mercado Pago Developers — Webhooks"
[15]: https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/pix "Mercado Pago Developers — Pix"
[16]: https://www.mercadopago.com.br/ajuda/parceria-paxos_22349 "Mercado Pago — Parceria com Paxos"
[17]: https://dadosabertos.bcb.gov.br/dataset/ir-10573521000191 "Banco Central do Brasil — Dados de instituição regulada Mercado Pago"
