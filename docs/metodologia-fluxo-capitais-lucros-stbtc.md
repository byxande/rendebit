# Metodologia de fluxo de capitais para a conta pessoal de lucros em stBTC

**Autor:** Manus AI  
**Estado:** Sandbox e testnet; nenhuma transferência financeira ou on-chain é executada por este fluxo.  
**Atualizado em:** 9 de setembro de 2026

## Conclusão executiva

A RendeBit passa a tratar o lucro da organização como um fluxo independente do capital de clientes. A nova **conta pessoal de lucros em stBTC** é uma conta contábil e operacional dedicada do administrador ou da organização, registrada como `owner_personal_profit_stbtc`. Ela recebe apenas o lucro distribuível depois do fechamento do período, das reservas e de uma aprovação explícita. Ela nunca recebe depósitos Pix de clientes, posições de clientes, saldo reservado para resgates ou capital que ainda não foi conciliado.

O fluxo é persistido como uma proposta de capital (`profit_capital_sweeps`) e usa a rota conceitual **BRL → BTC → sBTC → stBTC**. O sistema registra valor em reais, cotação executável sandbox com identificador externo e validade, limite mínimo protegido por slippage, carteira pública de destino, rede e trilha idempotente. No ambiente atual, duas aprovações administrativas distintas produzem somente lançamentos de ledger sandbox. O sistema não assina nem transmite transações Stacks.

## Princípio de segregação

> **Capital de cliente não é receita da organização. Receita não é lucro. Lucro distribuível não é automaticamente transferível.**

A metodologia divide os saldos por finalidade antes de qualquer conversão. Essa separação reduz o risco de misturar recursos de cliente com o patrimônio da organização e torna cada decisão auditável.

| Camada             | Conta ou origem                                            | Ativo | Pode financiar lucro pessoal? | Regra operacional                                                 |
| ------------------ | ---------------------------------------------------------- | ----: | ----------------------------- | ----------------------------------------------------------------- |
| Cliente            | `customer_brl_available`                                   |   BRL | Não                           | Depósitos confirmados via Pix pertencem ao cliente.               |
| Cliente            | `customer_btc_position`                                    |   BTC | Não                           | Posição do cliente, inclusive durante o rendimento.               |
| Liquidação         | `customer_brl_redemption`                                  |   BRL | Não                           | Valor em processo de resgate Pix.                                 |
| Organização        | `organization_fee_revenue` e `organization_redemption_fee` |   BRL | Sim, após fechamento          | Somente taxas efetivamente realizadas entram no cálculo.          |
| Organização        | `protocol_redemption_cost` e custos de parceiro            |   BRL | Não diretamente               | Custos são deduzidos antes das reservas.                          |
| Reservas           | Provisão tributária e reserva operacional                  |   BRL | Não                           | Permanecem segregadas até decisão contábil e jurídica apropriada. |
| Lucro distribuível | `organization_distributable_profit_brl`                    |   BRL | Sim                           | Origem exclusiva do sweep de lucro.                               |
| Conta dedicada     | `owner_personal_profit_stbtc`                              | stBTC | Destino final                 | Recebe apenas a estimativa aprovada do lucro distribuível.        |

## Waterfall do período

O fechamento usa lançamentos realizados no período `AAAA-MM`. O cálculo não usa patrimônio sob custódia, cotação de portfólio, depósitos de cliente ou rendimento estimado. A fórmula é:

> **Lucro distribuível = receitas realizadas − custos de provedores − provisão tributária − reserva operacional.**

| Etapa                  | Base de cálculo                                        | Resultado                    | Controle aplicado                                |
| ---------------------- | ------------------------------------------------------ | ---------------------------- | ------------------------------------------------ |
| 1. Receita realizada   | `fee_revenue` em BRL                                   | Receita bruta do período     | Exclui principal e posição dos clientes.         |
| 2. Custos de parceiro  | `provider_cost` em BRL                                 | Resultado antes das reservas | Custos nunca são tratados como receita.          |
| 3. Provisão tributária | Resultado antes das reservas × percentual configurado  | Reserva tributária           | Percentual persistido na política de tesouraria. |
| 4. Reserva operacional | Resultado antes das reservas × percentual configurado  | Reserva operacional          | Protege continuidade e contingências.            |
| 5. Lucro distribuível  | Resultado após reservas × participação de distribuição | BRL elegível ao sweep        | Nunca é negativo.                                |
| 6. Sweep proposto      | Lucro distribuível ÷ cotação de referência stBTC/BRL   | stBTC estimado e mínimo      | Slippage máximo de 50 bps no sandbox.            |

## Proposta de sweep BRL → stBTC

Cada fechamento pode originar uma única proposta, protegida por unicidade do fechamento e chave idempotente. A proposta registra a origem, o destino e as condições de execução antes de qualquer aprovação.

| Campo registrado           | Finalidade de controle                                                              |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `sourceAmountBrl`          | Valor máximo originado exclusivamente do lucro distribuível.                        |
| `referenceAssetBrl`        | Cotação usada para estimar stBTC; no sandbox representa uma RFQ demonstrativa.      |
| `quoteExternalId`          | Identificador externo da RFQ sandbox; deve mapear a cotação do parceiro contratado. |
| `quoteExpiresAt`           | Momento de expiração da cotação; a execução é bloqueada após esse prazo.            |
| `estimatedAssetAmount`     | Quantidade indicativa de stBTC.                                                     |
| `minimumAssetAmount`       | Piso calculado após o slippage configurado.                                         |
| `route`                    | Rota explícita `BRL>BTC>sBTC>stBTC`.                                                |
| `destinationWalletAddress` | Endereço público da carteira dedicada de lucros.                                    |
| `network`                  | Rede em que a proposta foi criada. Mainnet continua bloqueada.                      |
| `blockerReason`            | Motivo legível quando a proposta não pode prosseguir.                               |
| `transactionId`            | Identificador sandbox; em produção deverá ser o identificador on-chain conciliado.  |

