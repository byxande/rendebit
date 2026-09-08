# Avaliação da Xverse para a operação de rendimento — 08/09/2026

## Conclusão

A Xverse pode integrar-se à RendeBit como **carteira autocustodial opcional e camada de assinatura pelo usuário**, e a Xverse API pode fornecer dados Bitcoin, RPC, indexação, portfólio, cotações e workflows de swaps. A documentação pública analisada não comprova uma API custodial que assine, em servidor, depósitos em sBTC/stBTC ou outras operações de rendimento sem aprovação do titular.

O Sats Connect é explicitamente wallet-first: a aplicação pede endereços ou assinaturas e cada interação acontece na carteira do usuário com aprovação explícita. No método `stx_signTransaction`, o backend ou frontend pode construir uma transação Stacks sem assinatura, mas a Xverse exibe um prompt; a transação somente é assinada e transmitida após a aprovação do usuário. Portanto, essa integração não atende sozinha à experiência em que a mecânica e a carteira permanecem totalmente invisíveis e a estratégia é executada autonomamente no backend.

A página de sBTC da Xverse descreve a carteira como self-custody: apenas o usuário controla as chaves privadas. Ela orienta o usuário a visitar o bridge sBTC e um aplicativo de recompensas, conectar a carteira e aprovar as operações. Isso confirma o papel de interface/carteira, não de custodiante programável da RendeBit.

O endpoint Bitcoin `POST /v1/rpc/bitcoin/tx` reforça essa separação: ele recebe uma **transação raw já assinada** e apenas a transmite à rede. A assinatura e a guarda das chaves precisam acontecer em outro componente.

## Uso recomendado

| Componente | Uso viável na RendeBit | Limite |
|---|---|---|
| Xverse API | RPC, mempool, UTXOs, histórico, portfólio, market data, cotações e workflows de swaps | Não é cofre de chaves nem motor de custódia server-side comprovado |
| Sats Connect | Conectar Xverse, obter endereços, assinar mensagens, PSBTs e transações Stacks | Exige interação e aprovação visível do usuário |
| `stx_signTransaction` | Assinar uma chamada Clarity previamente construída | A assinatura ocorre na carteira do usuário; não é automação de backend |
| Xverse sBTC Wallet | Jornada autocustodial opcional para clientes avançados | Contraria a proposta principal de carteira invisível |

Para o fluxo principal da RendeBit, a execução automática deve permanecer atrás de um **custodiante institucional ou infraestrutura Wallet-as-a-Service com API, segregação e política de assinatura**, combinado com integração direta aos contratos sBTC/stBTC. A Xverse pode ser oferecida como rota alternativa “Autocustódia”, com consentimento e assinatura explícitos.

## Fontes oficiais

1. Xverse API: https://docs.xverse.app/api
2. Sats Connect: https://docs.xverse.app/sats-connect
3. `stx_signTransaction`: https://docs.xverse.app/sats-connect/stacks-methods/stx_signtransaction
4. Xverse sBTC Wallet: https://www.xverse.app/sbtc-wallet
5. Swaps API: https://docs.xverse.app/api/swaps
6. Send Transaction: https://docs.xverse.app/api/bitcoin/node-and-mempool/send-transaction
