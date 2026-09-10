# RendeBit — documentação do projeto

Este diretório reúne a documentação de produto, engenharia, segurança, operação e integrações da RendeBit. O sistema é **Brasil-first**, permanece em **sandbox/testnet** e não deve ser interpretado como autorização para movimentar dinheiro real ou oferecer rendimento garantido.

## Produto e experiência

| Documento                                                                                       | Conteúdo                                                                                                   |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [Documentação de produto e engenharia](./documentacao-produto-e-engenharia-rendebit-2026-09.md) | Visão, personas, histórias de usuário, requisitos, arquitetura, segurança, LGPD, UX e critérios de go-live |
| [Tom de voz Brasil-first](./tom-de-voz-brasil-first.md)                                         | Linguagem simples, gentil e adequada a residentes no Brasil                                                |
| [Histórico BTC/BRL e Central de Ajuda](./historico-btc-brl-e-central-ajuda.md)                  | Mercado BTC, filtros históricos e perguntas frequentes                                                     |
| [Cotação BTC/BRL ao vivo](./cotacao-btc-brl-ao-vivo.md)                                         | Binance como fonte primária, contingências e limites da cotação spot                                       |
| [Pesquisa de competidores e integrações](./research-competitors-and-integrations-2026-09-08.md) | Referências de mercado e hipóteses de integração                                                           |

## Pix, compras e resgates

| Documento                                                                     | Conteúdo                                                       |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [Login social e depósitos Pix](./login-social-e-depositos-pix-sandbox.md)     | Google/Apple, onboarding e fluxo Pix demonstrativo             |
| [Módulo de resgate Pix](./modulo-resgate-pix-sandbox.md)                      | Cotação, reserva, titularidade, saga de saída e revisão manual |
| [Integração Mercado Pago](./mercado-pago-integration-2026-09-08.md)           | Checkout, webhook, idempotência e pendências para produção     |
| [Pesquisa de parceiros BRL → BTC](./pesquisa-parceiros-brl-btc-2026-09-09.md) | Diligência técnica e regulatória de parceiros                  |

## Binance, Stacks e Xverse

| Documento                                                                           | Conteúdo                                                                         |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Arquitetura Binance e Stacks](./arquitetura-liquidez-binance-stacks-2026-09-09.md) | Liquidez BTCBRL, carteira pública Stacks e fronteiras de custódia                |
| [Contratos Stacks testnet](./stacks-testnet-contracts.md)                           | Preflight, slippage, assinatura offline e bloqueios do ambiente testnet          |
| [Integração operacional Xverse](./integracao-xverse-operacional-2026-09-10.md)      | Conexão autocustodial, permissões, jornada lúdica, auditoria e gates de produção |
| [Avaliação Xverse para backend](./xverse-backend-assessment-2026-09-08.md)          | Limites da Xverse para custódia e automação server-side                          |

## Tesouraria, segurança e operação

| Documento                                                                              | Conteúdo                                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [Runbook fullstack sandbox](./fullstack-sandbox-runbook.md)                            | Arquitetura, estados, providers e procedimentos de validação |
| [Metodologia de capitais e lucros stBTC](./metodologia-fluxo-capitais-lucros-stbtc.md) | Segregação, sweep, dupla aprovação e reconciliação           |
| [Plano de segurança de produção](./plano-seguranca-producao-rendebit-2026-09-08.md)    | Defesa em profundidade, gates de go-live e incidentes        |
| [Arquitetura de segurança](./rendebit-production-security-architecture.png)            | Diagrama visual da arquitetura de controles                  |
| [Fonte do diagrama de segurança](./rendebit-production-security-architecture.dot)      | Arquivo editável do diagrama                                 |

## Governança da documentação

Os documentos devem registrar a data de revisão, separar claramente **sandbox/testnet** de produção e evitar afirmações de garantia de retorno. Mudanças em Pix, custódia, contratos, assinaturas, parceiros regulados ou tratamento de dados pessoais devem atualizar o documento correspondente antes do go-live.

A documentação técnica deve ser publicada junto com o checkpoint de código que a implementa. Referências externas, especialmente de APIs e regras regulatórias, devem apontar para fontes oficiais e ser revalidadas quando a integração for ativada.
