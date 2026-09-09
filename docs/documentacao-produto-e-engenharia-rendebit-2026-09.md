# RendeBit — documentação mestre de produto e engenharia

**Versão:** 1.0  
**Data de referência:** 9 de setembro de 2026  
**Responsável pelo documento:** Manus AI  
**Estado do produto:** sandbox/testnet; **NO-GO para dinheiro real, custódia real, mainnet e oferta comercial de rendimento**

> Este documento descreve o produto, a arquitetura, os padrões de engenharia e os critérios de evolução da RendeBit. Ele não constitui parecer jurídico, regulatório, contábil, tributário ou recomendação de investimento.

## 1. Resumo executivo

A **RendeBit** é uma aplicação Brasil-first para permitir que residentes no Brasil acompanhem posições em Bitcoin, movimentem valores em BRL por Pix em ambiente controlado e compreendam uma eventual jornada de conversão para ativos relacionados à rede Stacks. A experiência pública deve ser simples, em português do Brasil, com valores em reais, CPF, conta Pix de mesma titularidade, transparência de cotação e explicação clara dos riscos.

A versão atual é um **sandbox fullstack**. Ela possui autenticação gerenciada, banco MySQL/TiDB com Drizzle, API tRPC, adaptadores de provedores, fluxos Pix demonstrativos, cotações, compras, resgates, ledger, tesouraria, carteira Stacks pública e uma fronteira de liquidez BTCBRL modelada para Binance. O sandbox não compra BTC real, não liquida Pix real, não mantém chaves privadas de clientes, não executa bridge real BTC→sBTC e não transmite operações mainnet.

A decisão de produto para produção é conservadora: a RendeBit deve começar com **parceiro regulado para pagamentos, compra e custódia**, mantendo na aplicação a experiência, a orquestração, a trilha de auditoria, o ledger e a reconciliação. A operação própria de custódia somente poderá ser reavaliada após autorização e enquadramento regulatório, governança, equipe operacional, cofre de chaves, reconciliação independente e conclusão dos gates de segurança.

## 2. Decisões e princípios do produto

| Princípio | Aplicação prática | Regra de bloqueio |
|---|---|---|
| Brasil-first | BRL, Pix, CPF, residência brasileira, titularidade e linguagem pt-BR | Não lançar fluxo sem mensagens, valores e suporte adequados ao Brasil |
| Transparência antes da ação | Mostrar preço indicativo ou firme, spread, taxa, slippage, validade, prazo e risco | Não confirmar operação com cotação expirada ou incompleta |
| Sandbox por padrão | Dados e providers demonstrativos, testnet e sem fundos reais | Nenhuma feature pode sugerir liquidação real por aparência de sucesso |
| Capital de cliente separado | Subledger por cliente, origem/destino explícitos e reconciliação | Divergência ou saldo sem origem comprovada bloqueia o fluxo |
| Falha fechada | Identidade, pagamento, provedor, contrato, destino e ledger precisam estar confirmados | Em caso de dúvida, não creditar, não assinar, não pagar |
| Autocustódia não é custódia da RendeBit | O app pode registrar endereço público, sem receber seed phrase ou chave privada | Nunca solicitar chave privada, seed phrase ou senha de carteira |
| Rendimento não é garantia | Qualquer referência a `~3% a.a.` deve ser estimativa, cenário ou referência de protocolo | Proibir linguagem de capital garantido, juro fixo ou retorno certo |
| Simplicidade sem ocultação material | A mecânica técnica pode ficar em “Como funciona”, mas riscos, taxas e natureza da posição devem ser visíveis | Não esconder informação que altere decisão financeira |

A Lei nº 14.478/2022 alcança serviços relacionados a ativos virtuais, incluindo troca e custódia em determinadas estruturas, e o Decreto nº 11.563/2023 atribui ao Banco Central competência regulatória e supervisora sobre PSAVs. O enquadramento concreto da RendeBit e de seus parceiros precisa ser documentado antes de qualquer operação real.[1] [2]

## 3. Escopo e não escopo

### 3.1 Dentro do escopo

A primeira versão do produto contempla cadastro e autenticação social gerenciada, elegibilidade para residentes no Brasil, perfil com dados minimizados, depósitos Pix demonstrativos, compra de BTC por BRL preparada para Pix/cartão, cotação BTC/BRL, histórico de mercado, simulador de cenários, posições e rendimento estimado, resgate Pix demonstrativo, recibo PDF, notificações de confirmação, carteira Stacks pública, área operacional e soluções B2B/white-label.

### 3.2 Fora do escopo atual

A versão atual não oferece conta bancária, saldo de pagamento regulado, custódia real de BTC, garantia de retorno, seguro ou proteção do FGC. Ela não habilita saques Binance, não guarda chaves privadas de clientes, não executa bridge real BTC→sBTC, não opera stBTC mainnet e não substitui KYC documental, PLD/FT, contabilidade ou aconselhamento profissional.

## 4. Personas e necessidades

