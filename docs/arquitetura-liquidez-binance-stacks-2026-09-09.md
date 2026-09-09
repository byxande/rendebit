# Arquitetura de liquidez BTCBRL e liquidação Stacks por cliente

**Autor:** Manus AI  
**Data:** 9 de setembro de 2026  
**Estado:** Implementada em sandbox/testnet; execução real bloqueada

## Conclusão

A RendeBit passa a tratar a Binance exclusivamente como uma fonte institucional de **liquidez Spot BTCBRL**. A Binance não é a carteira Stacks do cliente, não armazena a posição on-chain do cliente e não é utilizada como mecanismo de saque automatizado. A aplicação persiste apenas o **endereço público Stacks** de cada cliente. Nenhuma seed phrase, chave privada, senha de carteira ou credencial Binance é armazenada no banco de dados.

A compra segue uma saga persistida. O pagamento em BRL é confirmado, a ordem BTCBRL é liquidada na camada de liquidez, a liquidação é registrada de forma idempotente e a etapa Stacks é iniciada somente quando há endereço público compatível, contrato verificável, rede permitida, saldo disponível, assinatura autorizada e reconciliação sem divergência. Atualmente, a execução permanece em **sandbox** e a integração Stacks está limitada à testnet.

## Separação de responsabilidades

| Camada                 | Responsabilidade                                             | Dado persistido                                                 | Limite de segurança                                                   |
| ---------------------- | ------------------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| Pagamento em BRL       | Receber e confirmar Pix ou cartão pelo parceiro de pagamento | Referência do pagamento, estado e valores                       | A compra não começa antes da confirmação reconciliada                 |
| Liquidez BTCBRL        | Comprar BTC para a operação na Binance Spot                  | Ordem, quantidade executada, preço efetivo e referência externa | Somente a conta institucional opera; saque não é automatizado         |
| Carteira do cliente    | Vincular a posição à rede Stacks                             | Endereço público, rede, apelido e status                        | Não armazena chave privada, seed phrase ou senha                      |
| Stacks                 | Converter e aplicar os ativos de protocolo                   | Eventos, txid, limites de slippage e preflights                 | Testnet, contrato verificável, post-condition e assinatura autorizada |
| Ledger e reconciliação | Conciliar caixa, posição e etapas do fluxo                   | Lançamentos, eventos idempotentes e exceções                    | Divergência bloqueia a evolução operacional                           |

## Fluxo operacional

A jornada abaixo separa explicitamente o BTC comprado na Binance do ativo que será utilizado em Stacks.

```text
Pix/cartão confirmado
        ↓
Ordem institucional Spot BTCBRL na Binance
        ↓
Liquidação BTC registrada em btc_liquidity_settlements
        ↓
Carteira Stacks pública do cliente validada e vinculada
        ↓
Preflight de rede, contrato, saldo, cotação e assinatura
        ↓
BTC → sBTC por bridge/issuer verificável
        ↓
sBTC → stBTC por contrato Stacks verificado
        ↓
Txid, eventos e ledger conciliados
```

A tabela `btc_liquidity_settlements` preserva a fronteira entre a ordem BTCBRL e as etapas on-chain. Seus estados incluem `pending_liquidity`, `stacks_pending`, `stacks_submitted`, `confirmed`, `blocked` e `failed`. Quando não existe carteira Stacks testnet cadastrada, a liquidez é registrada como `blocked` e contém uma razão explícita. Ao cadastrar uma carteira pública testnet válida, o registro bloqueado passa para `stacks_pending`; isso não transmite nenhuma transação por si só.

## Controles de execução Binance

O adaptador real usa a ordem `POST /api/v3/order` para `BUY MARKET` no símbolo `BTCBRL` com `quoteOrderQty`, API Key e assinatura. Ele consulta a disponibilidade do par e da permissão de trading durante o preflight. A resposta só é aceita quando a ordem está integralmente preenchida. O preço médio efetivo é calculado a partir de BRL acumulado dividido por BTC executado, e uma execução acima do limite de slippage configurado é bloqueada para reconciliação manual.[1]

A integração real exige simultaneamente a presença de `BINANCE_API_KEY`, `BINANCE_API_SECRET` e do gate explícito `RENDEBIT_ENABLE_REAL_BINANCE_LIQUIDITY=true`. O código não contém endpoints de saque Binance. Para produção, a chave deve ter escopo mínimo de leitura e Spot trading, sem permissão de saque, e ser limitada por allowlist de IP. A conta deve ser institucional e separada dos clientes.

A confirmação operacional não pode depender apenas da resposta síncrona de criação da ordem. A Binance documenta eventos em tempo real de conta e `executionReport` para alterações de ordem, incluindo quantidades executadas cumulativas. A produção deve consumir esse fluxo autenticado e confrontá-lo com consulta REST, ledger e reconciliação diária.[2]

## Controles Stacks

O endereço do cliente é validado pela versão C32 da rede, aceitando `ST…` para testnet e `SP…` para mainnet. O cadastro é somente uma referência pública. A integração atual não tenta derivar chaves, gerar carteiras custodiadas ou assinar em nome do cliente.

No provider Stacks testnet existente, o depósito stBTC é assinado pelo signer operacional e enviado ao contrato da estratégia. O endereço público do cliente acompanha os eventos para vínculo e reconciliação, mas **não é apresentado como destino de uma transferência**. Uma futura implementação de conta individualizada deverá ter um contrato e uma política de custódia que definam explicitamente o destino, além de testes de post-condition e aprovação próprios.

O provider de testnet bloqueia a conversão BTC → sBTC até que exista um bridge ou issuer verificável. A aplicação em stBTC também exige modo testnet, signer configurado, ABI dos contratos e saldo sBTC antes de construir a transação. A transação usa post-condition `deny`, persiste a intenção assinada com chave idempotente e só considera o fluxo confirmado depois da consulta ao nó Stacks. Esses bloqueios evitam que uma compra BTCBRL seja apresentada como aplicação on-chain antes da liquidação técnica verificável.

## Condições para ativação real

| Gate                | Evidência necessária                                                              | Estado atual          |
| ------------------- | --------------------------------------------------------------------------------- | --------------------- |
| Parceiro Binance    | Conta institucional aprovada, documentação contratual e região elegível           | Pendente              |
| Credenciais         | Secrets em cofre, permissão mínima, allowlist de IP e rotação                     | Pendente              |
| Execução            | User Data Stream, consulta REST de contingência e política para parcial/rejeitada | Pendente              |
| Conversão para sBTC | Bridge ou issuer verificável e procedimento de reconciliação                      | Bloqueado por design  |
| Stacks              | Contratos, ABI, signer sob política de cofre ou multisig e monitoramento de tx    | Testnet com gates     |
| Custódia e jurídico | KYC, titularidade, segregação, parceiro regulado e revisão jurídica               | Pendente              |
| Operação            | Dupla aprovação, conciliação diária e resposta a incidentes                       | Disponível em sandbox |

> A RendeBit não deve habilitar `RENDEBIT_ENABLE_REAL_BINANCE_LIQUIDITY=true` enquanto todos os gates forem documentados, testados e aprovados por responsáveis de operações, segurança, jurídico e compliance.

## Referências

[1]: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/trading-endpoints "Binance Spot API — Trading Endpoints"
[2]: https://developers.binance.com/docs/binance-spot-api-docs/user-data-stream "Binance Spot API — User Data Streams"
[3]: https://docs.stacks.co/learn/sbtc "Stacks Documentation — sBTC"
