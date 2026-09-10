# RendeBit — integração operacional com Xverse

**Data:** 10 de setembro de 2026  
**Estado:** integrada em sandbox/testnet, sem broadcast automático e sem custódia de chaves privadas.

## Objetivo

A RendeBit passa a oferecer uma trilha opcional para clientes que usam a Xverse como carteira autocustodial. A aplicação solicita à carteira somente o endereço público Stacks e, quando existir uma transação válida preparada pelo backend, pode solicitar uma assinatura visível ao usuário. Seed phrase, chave privada e senha nunca entram no frontend, no backend ou no banco de dados da RendeBit.

Essa arquitetura é diferente de uma custódia institucional. A Xverse não é utilizada como assinador server-side, como carteira da organização ou como motor autônomo de rendimento. O fluxo automatizado de tesouraria continua separado, protegido por dupla aprovação, reconciliação e providers institucionais configuráveis.

## Fluxos implementados

| Fluxo         | Implementação atual                                                               | Estado do sandbox                                                          |
| ------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Conexão       | `wallet_connect` pelo pacote `sats-connect`, solicitando endereço Stacks testnet  | Disponível mediante aprovação do cliente                                   |
| Cadastro      | Endereço público é salvo em `customer_wallets` e vinculado ao usuário             | Persistido e validado por rede                                             |
| Auditoria     | Registro em `xverse_actions` com tipo, rede, status, carteira e chave idempotente | Disponível para cliente e painel operacional                               |
| Assinatura    | Adaptador `stx_signTransaction` preparado com `broadcast: false` por padrão       | Pronto para uma intenção de transação validada                             |
| Saque Pix     | Continua na saga Pix/PSP da RendeBit; não é uma transferência Xverse              | Sandbox, sem dinheiro real                                                 |
| Troca e yield | Podem receber uma intenção Stacks construída pelo backend e aprovada na carteira  | Bloqueados até contrato, post-conditions e reconciliação serem verificados |

## Frontend

A área **Segurança** mostra apenas um convite simples: **Sua carteira fica com você**. O painel técnico de assinatura não aparece na jornada principal do cliente. Ao tocar em **Como funciona** ou iniciar uma conexão, a pessoa vê um pop-up curto, com linguagem cotidiana e explicação do que será pedido. Quando uma operação real estiver pronta para aprovação, o mesmo padrão de pop-up apresenta o pedido antes de abrir a carteira. A tela não apresenta estados internos como `intent_created`, `signed` ou `submitted` ao cliente.

O adaptador em `client/src/lib/xverse.ts` concentra as chamadas `wallet_connect`, `stx_signTransaction`, `stx_transferStx` e `disconnect`. A função de assinatura não transmite por padrão. A função de transferência existe como capacidade isolada, mas não está conectada a um botão financeiro no sandbox.

### Jornada lúdica de autorização

Para clientes iniciantes, a autorização aparece como uma pequena jornada de três passos, sem jargão técnico desnecessário. O primeiro passo explica que a carteira compartilhará somente o endereço público escolhido pelo cliente. O segundo reforça que qualquer ação que precisar de confirmação será mostrada em uma janelinha clara. O terceiro mostra a proteção permanente: a RendeBit nunca pede senha ou código secreto.

Ao tocar em **Continuar com Xverse**, o adaptador executa `wallet_connect` com a finalidade explícita e solicita somente o endereço Stacks da rede testnet. Segundo a documentação oficial, essa conexão concede permissão de leitura da conta; ela não autoriza assinaturas de transações. A interface também oferece **Revisar permissão**, usando `wallet_requestPermissions`, e **Encerrar autorização de leitura**, usando `wallet_renouncePermissions`. A consulta `wallet_getCurrentPermissions` está disponível no adaptador, mas não é chamada durante o carregamento da página, porque qualquer comunicação com a carteira deve partir de uma intenção visível do cliente.

O texto da interface diferencia três coisas: ler uma referência pública, assinar uma operação específica e transmitir uma transação. A primeira é a autorização atual; a segunda exige aprovação do usuário em cada pedido; e a terceira permanece bloqueada no sandbox. Essa distinção evita a impressão de que conectar a carteira equivale a entregar controle dos ativos.