| Persona | Objetivo | Medo ou barreira | Resposta de produto |
|---|---|---|---|
| **Iniciante brasileira** | Comprar BTC sem entender a infraestrutura | Medo de carteira, golpe, taxa escondida e erro irreversível | Jornada guiada, Pix, BRL, explicação contextual e confirmação antes de agir |
| **Pessoa investidora** | Acompanhar posição e cenários de longo prazo | Confundir projeção com promessa | Histórico, cotação com horário, cenários separados e aviso de volatilidade |
| **Pessoa que resgata** | Converter posição em reais | Não saber prazo, líquido ou titularidade aceita | Cotação de resgate, saldo reservado, status persistente e recibo |
| **Cliente autocustodial** | Informar uma carteira Stacks própria | Expor seed ou enviar para rede errada | Apenas endereço público, validação de rede e explicação de limites |
| **Operador de tesouraria** | Reconciliar caixa, provedores, ledger e blockchain | Aprovar ou corrigir sem trilha | Dupla aprovação, estados, chaves idempotentes e reconciliação |
| **Empresa Private/corporativa** | Oferecer patrimônio e tesouraria em BTC para clientes | Risco operacional, regulatório e de marca | Fluxo B2B separado, limites, relatórios e contratação por etapas |
| **Parceiro white-label** | Incorporar a experiência RendeBit | Integração, segurança, marca e responsabilidade | API versionada, RACI, sandbox, documentação e controles por organização |

## 5. Histórias de usuário e critérios de aceite

Os critérios abaixo usam uma forma simplificada de Gherkin. Cada história só é considerada pronta quando os cenários positivos, negativos, de retry e de acessibilidade forem cobertos.

### US-01 — Autenticação social segura

**Como** pessoa residente no Brasil, **quero** entrar com Google/Gmail ou Apple, **para** não criar mais uma senha.

**Critérios de aceite:**

- **Dado** que estou na tela de acesso, **quando** escolho Google ou Apple, **então** o fluxo usa o portal OAuth gerenciado, `state` e `nonce` de uso único, redirect URI compatível e sessão segura.
- **Dado** que o callback recebe state inválido, expirado ou reutilizado, **quando** o backend processa o retorno, **então** a sessão não é criada e o evento é registrado sem expor detalhes sensíveis.
- **Dado** que a autenticação falha, **quando** volto à aplicação, **então** vejo mensagem em pt-BR, foco visível e próximo passo sem revelar token ou causa interna.
- **Dado** que a pessoa encerra a sessão, **quando** seleciona sair, **então** o cookie é revogado e o evento de logout é auditado.

**Padrão adicional para produção:** Authorization Code + PKCE S256, validação de issuer/audience, sessões curtas e revogáveis, MFA/passkey ou step-up para ações financeiras. OAuth 2.1 ainda é draft; a base técnica deve acompanhar a RFC 9700 e a RFC 7636.[9] [10]

### US-02 — Elegibilidade brasileira

**Como** residente no Brasil, **quero** informar apenas os dados necessários, **para** saber se posso usar o serviço.

**Critérios de aceite:**

- **Dado** que estou no onboarding, **quando** informo nome, CPF mascarado, residência e titularidade Pix, **então** cada finalidade e compartilhamento é explicado antes da confirmação.
- **Dado** que o país não é Brasil ou que a conta Pix não é de mesma titularidade, **quando** tento avançar, **então** a operação é bloqueada com explicação simples.
- **Dado** que o perfil é rejeitado, **quando** consulto o estado, **então** vejo o motivo em categoria segura e o canal de suporte, sem revelar regra antifraude.
- **Dado** que uma finalidade opcional de tratamento é recusada, **quando** confirmo o cadastro, **então** o fluxo essencial não usa consentimento genérico como substituto.

### US-03 — Criar depósito Pix

**Como** cliente brasileiro, **quero** gerar uma cobrança Pix, **para** adicionar BRL ao ambiente da RendeBit.

**Critérios de aceite:**

- **Dado** que sou elegível, **quando** informo um valor válido, **então** vejo valor, identificação do ambiente, validade, beneficiário conforme o provider, QR Code e Pix Copia e Cola.
- **Dado** que a cobrança está aguardando pagamento, **quando** recarrego a tela, **então** o estado persistido continua visível e o botão não cria outra cobrança sem idempotência.
- **Dado** que a cobrança expira, **quando** tento confirmar, **então** o backend rejeita a liquidação e oferece nova cobrança.
- **Dado** que o status vem de webhook, **quando** o evento é duplicado ou chega fora de ordem, **então** o efeito financeiro ocorre uma única vez e estados já liquidados não retrocedem.
- **Dado** que o pagamento é confirmado, **quando** o ledger é atualizado, **então** a interface mostra um aviso persistente de “Pix confirmado pelo webhook” e não depende somente de toast.

O comprovante visual não é prova suficiente de liquidação. Em produção, a RendeBit deve consultar o estado autoritativo do PSP, validar valor, moeda, pagador, titularidade, `endToEndId`, timestamp, assinatura e regras antifraude/MED.[18]

### US-04 — Comprar BTC com cotação transparente

**Como** cliente, **quero** comprar BTC usando BRL, **para** acompanhar a posição sem operar uma exchange diretamente.

**Critérios de aceite:**

- **Dado** que tenho uma cotação ativa, **quando** abro a confirmação, **então** vejo valor em BRL, preço de referência, preço de execução ou indicação de que é indicativo, spread, taxa, BTC estimado, validade e riscos.
- **Dado** que a cotação expirou, **quando** tento confirmar, **então** o backend não executa e solicita nova cotação.
- **Dado** que a confirmação foi enviada duas vezes, **quando** o backend recebe a mesma chave de idempotência, **então** o resultado é reaproveitado sem duplicar pagamento, compra, liquidez ou ledger.
- **Dado** que a liquidez Binance real não está explicitamente habilitada, **quando** uma compra é iniciada, **então** permanece em sandbox ou é bloqueada; não há ordem real implícita.

