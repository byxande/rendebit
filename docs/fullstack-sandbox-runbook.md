# Arquitetura e runbook do sandbox financeiro

## Escopo entregue

O projeto foi migrado de uma demonstração puramente frontend para uma aplicação fullstack com autenticação, banco relacional, API tipada, ledger, eventos de provedores e painel administrativo. O ambiente continua sendo um **sandbox**: nenhuma API financeira de produção, chave privada, ordem de compra, Pix ou transação Stacks é executada.

A jornada persiste o perfil com dados mascarados, simula a aprovação de KYC, cria uma cotação com validade e chave idempotente, registra a compra, produz lançamentos de ledger e salva eventos separados para Pix, custódia e ativação da estratégia. Os adaptadores de sandbox implementam contratos substituíveis por provedores reais.

A confirmação agora é orquestrada em sequência: **Pix/checkout aprovado → BTC adquirido pelo custodiante → BTC convertido em sBTC → estratégia Stacks ativada → ledger e compra liquidados**. A conversão é um estágio próprio, com preflight, evento e chave idempotente; no sandbox ela é simulada 1:1, enquanto no testnet permanece bloqueada até existir um bridge/issuer verificável. Se qualquer provedor falhar, a compra é marcada como falha e não aparece como posição ativa.

A Xverse foi classificada como integração opcional de autocustódia. Sua API pode apoiar dados, RPC, portfólio, swaps e transmissão de transações Bitcoin já assinadas; o Sats Connect pode solicitar assinatura Stacks, mas exige aprovação visível do usuário. Ela não é tratada como custodiante nem como assinador server-side para o fluxo automático da RendeBit.

## Controles implementados

| Controle | Implementação atual | Condição para produção |
|---|---|---|
| Autenticação | OAuth e procedimentos protegidos | Revisar política de sessão e recuperação de conta |
| KYC | Adaptador determinístico, dados mascarados e webhook idempotente | Contrato e credenciais de MetaMap, Veriff ou parceiro escolhido; LGPD e retenção |
| Titularidade Pix | Declaração persistida no sandbox | Validação pelo parceiro bancário e comparação de CPF/nome do titular |
| Cotação | Preço de referência sandbox, spread, taxa e expiração | Feed assinado, tolerância de slippage e auditoria de execução |
| Compra e custódia | Evento simulado de compra BTC | Custodiante contratado, contas segregadas e política de reconciliação |
| BTC → sBTC → stBTC | Evento simulado com rota registrada no backend | Bridge sBTC, StackingDAO, limites, liquidez, monitoramento e plano de contingência |
| Ledger | Lançamentos persistentes com chaves idempotentes | Partidas dobradas, reconciliação diária e trilha de auditoria imutável |
| Lucro | Receita realizada menos custos e reservas | Regra contábil/jurídica aprovada e integração com contabilidade |
| Repasse | Somente simulado e sujeito a aprovação administrativa | Cofre de chaves ou multisig; limites; dupla aprovação; observabilidade |

## Política de lucro

O sistema interpreta “todo lucro” como **100% do lucro distribuível**, e não como receita bruta, saldo de clientes ou ativos sob custódia. A fórmula aplicada é:

> Lucro distribuível = receitas realizadas − custos de provedores − provisão tributária − reserva operacional.

A carteira organizacional recebe apenas o ativo configurado — STX, sBTC ou stBTC — após o fechamento do período. A interface solicita somente o endereço público e valida checksum e rede. O sandbox nunca solicita seed phrase, chave privada ou assinatura. Uma ativação real deverá usar um cofre de chaves ou uma carteira multisig e manter aprovação manual como padrão inicial.

## Modelo de dados

| Tabela | Finalidade |
|---|---|
| `customer_profiles` | Perfil, elegibilidade, titularidade Pix e estado do KYC |
| `purchase_quotes` | Cotações, taxas, expiração e idempotência |
| `purchases` | Compras, liquidação e estado da estratégia de rendimento |
| `ledger_entries` | Trilha financeira por cliente e organização |
| `provider_events` | Webhooks simulados e deduplicação |
| `treasury_settings` | Carteira, rede, ativo, frequência, aprovação e reservas |
| `profit_distributions` | Fechamento mensal e repasse simulado, único por período |

## Próxima ativação

A próxima fase deve escolher e contratar os provedores. As credenciais devem entrar apenas em secrets do backend. Depois, cada adaptador em `server/providers` será substituído por um cliente real com autenticação, verificação de assinatura de webhook, retries seguros, circuit breaker e reconciliação. A passagem para produção deve ser bloqueada até existirem revisão jurídica brasileira, definição de VASP/custódia, contratos bancários, políticas LGPD/PLD-FT, runbooks de incidente e testes independentes.

A marca do produto foi atualizada para **RendeBit**. A busca pública inicial não encontrou colisão evidente, mas ainda é obrigatório fazer busca de anterioridade e clearance formal no INPI antes do lançamento.

## Validação reproduzível

Execute `pnpm run check`, `pnpm test`, `pnpm run build` e `pnpm exec tsx scripts/verify-sandbox-db.ts`. O último comando cria dados temporários, confirma idempotência de webhook, compra e fechamento, valida a persistência e remove os registros ao final.