## Backend e auditoria

A tabela `xverse_actions` registra a conexão e futuras intenções assinadas. O router `wallets.recordXverseConnection` verifica que a carteira pertence ao usuário autenticado antes de registrar o evento. O painel `/operacao` consulta a fila administrativa e mostra, sem expor dados sensíveis, a ação, a rede, o endereço abreviado, o status e o txid quando existir.

A idempotência é aplicada por `idempotencyKey`. O backend não deve considerar um status enviado pelo navegador como prova de liquidação: em produção, `signed`, `submitted` e `confirmed` deverão ser derivados de uma transação construída, validada e reconciliada pelo servidor. A rota protegida `wallets.recordXverseSignature` só aceita um pedido pertencente ao usuário e ainda aguardando confirmação; depois, registra o resultado assinado para a fila de reconciliação. A tabela foi desenhada para suportar essa evolução sem armazenar chaves privadas.

## Saques, trocas e yield

O saque em reais permanece um fluxo de pagamento regulado: cotação, saldo reservado, titularidade, PSP, webhook assinado e reconciliação. A Xverse não substitui o PSP e não deve receber credenciais Pix ou chaves privadas para realizar esse fluxo.

Para troca ou yield em Stacks, a sequência segura é: o backend cria uma intenção com contrato e função permitidos; calcula limites e post-conditions; vincula o endereço público do cliente; registra a intenção como `intent_created`; abre a solicitação de assinatura na Xverse; recebe a transação assinada; valida novamente origem, destino, nonce, rede, valor e post-conditions; e somente depois transmite ou entrega a uma fila de broadcast controlada. O status `confirmed` depende de confirmação on-chain e reconciliação.

No sandbox atual, essa sequência financeira deliberadamente não é ativada. A conexão Xverse e a trilha de auditoria estão prontas, mas não há envio automático, operação com fundos reais ou promessa de rendimento executado por uma carteira pessoal.

## Gates antes de produção

| Gate       | Critério mínimo                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Contratos  | ABI e endereços oficiais verificados para a rede escolhida; testes de integração e replay            |
| Transação  | Post-conditions deny, limites de slippage, nonce, fee e expiração de intenção                        |
| Identidade | KYC, titularidade, carteira pertencente ao cliente e regras de sanções aplicáveis                    |
| Custódia   | Separação explícita entre carteira pública do cliente e carteiras operacionais da RendeBit           |
| Broadcast  | Serviço controlado, idempotente, com allowlist de contratos e reconciliação por txid                 |
| Governança | Dupla aprovação para operações de tesouraria e revisão independente de mudanças de contrato          |
| Jurídico   | Parceiro regulado, modelo de prestação, termos, riscos, LGPD e política de ativos virtuais revisados |

## Testes e validação

O adaptador possui testes para conexão bem-sucedida, preservação de endereço/chave pública, leitura de permissão, solicitação e revogação, assinatura sem broadcast e rejeição pelo usuário. A suíte da aplicação foi executada com **72 testes aprovados**, a checagem TypeScript passou e o build de produção foi gerado com sucesso. A rota de segurança foi validada em desktop e em viewport móvel; a fila operacional Xverse foi validada em desktop.

A integração não deve ser descrita ao cliente como “rendimento automático pela Xverse”. A comunicação correta é: **a Xverse é uma opção autocustodial para conectar a carteira e aprovar transações específicas; a RendeBit não recebe nem controla suas chaves privadas**.

## Fontes oficiais consultadas

As regras de consentimento e os textos da jornada foram alinhados à documentação oficial da Xverse: [permissões da carteira](https://docs.xverse.app/sats-connect/xverse-wallet-permissions), [conexão com `wallet_connect`](https://docs.xverse.app/sats-connect/connecting-to-the-wallet/connect-to-xverse-wallet) e [assinatura `stx_signTransaction`](https://docs.xverse.app/sats-connect/stacks-methods/stx_signtransaction). Essas fontes distinguem permissão de leitura, assinatura de transação e broadcast, e devem ser revisitadas antes de qualquer ativação em produção.