### US-05 — Acompanhar rendimento estimado

**Como** cliente iniciante, **quero** ver a evolução do meu patrimônio em reais, **para** entender a jornada.

**Critérios de aceite:**

- **Dado** que visualizo a posição, **quando** vejo `~3% a.a.`, **então** o texto identifica a natureza estimada ou referencial, a data, a fonte e o risco de variação.
- **Dado** que altero o prazo no simulador, **quando** comparo cenários, **então** o sistema separa dinheiro aportado, efeito de cotação e rendimento estimado.
- **Dado** que a cotação está atrasada ou indisponível, **quando** abro o painel, **então** a interface informa horário, fonte e estado do último valor conhecido.
- **Dado** que o cliente interpreta o retorno como garantia, **quando** consulta ajuda ou confirmação, **então** há texto explícito de que não é juro fixo nem retorno garantido.

### US-06 — Cadastrar carteira Stacks pública

**Como** cliente que possui carteira Stacks, **quero** informar meu endereço público, **para** vincular a posição à trilha on-chain.

**Critérios de aceite:**

- **Dado** que estou na área Segurança, **quando** informo endereço, rede e apelido, **então** o backend valida o formato e a rede selecionada.
- **Dado** que informo seed phrase, chave privada ou senha em qualquer campo, **quando** envio o formulário, **então** a aplicação rejeita o campo e orienta a nunca compartilhar esses dados.
- **Dado** que cadastro uma carteira testnet válida, **quando** salvo, **então** ela fica persistida como referência pública e pode ser usada para reconciliação.
- **Dado** que não existe carteira testnet, **quando** uma saga de liquidez é criada, **então** ela fica bloqueada e não transmite nenhuma transação.

A implementação atual vincula o endereço público aos eventos de liquidação, mas o provider Stacks testnet ainda usa signer operacional e não apresenta o endereço do cliente como destino de transferência. Um crédito individualizado exigirá contrato e política de custódia próprios.

### US-07 — Resgatar via Pix

**Como** cliente com saldo elegível, **quero** resgatar em reais para minha conta Pix, **para** ter previsibilidade sobre o valor líquido.

**Critérios de aceite:**

- **Dado** que solicito resgate, **quando** recebo a cotação, **então** vejo bruto, taxas, líquido, prazo, conta mascarada, titularidade e validade.
- **Dado** que a cotação expirou, **quando** confirmo, **então** o backend bloqueia o resgate e exige nova cotação.
- **Dado** que o saldo é reservado, **quando** uma etapa posterior falha, **então** a reserva é revertida ou encaminhada para revisão manual com lançamento compensatório.
- **Dado** que o Pix foi liquidado, **quando** consulto o histórico, **então** vejo status, referência, valor e recibo demonstrativo em PDF.

### US-08 — Operar tesouraria com dupla aprovação

**Como** operador autorizado, **quero** propor um sweep de lucro, **para** não misturar receita da organização com patrimônio de clientes.

**Critérios de aceite:**

- **Dado** que existe fechamento de período, **quando** proponho um sweep, **então** a origem é exclusivamente `organization_distributable_profit_brl` após custos, tributos e reserva.
- **Dado** que o primeiro administrador aprova, **quando** a aprovação é persistida, **então** o sweep permanece pendente.
- **Dado** que o mesmo administrador tenta aprovar novamente, **quando** o backend valida a segunda aprovação, **então** a ação é rejeitada.
- **Dado** que outro administrador aprova dentro da validade da RFQ, **quando** a execução sandbox ocorre, **então** são criados lançamentos correlacionados e auditáveis.
- **Dado** que a cotação expirou ou a reconciliação apresenta divergência, **quando** há tentativa de aprovação, **então** o sweep é bloqueado.

### US-09 — Reconciliação diária

**Como** responsável de operações, **quero** comparar PSP, liquidez, blockchain e ledger, **para** detectar divergências antes de ampliar a operação.

**Critérios de aceite:**

- **Dado** que o job diário é executado duas vezes para a mesma organização e data, **quando** o backend processa o pedido, **então** existe somente uma reconciliação idempotente.
- **Dado** que um saldo ou evento não fecha, **quando** a reconciliação termina, **então** o estado é divergente e novas operações relacionadas são bloqueadas.
- **Dado** que a reconciliação fecha sem diferença, **quando** consulto o painel, **então** vejo fontes, horário, quantidade de itens e responsável pelo processamento.

### US-10 — Soluções para empresas e white-label

**Como** parceiro corporativo, **quero** oferecer a experiência RendeBit com minha marca, **para** atender clientes Private sem construir toda a infraestrutura.

**Critérios de aceite:**

- **Dado** que sou empresa interessada, **quando** seleciono Private, Corporativo ou White-label, **então** vejo escopo, responsabilidades, limites e roadmap de integração.
- **Dado** que envio o formulário comercial, **quando** o ambiente ainda não possui CRM conectado, **então** recebo mensagem clara de que o formulário é demonstrativo e não promete envio real.
- **Dado** que uma empresa usa white-label, **quando** acessa recursos, **então** o sistema separa organização, usuários administradores, marca, dados, limites e contas do ledger.
- **Dado** que uma operação B2B não possui contrato, RACI e due diligence, **quando** tenta ativar produção, **então** permanece em sandbox.

## 6. Requisitos funcionais

