# Login social e depósitos Pix — sandbox RendeBit

**Data-base:** 8 de setembro de 2026  
**Escopo:** autenticação social via portal OAuth e cobrança Pix simulada com persistência real em banco.

## Autenticação social

A RendeBit agora apresenta entrada por **Google**, incluindo contas Gmail e Google Workspace, e **Apple**. Ambos os caminhos encaminham o usuário ao portal OAuth seguro já integrado ao projeto. A página oficial de entrada do provedor exibe as opções “Continue with Google” e “Continue with Apple” [1].

A aplicação não recebe nem armazena a senha social. O fluxo existente vincula a sessão ao navegador com `state`, nonce de uso único e cookie `__Host-`; o callback fica em `/api/oauth/callback`. A interface informa que o método deve ser confirmado no portal oficial, pois a RendeBit não possui, neste estágio, credenciais OAuth próprias de Google ou Apple.

## Depósito via Pix

O depósito Pix foi implementado como uma saga idempotente. O cliente autenticado e verificado escolhe um valor entre **R$ 10,00 e R$ 1.000.000,00**, gera uma cobrança com validade de 15 minutos, recebe QR Code e Pix Copia e Cola e acompanha o histórico. No sandbox, a confirmação depende de um botão explicitamente identificado como simulação. Nenhum Pix real é iniciado.

| Etapa | Persistência | Controle principal |
|---|---|---|
| Criação | `pix_deposits.status = created` | Chave idempotente global e isolamento por usuário |
| Cobrança | `awaiting_payment` + referência do provedor | Evento `pix.deposit.charge.created` gravado antes de expor o QR Code |
| Confirmação | Evento `pix.deposit.paid` | Chave estável por depósito e bloqueio de cobrança expirada |
| Crédito | `paid` + EndToEndId + `paidAt` | Transação de banco e lançamento único no ledger |
| Saldo | Conta `customer_brl_available` | Separação explícita do caixa operacional da organização |

A API tRPC expõe `pixDeposits.summary`, `pixDeposits.create`, `pixDeposits.simulatePayment` e `pixDeposits.operationalList`. O último procedimento é restrito a administradores e alimenta a conciliação do painel operacional.

## Controles já aplicados

As cobranças, pagamentos, eventos de provedor e lançamentos contábeis usam identificadores idempotentes. O crédito em reais ocorre dentro de uma transação de banco e somente após a confirmação do adaptador Pix. O QR Code é gerado localmente a partir do payload sandbox, sem enviar dados a um gerador externo. O painel administrativo mostra referência da cobrança, EndToEndId, status e lançamento `pix_deposit` no ledger.

## Bloqueios para produção

O adaptador `sandboxPixProvider` não deve ser habilitado em produção. Antes de aceitar dinheiro real, a RendeBit precisa contratar um PSP/BaaS autorizado, guardar credenciais apenas no cofre de secrets, validar assinatura e origem dos webhooks, aplicar mTLS quando exigido, validar titularidade de CPF e conta, reconciliar extrato e EndToEndId, tratar estorno/devolução, implementar limites transacionais e monitoramento antifraude, além de concluir revisão jurídica e regulatória.

Login social próprio com telas totalmente controladas pela marca exigirá projetos OAuth separados, credenciais e redirect URIs de Google e Apple. Até lá, a autenticação permanece delegada ao portal seguro já fornecido pelo ambiente.

## Validação

A suíte possui **31 testes aprovados**, incluindo criação, ordem dos eventos, liquidação e expiração de depósitos. O verificador ponta a ponta cria um usuário temporário, conclui KYC sandbox, gera e paga uma cobrança Pix, confirma saldo BRL, executa compra e resgate, valida ledger e idempotência e remove todos os dados temporários.

[1]: https://manus.im/login "Página oficial de entrada do Manus, com Google e Apple"
