# Arquitetura e runbook do sandbox financeiro

## Escopo entregue

O projeto foi migrado de uma demonstração puramente frontend para uma aplicação fullstack com autenticação, banco relacional, API tipada, ledger, eventos de provedores e painel administrativo. O ambiente continua sendo um **sandbox**: nenhuma API financeira de produção, chave privada, ordem de compra, Pix ou transação Stacks é executada.

A jornada persiste o perfil com dados mascarados, simula a aprovação de KYC, cria uma cotação com validade e chave idempotente, registra a compra, produz lançamentos de ledger e salva eventos separados para Pix, custódia e ativação da estratégia. Os adaptadores de sandbox implementam contratos substituíveis por provedores reais.

A confirmação agora é orquestrada em sequência: **Pix/checkout aprovado → liquidez BTCBRL institucional → liquidação da ordem registrada → BTC convertido em sBTC → estratégia Stacks ativada → ledger e compra liquidados**. A Binance está modelada exclusivamente como fonte de liquidez Spot BTCBRL da organização. A aplicação persiste a carteira Stacks pública do cliente em uma tabela própria e não armazena seed phrase, chave privada, senha de carteira ou credencial Binance. Quando não existe uma carteira testnet do cliente, a liquidez é registrada com bloqueador explícito e a etapa on-chain não é transmitida.

No provider Stacks testnet atual, o signer operacional deposita no contrato da estratégia. O endereço público cadastrado é carregado nos eventos para vínculo e reconciliação, mas ainda não é o destino de uma transferência custodiada. Uma conta individualizada exigirá contrato, política de custódia e post-conditions específicos antes de qualquer promessa de crédito direto na carteira do cliente.

A Xverse foi classificada como integração opcional de autocustódia. Sua API pode apoiar dados, RPC, portfólio, swaps e transmissão de transações Bitcoin já assinadas; o Sats Connect pode solicitar assinatura Stacks, mas exige aprovação visível do usuário. Ela não é tratada como custodiante nem como assinador server-side para o fluxo automático da RendeBit.

## Controles implementados

| Controle           | Implementação atual                                                                              | Condição para produção                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Autenticação       | OAuth e procedimentos protegidos                                                                 | Revisar política de sessão e recuperação de conta                                  |
| KYC                | Adaptador determinístico, dados mascarados e webhook idempotente                                 | Contrato e credenciais de MetaMap, Veriff ou parceiro escolhido; LGPD e retenção   |
| Titularidade Pix   | Declaração persistida no sandbox                                                                 | Validação pelo parceiro bancário e comparação de CPF/nome do titular               |
| Cotação            | RFQ sandbox de stBTC com ID externo, validade, mínimo de slippage e consumo na segunda aprovação | Cotação institucional assinada, política de reprice e auditoria de execução        |
| Compra e custódia  | Evento simulado de compra BTC                                                                    | Custodiante contratado, contas segregadas e política de reconciliação              |
| BTC → sBTC → stBTC | Evento simulado com rota registrada no backend                                                   | Bridge sBTC, StackingDAO, limites, liquidez, monitoramento e plano de contingência |
| Ledger             | Lançamentos persistentes com chaves idempotentes e reconciliação diária interna                  | Partidas dobradas, reconciliação independente e trilha de auditoria imutável       |
| Lucro              | Receita realizada menos custos e reservas                                                        | Regra contábil/jurídica aprovada e integração com contabilidade                    |
| Repasse            | Somente simulado, RFQ ativa e duas aprovações administrativas distintas                          | Cofre de chaves ou multisig; limites; dupla aprovação; observabilidade             |

## Política de lucro

O sistema interpreta “todo lucro” como **100% do lucro distribuível**, e não como receita bruta, saldo de clientes ou ativos sob custódia. A fórmula aplicada é:

> Lucro distribuível = receitas realizadas − custos de provedores − provisão tributária − reserva operacional.

A carteira organizacional recebe apenas o ativo configurado — STX, sBTC ou stBTC — após o fechamento do período. A interface solicita somente o endereço público e valida checksum e rede. O sandbox nunca solicita seed phrase, chave privada ou assinatura. Uma ativação real deverá usar um cofre de chaves ou uma carteira multisig e manter aprovação manual como padrão inicial.