| ID | Requisito | Prioridade | Estado em 09/09/2026 |
|---|---|---:|---|
| RF-01 | Autenticação social Google/Apple com sessão protegida | P0 | Parcialmente implementado em sandbox |
| RF-02 | Onboarding Brasil-first com CPF mascarado e titularidade Pix | P0 | Sandbox |
| RF-03 | Depósito Pix com QR, Copia e Cola, expiração e idempotência | P0 | Demonstrativo |
| RF-04 | Compra BRL→BTC com cotação, taxa, spread e validade | P0 | Sandbox |
| RF-05 | Liquidez BTCBRL institucional modelada para Binance | P0 | Provider sandbox; real bloqueado |
| RF-06 | Registro de carteira Stacks pública por cliente | P0 | Implementado para referência pública |
| RF-07 | Conversão BTC→sBTC | P0 | Simulada no sandbox; testnet bloqueada sem bridge/issuer verificável |
| RF-08 | Aplicação sBTC→stBTC | P0 | Testnet com gates; sem mainnet |
| RF-09 | Resgate Pix | P0 | Sandbox |
| RF-10 | Ledger, eventos e reconciliação | P0 | Implementado em sandbox; dupla entrada de produção pendente |
| RF-11 | Dupla aprovação de tesouraria | P0 | Sandbox |
| RF-12 | White-label multiempresa com `organizationId` | P1 | Experiência visual; backend multiempresa pendente |
| RF-13 | Relatório fiscal exportável | P1 | Jornada preparada; validação fiscal pendente |
| RF-14 | CRM comercial B2B | P2 | Formulário demonstrativo |

## 7. Requisitos não funcionais e padrões atuais

### 7.1 Segurança de aplicação

A baseline recomendada é **OWASP ASVS 5.0.0**, com rigor equivalente ao nível 2 para a aplicação e controles mais fortes nos fluxos de dinheiro, custódia e tesouraria. A RendeBit também deve mapear a **OWASP API Security Top 10:2023**, especialmente BOLA, BFLA, autorização por propriedade, consumo inseguro de APIs, SSRF e abuso de recursos.[7] [8]

O SDLC deve seguir práticas do **NIST SSDF 1.1** e a gestão de risco deve ser organizada pelo **NIST CSF 2.0**, com as funções Govern, Identify, Protect, Detect, Respond e Recover.[11] [12] A adoção desses frameworks não permite declarar certificação ou conformidade sem auditoria e evidência independente.

Os requisitos mínimos para produção são:

| Domínio | Requisito mínimo |
|---|---|
| Identidade | Authorization Code + PKCE S256, issuer/audience validados, sessão curta, revogação, MFA/passkey ou step-up para operações críticas |
| Autorização | Deny-by-default, RBAC + ABAC, ownership por usuário/organização, testes negativos contra BOLA/BFLA/BOPLA |
| Segredos | Cofre/KMS; HSM/MPC para chaves de assinatura; rotação, revogação, menor privilégio e dupla aprovação |
| APIs | Limite de body, rate limit, timeout, circuit breaker, CORS/CSP/HSTS explícitos, proteção SSRF e inventário versionado |
| Webhooks | Verificação criptográfica antes de persistir efeitos, timestamp/replay defense, deduplicação durável e retry/outbox |
| Supply chain | SAST, SCA, secret scan, SBOM, artefato assinado, provenance, atualização de dependências e rollback |
| Incidentes | Playbook, kill switch, preservação de evidências, MTTD/MTTR, comunicação, restauração e reconciliação pós-incidente |

### 7.2 API, eventos e contratos

A API tRPC é o contrato interno atual. Para integrações HTTP externas, a recomendação é publicar `/api/v1` com **OpenAPI 3.1.1**, incluindo esquemas, autenticação, headers, webhooks e exemplos.[13] O contrato não deve chamar tRPC de REST sem uma decisão explícita de produto.

Erros HTTP externos devem usar `application/problem+json` conforme **RFC 9457**, com `type`, `title`, `status`, `detail`, `instance` e `correlationId`. Stack trace, SQL, tokens e dados pessoais nunca devem aparecer em produção.[14]

Operações mutáveis devem adotar um contrato canônico de `Idempotency-Key`. O draft IETF sobre o header recomenda unicidade, fingerprint opcional, expiração publicada, replay da resposta concluída, conflito durante processamento e rejeição de reuso com payload diferente.[15] O código atual possui chaves idempotentes distribuídas em entidades financeiras, mas ainda precisa de uma camada central com escopo, hash, estado, TTL e replay testável.

Webhooks de parceiros devem manter a assinatura específica do provedor. O padrão Standard Webhooks é uma referência útil para `webhook-id`, timestamp, assinatura do corpo bruto, rotação de segredos e deduplicação, mas não substitui o contrato de headers do Mercado Pago ou de outro PSP.[16]

### 7.3 Observabilidade e SLOs

A instrumentação recomendada é **OpenTelemetry para Node.js**, inicializada antes do carregamento do Express, com traces, métricas e logs correlacionados por `traceId`, `spanId`, `requestId` e `correlationId`.[17]

As metas abaixo são propostas iniciais de engenharia, não compromissos comerciais. Produto, operações e risco devem validá-las com os contratos dos parceiros.