A carteira dedicada é configurada separadamente da carteira operacional. O backend rejeita a mesma carteira nos dois campos, pois a conta de lucros precisa permanecer segregada da tesouraria usada em operação. A interface aceita somente endereço público e valida a rede selecionada. Ela não solicita seed phrase, chave privada ou assinatura local.

## Gates de aprovação

A proposta tem quatro estados simples. O desenho evita execução automática e permite reconciliação antes da etapa seguinte.

| Estado             | Significado                                                                         | Ação permitida                                    |
| ------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| `blocked`          | Falta carteira válida, a rede é mainnet ou um gate de segurança não foi satisfeito. | Corrigir configuração; não há aprovação.          |
| `pending_approval` | A conta dedicada é válida em testnet e a proposta está pronta para revisão.         | Aprovação manual sandbox.                         |
| `simulated_sent`   | O ledger registrou a saída do lucro em BRL e a entrada em stBTC da conta dedicada.  | Auditoria e reconciliação; não há broadcast real. |
| `cancelled`        | Estado reservado para cancelamento auditável futuro.                                | Nenhuma execução.                                 |

A primeira aprovação persiste em `profit_sweep_approvals` e mantém a proposta pendente. A segunda precisa ser registrada por outro administrador e só é aceita quando a RFQ permanece ativa. A execução sandbox consome a cotação e cria dois lançamentos correlacionados: débito de `organization_distributable_profit_brl` em BRL e crédito de `owner_personal_profit_stbtc` em stBTC. Ambos compartilham o identificador do sweep e incluem a rota, a carteira pública, o mínimo protegido e o identificador sandbox nos metadados.

## Reconciliação diária

A tabela `daily_reconciliations` persiste um registro idempotente por organização e data. A conferência verifica lançamentos do dia, aprovações pendentes, validade da cotação e a presença dos dois lançamentos esperados em sweeps concluídos. O ambiente publicado poderá ativar um heartbeat diário às 03:00 UTC, autenticado pelo identificador persistido em `treasury_settings`.

Esse controle ainda é interno ao ledger sandbox. A reconciliação independente exigida em produção deve confrontar o ledger da RendeBit com extratos bancários, eventos e extratos de custódia do parceiro, além das confirmações on-chain.

## Limite entre sandbox, testnet e produção

A implementação atual não converte reais, não compra BTC, não emite sBTC e não transmite stBTC. sBTC é um token SIP-010 na Stacks que representa BTC em paridade 1:1, mas a existência desse ativo não elimina a necessidade de controles de execução, liquidez, custódia e reconciliação.[1] A testnet é útil para validar contratos e integrações, mas não substitui a governança exigida para patrimônio real.[2]

| Ambiente       | Resultado permitido                                                                                    | Resultado proibido                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Sandbox atual  | Proposta persistida, cálculo de mínimo, aprovação e ledger demonstrativo.                              | Movimentação de BRL, BTC, sBTC ou stBTC.                                     |
| Testnet futura | Construção e assinatura controlada de transação após contratos verificáveis e conta financiada.        | Uso de chave de produção, carteira de cliente ou broadcast automático.       |
| Produção       | Execução somente após aprovação, cofre ou multisig, cotação executável, bridge/issuer e reconciliação. | Repasse automático, chave em código, mistura de fundos ou bypass de revisão. |

## Requisitos para ativação real

A ativação de uma transferência real para a conta dedicada permanece bloqueada até que todos os controles abaixo sejam aprovados. O requisito é cumulativo: a ausência de qualquer item mantém o sweep em estado bloqueado.

| Controle                 | Evidência necessária antes de produção                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Conta segregada          | Carteira dedicada em nome da entidade ou estrutura jurídica definida; política de acesso documentada.      |
| Custódia e assinatura    | Cofre de chaves ou multisig, limites por transação e dupla aprovação.                                      |
| Conversão BRL → BTC      | Parceiro contratado, preço executável, limites e conciliação de liquidação.                                |
| Ponte BTC → sBTC         | Bridge ou emissor verificável, monitoramento de status, tratamento de falhas e reconciliação independente. |
| Estratégia stBTC         | Contrato verificado, leitura de taxa, post-conditions, limite de slippage e teste de saída.                |
| Contabilidade e tributos | Regra de reconhecimento de receita, reservas e distribuição revisada por contador e jurídico no Brasil.    |
| Observabilidade          | Alertas, auditoria imutável, reconciliação diária e procedimento de incidente.                             |

## Implementação entregue

O backend inclui as tabelas `profit_capital_sweeps`, `profit_sweep_approvals` e `daily_reconciliations`, uma carteira pública dedicada `personalProfitWalletAddress`, cálculo determinístico de slippage, RFQ sandbox com validade, rotas administrativas protegidas para propor e aprovar o sweep e lançamentos de ledger correlacionados. O painel operacional apresenta a origem, a rota, o destino, o valor estimado, o mínimo protegido, a cotação, o número de aprovações, a rede e os bloqueadores. A verificação ponta a ponta cria um fechamento, propõe o sweep, registra duas aprovações distintas, executa a reconciliação e remove os dados temporários.

## References

[1]: https://docs.stacks.co/learn/sbtc "sBTC | Stacks Documentation"
[2]: https://docs.stacks.co/learn/network-fundamentals/mainnet-and-testnets "Mainnet and Testnets | Stacks Documentation"