O modelo atual de tesouraria é **mono-organização**: há uma única organização econômica e os lançamentos de receita e custo são reconciliados apenas nas contas organizacionais nomeadas. Uma versão white-label multiempresa deverá introduzir `organizationId`, associação explícita de administradores e contas de ledger por organização antes de permitir qualquer segregação entre empresas.

Para o ativo **stBTC**, o sistema mantém uma carteira dedicada de lucros, diferente da carteira operacional. O fluxo registra uma proposta de sweep `BRL → BTC → sBTC → stBTC` que parte exclusivamente de `organization_distributable_profit_brl` e credita `owner_personal_profit_stbtc`; inclui RFQ sandbox com identificador externo e validade de 15 minutos, mínimo protegido por slippage, carteira de destino, rede, bloqueador e chave idempotente. A primeira aprovação mantém o sweep pendente; a segunda deve ser de outro administrador e consome a RFQ para gerar os lançamentos correlacionados no ledger sandbox. A tabela `daily_reconciliations` confere diariamente os registros e está preparada para um heartbeat autenticado às 03:00 UTC depois da publicação. Mainnet, bridge real, assinatura e broadcast permanecem bloqueados. A metodologia detalhada está em `docs/metodologia-fluxo-capitais-lucros-stbtc.md` e a avaliação de parceiros em `docs/pesquisa-parceiros-brl-btc-2026-09-09.md`.

## Modelo de dados

| Tabela                      | Finalidade                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `customer_profiles`         | Perfil, elegibilidade, titularidade Pix e estado do KYC                                                    |
| `customer_wallets`          | Endereço público Stacks por cliente, rede, apelido e estado da carteira principal                          |
| `purchase_quotes`           | Cotações, taxas, expiração e idempotência                                                                  |
| `purchases`                 | Compras, liquidação e estado da estratégia de rendimento                                                   |
| `btc_liquidity_settlements` | Saga da ordem BTCBRL, referência Binance, carteira de destino, estado Stacks e bloqueadores                |
| `ledger_entries`            | Trilha financeira por cliente e organização                                                                |
| `provider_events`           | Webhooks simulados e deduplicação                                                                          |
| `treasury_settings`         | Carteira, parceiro de conversão, rede, ativo, frequência, aprovação, reservas e identificador do heartbeat |
| `profit_distributions`      | Fechamento mensal e repasse simulado, único por período                                                    |
| `profit_capital_sweeps`     | Proposta segregada de lucro distribuível BRL para a conta dedicada em stBTC                                |
| `profit_sweep_approvals`    | Registro idempotente das duas aprovações por administradores distintos                                     |
| `daily_reconciliations`     | Conferência diária de ledger, sweeps, aprovações e cotação                                                 |

## Próxima ativação

A próxima fase deve escolher e contratar os provedores. A avaliação atual inclui Binance como candidata de liquidez Spot BTCBRL, além de Bitso Brasil e Mercado Bitcoin como candidatos condicionais, Foxbit em diligência e Mercado Pago como trilho de Pix. Binance não deve receber permissão de saque automatizado; a conta deve ser institucional, com API Key de escopo mínimo, allowlist de IP e confirmação por User Data Stream e REST. Nenhum parceiro deve ser ativado sem confirmação regulatória, contrato institucional e revisão jurídica. As credenciais devem entrar apenas em secrets do backend. Depois, cada adaptador em `server/providers` será substituído por um cliente real com autenticação, verificação de eventos, retries seguros, circuit breaker e reconciliação. A passagem para produção deve ser bloqueada até existirem revisão jurídica brasileira, definição de VASP/custódia, contratos bancários, políticas LGPD/PLD-FT, runbooks de incidente e testes independentes.

A marca do produto foi atualizada para **RendeBit**. A busca pública inicial não encontrou colisão evidente, mas ainda é obrigatório fazer busca de anterioridade e clearance formal no INPI antes do lançamento.

## Validação reproduzível

Execute `pnpm run check`, `pnpm test`, `pnpm run build` e `pnpm exec tsx scripts/verify-sandbox-db.ts`. O último comando cria dados temporários, confirma idempotência de webhook, compra e fechamento, valida a persistência e remove os registros ao final.