| SLI | Meta inicial proposta | Alerta |
|---|---:|---|
| Disponibilidade de leituras | 99,9% mensal | Janela de 5 min abaixo do objetivo |
| Disponibilidade de mutações financeiras | 99,5% mensal | Erros 5xx ou timeout acima do limite |
| Latência de leitura | p95 < 500 ms | Duas janelas consecutivas acima da meta |
| Aceite de webhook | p95 < 1 s após recebimento | Fila ou ack acima da janela do PSP |
| Reconciliação | 100% da janela diária processada | Job ausente, atrasado ou divergente |
| Divergência monetária | Zero diferença não explicada | Bloqueio automático do fluxo relacionado |
| Restauração | RPO ≤ 5 min; RTO do ledger ≤ 1 h | Exercício de restore falho |

A operação deve acompanhar error budget. Quando o orçamento for consumido, novas mudanças de risco devem ser pausadas até a causa ser corrigida ou formalmente aceita.

### 7.4 Banco, ledger e migrações

O modelo financeiro de produção deve ser de partidas dobradas, append-only, com `journalBatchId`, ativo, débito, crédito, origem, destino, usuário, organização, provedor e evidência. Correções devem ocorrer por reversão compensatória, nunca por edição destrutiva do lançamento original.

As migrações devem seguir o fluxo `schema → drizzle-kit generate → revisão do SQL → aplicação controlada`. O script atual chamado `db:push` executa geração e migração; para produção deve haver comandos separados e artefatos imutáveis aprovados em revisão. Migrações incompatíveis devem usar estratégia expand-contract, backup, lock observado e plano de rollback.[18]

### 7.5 Acessibilidade, linguagem e confiança

O frontend deve adotar **WCAG 2.2 nível AA** como baseline, com referência complementar ao eMAG 3.1 e aos princípios brasileiros de desenho universal.[19] [20] Campos devem ter labels visíveis, instruções, `autocomplete`, `aria-invalid`, mensagens inline e foco no primeiro erro. Operações financeiras devem permitir revisão, correção ou reversão antes da conclusão.[21]

Estados como “Pix aguardando pagamento”, “em análise”, “confirmado”, “processando”, “liquidado”, “rejeitado” e “estornado” devem existir em texto persistente e em região acessível. Toast é complemento, nunca a única forma de comunicar estado crítico.[22]

A linguagem deve usar frases curtas, voz ativa, valores em BRL e termos técnicos explicados no contexto. O produto deve distinguir **saldo simulado**, **posição contratual**, **BTC custodiado**, **BTC on-chain** e **saldo em carteira própria**. Não usar cor isoladamente para indicar risco ou estado.

## 8. Arquitetura atual

### 8.1 Stack

| Camada | Tecnologia atual |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind 4, CSS customizado, React Query, wouter, Radix/shadcn |
| Backend | Node.js, Express 4, tRPC 11, TypeScript |
| Dados | MySQL/TiDB, Drizzle ORM/Kit, migrações SQL versionadas |
| Auth | Manus OAuth gerenciado, Google/Apple, cookie de sessão HttpOnly |
| Blockchain | `@stacks/connect`, `@stacks/transactions`, C32, Stacks testnet com gates |
| Testes | Vitest, testes unitários de finanças, providers, orquestradores e banco |
| Operação | Painel `/operacao`, reconciliação diária sandbox, tesouraria com dupla aprovação |

A composição atual do `appRouter` contém `auth`, `integrations`, `wallets`, `market`, `onboarding`, `pixDeposits`, `purchases`, `redemptions` e `treasury`. As rotas de carteira pública expõem `wallets.list`, `wallets.save` e `wallets.settlements`, protegidas por sessão.

### 8.2 Fluxo de compra atual

```text
Onboarding elegível
        ↓
Cotação BRL/BTC com validade e idempotência
        ↓
Checkout Pix/cartão no provider sandbox ou Mercado Pago preparado
        ↓
Pagamento aprovado e evento deduplicado
        ↓
Liquidez BTCBRL sandbox; Binance real bloqueada por gate
        ↓
BTC → sBTC sandbox; bridge testnet bloqueada sem issuer verificável
        ↓
sBTC → stBTC sandbox/testnet com preflight e slippage
        ↓
Ledger, eventos e estado da compra
        ↓
Reconciliação
```

### 8.3 Fronteira Binance e Stacks

A Binance é modelada somente como fonte institucional de liquidez Spot BTCBRL. O código deve manter API Key sem permissão de saque, allowlist de IP, escopo mínimo e confirmação por User Data Stream e REST antes da produção. A carteira pública do cliente é persistida separadamente e não contém segredo.

O estado atual registra a saga em `btc_liquidity_settlements`, incluindo compra, usuário, carteira pública, provider, rede, status, ordem externa, txid, bloqueador e chave de idempotência. Sem carteira testnet pública, a saga fica bloqueada. O provider Stacks atual ainda não trata o endereço do cliente como destino de transferência; portanto, não se deve comunicar crédito direto na carteira até existir contrato individualizado e política de custódia.

### 8.4 Domínio e entidades principais

| Entidade | Responsabilidade |
|---|---|
| `users` | Identidade de aplicação e papel `user/admin` |
| `auth_events` | Auditoria de login/logout por provedor social |
| `customer_profiles` | Perfil Brasil-first, CPF mascarado, Pix e verificação |
| `customer_wallets` | Endereço público Stacks, rede, apelido e status |
| `purchase_quotes` | Cotação, spread, taxa, BTC estimado, validade e chave |
| `purchases` | Compra, pagamento, status, valor e estratégia |
| `pix_deposits` | Cobrança Pix, QR, Copia e Cola, expiração e end-to-end ID |
| `redemption_quotes` / `redemptions` | Cotação e saga de resgate Pix |
| `btc_liquidity_settlements` | Liquidez BTCBRL e próxima etapa Stacks |
| `provider_events` | Webhooks/eventos externos e deduplicação |
| `ledger_entries` | Trilha financeira atual, ainda a evoluir para dupla entrada completa |
| `treasury_settings` | Política de tesouraria, rede, carteira e parceiro |
| `profit_capital_sweeps` | Sweep de lucro organizacional para conta dedicada |
| `profit_sweep_approvals` | Dupla aprovação administrativa |
| `daily_reconciliations` | Reconciliação idempotente diária |

