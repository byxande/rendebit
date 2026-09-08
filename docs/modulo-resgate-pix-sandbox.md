# Módulo de resgate via Pix — sandbox RendeBit

## Escopo entregue

O módulo implementa o ciclo completo de um resgate demonstrativo. Ele calcula e persiste uma cotação, valida KYC e titularidade Pix, reserva o saldo do cliente, orquestra a saída simulada do rendimento, converte o BTC para BRL, executa um Pix cash-out simulado e grava a trilha no ledger e nos eventos de provedores.

Nenhuma etapa movimenta dinheiro ou criptoativo real. O módulo usa adaptadores determinísticos de sandbox. Se `STACKS_YIELD_MODE=testnet` estiver ativo, o resgate permanece bloqueado porque o provedor testnet atual ainda não implementa uma saída stBTC verificável.

## Jornada do cliente

A área **Resgatar via Pix** mostra o saldo realmente disponível a partir das compras persistidas, descontando resgates concluídos, em processamento ou em revisão. O usuário escolhe uma quantidade em BTC, usa atalhos de 25%, 50% ou máximo, confere a conta Pix mascarada e solicita uma cotação.

A cotação tem validade de 60 segundos. A revisão exibe quantidade reservada, conta de destino, valor bruto, taxas do protocolo, conversão/Pix e valor líquido. A confirmação exige aceite explícito do aviso de risco. Após a conclusão, a referência do Pix simulado e o status aparecem no histórico.

## Máquina de estados

| Estado | Etapa | Significado |
|---|---|---|
| `processing` | `reserved` | Cotação confirmada e saldo reservado |
| `processing` | `protocol_exit` | Saída simulada de stBTC para BTC registrada |
| `processing` | `conversion` | Venda simulada de BTC para BRL registrada |
| `processing` | `pix` | Pix cash-out simulado confirmado |
| `settled` | `completed` | Ledger gravado e resgate concluído |
| `failed` | etapa anterior à saída | Nenhuma etapa irreversível foi concluída; saldo volta a ficar disponível |
| `manual_review` | etapa posterior à saída | Alguma etapa irreversível já ocorreu; saldo permanece reservado para reconciliação |

## Persistência

| Tabela | Finalidade |
|---|---|
| `redemption_quotes` | Quantidade, referência BTC/BRL, taxas, líquido, validade e idempotência da cotação |
| `redemptions` | Estado da saga, destino Pix mascarado e referências de protocolo, conversão e Pix |
| `provider_events` | Evidência deduplicada de cada integração simulada |
| `ledger_entries` | Saída da posição, conversão, custos, receita de serviço e Pix out |

A criação do resgate bloqueia a linha do usuário com `SELECT ... FOR UPDATE`. Isso serializa confirmações concorrentes do mesmo usuário no sandbox e reduz o risco de dois resgates consumirem o mesmo saldo. A cotação e a confirmação possuem chaves idempotentes independentes.

## APIs tRPC

| Procedimento | Acesso | Função |
|---|---|---|
| `redemptions.summary` | Usuário autenticado | Retorna saldo BTC disponível e histórico individual |
| `redemptions.createQuote` | Usuário autenticado e verificado | Cria a cotação persistida de 60 segundos |
| `redemptions.confirm` | Usuário autenticado | Confirma a cotação e executa a saga sandbox |
| `redemptions.operationalList` | Administrador | Exibe a fila completa no painel operacional |

## Controles implementados

O backend revalida o saldo na confirmação, dentro da transação. Uma conta Pix mascarada e marcada como mesma titularidade é obrigatória. O fluxo é fail-closed. A ausência do método de saída no provedor bloqueia o resgate antes da reserva. Falhas depois da saída do protocolo geram revisão manual, em vez de devolver automaticamente o saldo ao cliente.

O módulo mantém as etapas técnicas fora da experiência principal, mas preserva as referências para auditoria. O painel operacional mostra cliente, quantidade, líquido, etapa, status e referência Pix.

## Limitações para produção

Antes de qualquer Pix real, os adaptadores sandbox devem ser substituídos por PSP, custodiante e infraestrutura stBTC homologados. Webhooks devem usar mTLS ou assinatura criptográfica, proteção contra replay e consulta autoritativa ao provedor. A titularidade precisa ser comparada com CPF e nome reais. O ledger atual ainda deverá migrar para partidas dobradas e journal batches balanceados, conforme o plano de segurança do projeto.

A saída on-chain necessita de deployment stBTC oficialmente verificado na rede escolhida, contratos em allowlist, ABI e bytecode fixados, postconditions em modo `deny`, proteção de slippage, finalidade/reorg e assinatura por HSM ou MPC. Uma chave privada em variável de ambiente não é arquitetura aceitável para produção.

## Validação reproduzível

Execute:

```bash
pnpm run check
pnpm test
pnpm exec tsx scripts/verify-sandbox-db.ts
pnpm run build
```

O verificador cria um usuário temporário, conclui uma compra, cria e confirma um resgate, valida idempotência, confere a redução do saldo disponível, fecha o período contábil e remove todos os dados temporários.

## References

[1]: ./plano-seguranca-producao-rendebit-2026-09-08.md "Plano de segurança para produção da RendeBit"
[2]: ./stacks-testnet-contracts.md "Integração sBTC/stBTC — Stacks testnet"
[3]: ./fullstack-sandbox-runbook.md "Arquitetura e runbook do sandbox financeiro"
