# Integração sBTC/stBTC — Stacks testnet

## Estado verificado em 08/09/2026

O contrato oficial de sBTC em testnet está publicado em `SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token`. O backend valida sua ABI ao vivo e confirmou as funções SIP-010 necessárias, incluindo `get-balance`, `get-decimals`, `get-balance-available` e `transfer`.

O StackingDAO publica os contratos stBTC `stacking-dao-core-stbtc-v1`, `data-stbtc-v1` e `stbtc-token` apenas para mainnet em sua documentação e repositório público. Não foi encontrado um deployment oficial equivalente na Stacks testnet, nem na documentação, na aplicação oficial, no repositório ou no endereço testnet derivado do deployer mainnet. Por isso, a execução real permanece bloqueada até que um principal testnet verificável seja fornecido. O sistema não reutiliza endereços mainnet em testnet e não simula confirmação on-chain.

## Arquitetura implementada

O modo padrão continua `sandbox`. Quando `STACKS_YIELD_MODE=testnet`, o orquestrador executa um preflight antes de Pix ou custódia. O preflight consulta as ABIs dos quatro contratos e exige um signer testnet. Apenas depois ele verifica o saldo sBTC da tesouraria, lê `get-sbtc-per-stbtc-up`, calcula `min-shares-out`, cria uma chamada `deposit(sbtc-amount, min-shares-out)` com postcondition `deny`, assina no backend, transmite para a Stacks testnet e aguarda `tx_status=success` antes de ativar a posição e lançar o ledger.

A postcondition limita a saída ao valor exato de sBTC informado. Os cálculos de BTC/sats e da taxa usam `bigint`, sem ponto flutuante. Transações rejeitadas, abortadas ou expiradas interrompem a operação.

## Configuração

| Variável | Obrigatória no modo testnet | Descrição |
| --- | --- | --- |
| `STACKS_YIELD_MODE` | Sim | Deve ser `testnet` para ativar chamadas reais. |
| `STACKS_TESTNET_SIGNER_PRIVATE_KEY` | Sim | Chave da carteira operacional testnet, armazenada somente como secret. |
| `STACKS_TESTNET_STBTC_CORE_CONTRACT` | Sim | Principal testnet com a função `deposit`. |
| `STACKS_TESTNET_STBTC_TOKEN_CONTRACT` | Sim | Token SIP-010 stBTC testnet. |
| `STACKS_TESTNET_STBTC_DATA_CONTRACT` | Sim | Contrato testnet com `get-sbtc-per-stbtc-up`. |
| `STACKS_TESTNET_SBTC_CONTRACT` | Não | O padrão é o contrato oficial testnet acima. |
| `STACKS_TESTNET_SLIPPAGE_BPS` | Não | Padrão de 50 bps; intervalo permitido de 0 a 500. |
| `STACKS_TESTNET_CONFIRMATION_TIMEOUT_MS` | Não | Padrão de 120 segundos. |

## Opções para concluir a ativação

| Abordagem | Vantagens | Limitações | Complexidade |
| --- | --- | --- | --- |
| Usar um deployment testnet oficial do StackingDAO quando publicado | Correspondência direta com o protocolo oficial | Depende da publicação dos três principais testnet | Baixa |
| Implantar a suíte oficial em uma conta testnet dedicada da RendeBit | Permite testes integrados imediatamente e sem valor real | Exige deploy e inicialização de dezenas de contratos, governança, reservas e configuração PoX-5; não equivale ao serviço oficial | Alta |

A primeira abordagem permanece selecionada como padrão seguro. A segunda deve ser tratada como ambiente de integração próprio, nunca como o protocolo oficial.

## Fontes

1. Stacks, Mainnet and Testnets: https://docs.stacks.co/learn/network-fundamentals/mainnet-and-testnets
2. Stacks, sBTC Builder Quickstart: https://docs.stacks.co/more-guides/sbtc/sbtc-builder-quickstart
3. StackingDAO, stBTC Core: https://docs.stackingdao.com/stackingdao/core-contracts/stbtc-stacking-dao-core
4. StackingDAO, contratos oficiais: https://github.com/StackingDAO/stackingdao-smart-contracts