## 9. Privacidade, compliance e responsabilidades

O produto deve manter um inventário de dados com finalidade, base legal, retenção, operador, compartilhamento e transferência internacional. CPF, dados Pix, posição financeira, autenticação, endereço de carteira e histórico de transação devem ser minimizados, criptografados, mascarados em logs e acessíveis somente por necessidade operacional. A LGPD exige finalidade, necessidade, transparência, segurança, prevenção e responsabilização.[3]

A RendeBit precisa definir formalmente controlador, operadores, encarregado, contratos de tratamento, canal de direitos dos titulares, política de retenção e critérios para RIPD/DPIA. Incidentes envolvendo dados financeiros ou de autenticação devem seguir playbook compatível com a Resolução CD/ANPD nº 15/2024, inclusive análise de risco e comunicação nos prazos aplicáveis.[4] [5]

O produto também deve decidir, com assessoria brasileira, se e como se aplica a legislação de PSAV, Pix, PLD/FT, regras da CVM e obrigações da Receita Federal. A DeCripto e os atos relacionados à IN RFB nº 1.888/2019 devem ser mapeados ao papel concreto da empresa e dos parceiros. Não prometer ao usuário “relatório fiscal completo” antes de validar o leiaute, a responsabilidade e a revisão contábil.[6]

### Claims proibidos sem evidência formal

- “Capital garantido”, “juro fixo” ou “rendimento certo”.
- “Regulado pelo Banco Central” sem autorização e escopo aplicável.
- “Protegido pelo FGC” ou “segurado” sem produto e contrato que sustentem a afirmação.
- “Custódia segregada”, “prova de reservas” ou “patrimônio separado” sem evidência contábil, contratual e operacional.
- “Saque imediato” sem prazo, liquidez, limites e dependências claramente definidos.
- “Seu BTC está na sua carteira” quando o modelo real é custódia de terceiro, saldo contratual ou posição simulada.

## 10. Segurança operacional e resposta a incidentes

A defesa deve ser em profundidade. O threat model deve cobrir takeover de conta, fraude Pix, webhook forjado, replay, abuso de idempotência, insider, comprometimento de secret, erro de rede, contrato malicioso, oracle desatualizado, reorg, divergência de ledger, indisponibilidade de parceiro e vazamento de dados.

O fluxo de incidentes deve incluir detecção, classificação, preservação de evidência, contenção, kill switch por fluxo/provedor/rede, rotação de credenciais, comunicação, restauração, reconciliação e lições aprendidas. O NIST SP 800-61 Rev. 3 é a referência recomendada para organizar resposta e recuperação.[23]

| Incidente | Primeira ação | Evidência obrigatória | Critério de retorno |
|---|---|---|---|
| Webhook inválido | Rejeitar e não creditar | Corpo bruto, headers, assinatura e correlação | Verificação de origem e replay concluída |
| Pix divergente | Congelar compra/resgate | End-to-end ID, valor, status PSP e ledger | Reconciliação sem diferença |
| Chave comprometida | Kill switch e revogação | Logs de acesso, txids e policy decision | Chave substituída e auditoria concluída |
| Conta tomada | Revogar sessão e step-up | Eventos auth, IP/device, alterações | Identidade recuperada e risco revisado |
| Ledger divergente | Pausar fluxo relacionado | Journal, provider, blockchain e banco | Ajuste compensatório aprovado |
| Contrato Stacks suspeito | Bloquear assinatura/broadcast | ABI, hash, principal, args e policy | Contrato revisado e aprovado |

## 11. Definition of Ready

Uma história está pronta para desenvolvimento quando possui objetivo de usuário, regra de negócio, critério de aceite positivo e negativo, estados de loading/sucesso/erro/expiração, impacto de dados, autorização, idempotência, evento de auditoria, risco de privacidade, comportamento acessível, dependências externas e estratégia de rollback.

Para histórias financeiras, também são obrigatórios fonte autoritativa do saldo/status, moeda e unidade, cotação e validade, titularidade, reconciliação, fluxo de compensação, responsável operacional e decisão de ambiente sandbox/testnet/produção.

## 12. Definition of Done

Uma história só entra em release quando:

1. O comportamento foi implementado em frontend, backend, schema e migrations quando aplicável.
2. Os critérios Gherkin passaram em testes unitários e de integração adequados.
3. A autorização negativa foi testada para usuário, organização, papel, propriedade e estado.
4. Retries, duplicatas, payload divergente, timeout, expiração e restart foram considerados.
5. Não existem segredos, chaves privadas, CPF bruto ou tokens em código, logs, fixtures ou artefatos.
6. O fluxo foi validado por teclado, zoom de 200%, mobile, leitor de tela ou ferramenta equivalente.
7. A mensagem em pt-BR explica valor, status, risco, próximo passo e ambiente.
8. Observabilidade, correlação, métricas, alertas e runbook estão definidos.
9. Migração SQL foi gerada, revisada, aplicada no ambiente correto e verificada.
10. `pnpm run check`, `pnpm test`, `pnpm run build` e verificador de banco passaram.
11. O checkpoint foi salvo e a revisão de segurança, produto e compliance está registrada.

## 13. Matriz de riscos

| Risco | Probabilidade atual | Impacto | Mitigação | Dono |
|---|---:|---:|---|---|
| Enquadramento regulatório incorreto | Alta | Crítico | Parecer independente, parceiro autorizado e gate G0 | Jurídico/compliance |
| Crédito Pix antes da liquidação | Média | Crítico | Consulta autoritativa, assinatura, idempotência e reconciliação | Pagamentos |
| Mistura de capital de cliente e organização | Média | Crítico | Subledger, dupla entrada, contas segregadas e reconciliação | Financeiro/ops |
| Chave de assinatura exposta | Média | Crítico | HSM/MPC, chave não exportável, dupla aprovação | Segurança |
| Webhook forjado ou replay | Média | Alto | Verificação criptográfica, timestamp, deduplicação e outbox | Backend |
| Erro de rede/contrato Stacks | Média | Alto | Allowlist, ABI, post-condition, slippage, testnet e kill switch | Blockchain |
| Conta social comprometida | Média | Alto | Sessão curta, MFA/passkey, step-up, revogação e device risk | IAM |
| Comunicação de retorno enganosa | Média | Alto | Revisão consumerista, disclosures e testes de compreensão | Produto/jurídico |
| Perda ou vazamento de dados | Média | Crítico | LGPD, minimização, criptografia, redaction, backup e IR | Privacidade/segurança |
| Dependência de parceiro | Alta | Alto | SLA, fallback, circuit breaker, reconciliação e plano de saída | Operações |

## 14. Roadmap recomendado

### Fase 0 — Congelamento e decisões

Manter sandbox/testnet. Aprovar modelo societário, perímetro regulatório, parceiro de Pix, parceiro de compra/custódia, natureza jurídica de BTC/sBTC/stBTC, termos de risco e política de dados. Remover ou rotular claims não comprovados.

### Fase 1 — Fundamentos de produção

Migrar para ledger de dupla entrada e journal batches; criar idempotência central; corrigir verificação real de assinatura de webhook; adicionar sessões revogáveis, step-up, ABAC, rate limiting, CSP/HSTS, secret management e redaction. Publicar OpenAPI 3.1.1 para HTTP externo, Problem Details e política de versionamento.

### Fase 2 — Segurança e resiliência

Adicionar SAST, SCA, secret scan, SBOM, artefatos assinados, OpenTelemetry, SLOs, SIEM, backups imutáveis, restore testado, runbooks, tabletop e pentest independente com reteste.

### Fase 3 — Homologação de parceiros

Integrar Pix, KYC, PLD/FT, liquidez e custódia em homologação. Testar duplicidade, replay, timeout, estorno, MED, chargeback, ordem parcial, indisponibilidade, reorg, contrato pausado, slippage e divergência.

### Fase 4 — Piloto limitado

Habilitar somente depois dos gates G0–G10, com limites baixos, poucos clientes, canary, allowlist, monitoramento reforçado, revisão manual e reconciliação independente. Qualquer incidente crítico ou divergência pausa o piloto.

### Fase 5 — White-label multiempresa

Adicionar `organizationId`, isolamento de dados, administradores por organização, contas de ledger próprias, branding versionado, quotas, API keys por cliente, webhooks por tenant, RACI, auditoria e controles de subcustódia. A experiência white-label atual é visual e demonstrativa; não é ainda uma plataforma multiempresa pronta para produção.

## 15. Checklist de go-live

| Gate | Evidência necessária | Resultado sem evidência |
|---|---|---|
| G0 Regulação | Parecer independente, entidade, parceiro e autorização aplicável | NO-GO |
| G1 Produto | Classificação de BTC/sBTC/stBTC e claims aprovados | Não publicar |
| G2 Parceiros | Due diligence, contrato, RACI, SLA e saída | Não conectar |
| G3 Identidade | PKCE, sessão revogável, MFA/passkey e autorização por objeto | NO-GO |
| G4 Pix | PSP autoritativo, webhook verificado, MED, titularidade e reconciliação | Não creditar |
| G5 Ledger | Partidas dobradas, append-only, journals balanceados | Pausar fluxo |
| G6 Custódia | HSM/MPC, dual control, limites, rotação e recuperação | NO-GO |
| G7 Blockchain | Contratos, ABI, hash, rede, post-conditions e reorg | Não assinar |
| G8 AppSec | ASVS, API Top 10, SAST, DAST, SCA, secret scan e pentest | NO-GO |
| G9 LGPD | Inventário, bases, retenção, direitos, operadores e incidentes | NO-GO |
| G10 Resiliência | Restore, failover, SIEM, on-call e tabletop | Não ampliar |
| G11 Piloto | Limites, canary, reconciliação e rollback | Não abrir público |
| G12 Fiscal | DeCripto/IN aplicável, contador e exportação revisados | Não prometer relatório |

## 16. Glossário mínimo

| Termo | Definição simples |
|---|---|
| BRL | Real brasileiro, a moeda usada na experiência da RendeBit |
| Pix | Sistema de pagamentos instantâneos do Banco Central |
| Cotação indicativa | Referência de preço que pode mudar antes da execução |
| Cotação firme/RFQ | Cotação com validade e condições de execução definidas pelo provedor |
| Slippage | Diferença máxima aceita entre o preço esperado e o executado |
| Idempotência | Repetir a mesma solicitação sem duplicar o efeito financeiro |
| Ledger | Registro contábil de saldos e movimentos |
| Reconciliação | Comparação entre registros da RendeBit, parceiros e blockchain |
| sBTC | Ativo relacionado à representação de BTC na rede Stacks; exige validação de backing e infraestrutura |
| stBTC | Ativo de estratégia distinto de BTC e sBTC; não deve ser apresentado como equivalente automático sem explicação |
| Custódia | Guarda ou controle de ativos/chaves em nome de outra pessoa |
| Autocustódia | Controle da chave pelo próprio usuário, sem entrega da chave ao serviço |
| PSAV | Prestadora de Serviços de Ativos Virtuais, conforme o enquadramento legal aplicável |
| Step-up | Autenticação adicional exigida antes de uma ação de maior risco |
| SLO | Objetivo mensurável de nível de serviço |
| RTO/RPO | Tempo máximo de recuperação e quantidade máxima de dados que pode ser perdida |

## 17. Referências

[1]: https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14478.htm "Lei nº 14.478/2022 — marco legal dos ativos virtuais"

[2]: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/d11563.htm "Decreto nº 11.563/2023 — competência do Banco Central"

[3]: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm "Lei Geral de Proteção de Dados — LGPD"

[4]: https://www.in.gov.br/en/web/dou/-/resolucao-cd/anpd-n-15-de-24-de-abril-de-2024-556243024 "Resolução CD/ANPD nº 15/2024 — comunicação de incidentes"

[5]: https://www.gov.br/anpd/pt-br/assuntos/comunicacao-de-incidentes-de-seguranca-cis "ANPD — Comunicação de Incidente de Segurança"

[6]: https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/criptoativos/decripto "Receita Federal — DeCripto"

[7]: https://owasp.org/www-project-application-security-verification-standard/ "OWASP Application Security Verification Standard 5.0.0"

[8]: https://owasp.org/API-Security/editions/2023/en/0x00-header/ "OWASP API Security Top 10 2023"

[9]: https://www.rfc-editor.org/rfc/rfc9700.html "RFC 9700 — OAuth 2.0 Security Best Current Practice"

[10]: https://datatracker.ietf.org/doc/html/rfc7636 "RFC 7636 — Proof Key for Code Exchange by OAuth Public Clients"

[11]: https://csrc.nist.gov/pubs/sp/800/218/final "NIST SP 800-218 — Secure Software Development Framework 1.1"

[12]: https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.29.pdf "NIST Cybersecurity Framework 2.0"

[13]: https://spec.openapis.org/oas/v3.1.1.html "OpenAPI Specification 3.1.1"

[14]: https://www.rfc-editor.org/rfc/rfc9457.html "RFC 9457 — Problem Details for HTTP APIs"

[15]: https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header "IETF — Idempotency-Key HTTP Header Field"

[16]: https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md "Standard Webhooks — specification"

[17]: https://opentelemetry.io/docs/languages/js/getting-started/nodejs/ "OpenTelemetry — Node.js"

[18]: https://orm.drizzle.team/docs/migrations "Drizzle ORM — Migrations fundamentals"

[19]: https://www.w3.org/TR/WCAG22/ "W3C — Web Content Accessibility Guidelines 2.2"

[20]: https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/acessibilidade-digital/modelo-de-acessibilidade "Governo Digital — eMAG 3.1"

[21]: https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html "W3C — Error Prevention: Legal, Financial, Data"

[22]: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html "W3C — Status Messages"

[23]: https://csrc.nist.gov/pubs/sp/800/61/r3/final "NIST SP 800-61 Rev. 3 — Incident Response"

[24]: https://www.bcb.gov.br/estabilidadefinanceira/pix-seguranca "Banco Central — Segurança no Pix"

[25]: https://www.bcb.gov.br/estabilidadefinanceira/pix-normas "Banco Central — Normas do Pix"

[26]: https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20BCB&numero=520 "Resolução BCB nº 520/2025 — PSAVs"

[27]: https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?tipo=Resolu%C3%A7%C3%A3o%20BCB&numero=519 "Resolução BCB nº 519/2025 — autorização de PSAVs"

[28]: https://www.bcb.gov.br/detalhenoticia/21192/nota "Banco Central — enquadramento prudencial de PSAVs"

[29]: https://www.binance.com/en/academy/articles/integrating-binance-apis-and-libraries "Binance — Integrating Binance APIs and libraries"

[30]: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/trading-endpoints "Binance Spot API — Trading endpoints"

[31]: https://developers.binance.com/docs/binance-spot-api-docs/user-data-stream "Binance Spot API — User data stream"

[32]: https://docs.stacks.co/learn/sbtc "Stacks Documentation — sBTC"

[33]: https://github.com/byxande/rendebit "RendeBit — repositório privado do projeto"

---

## Registro de atualização

| Versão | Data | Alteração |
|---|---|---|
| 1.0 | 09/09/2026 | Documento mestre inicial com produto, histórias de usuário, critérios de aceite, arquitetura atual, padrões de segurança/API/acessibilidade, governança, riscos e gates de produção |

**Nota de manutenção:** toda alteração de parceiro, rede, token, contrato, modelo de custódia, limite financeiro, política de dados ou claim comercial deve reabrir o threat model, revisar as histórias afetadas e atualizar este documento antes do release.
