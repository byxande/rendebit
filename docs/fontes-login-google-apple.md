# Fontes e estado do login Google/Apple

**Data de validação:** 08/09/2026.

A página oficial de entrada do Manus, disponível em https://manus.im/login, oferece explicitamente as opções **Continue with Google** e **Continue with Apple**. A aplicação RendeBit utiliza o portal OAuth gerenciado em `https://manus.im/app-auth`, com `appId`, `redirectUri`, `state` com nonce e callback em `/api/oauth/callback`.

O callback atual troca o código no servidor, consulta os dados básicos autorizados, persiste `openId`, nome, e-mail e método de login e emite uma sessão HttpOnly. O SDK reconhece as plataformas `REGISTERED_PLATFORM_GOOGLE` e `REGISTERED_PLATFORM_APPLE`, normalizando-as para `google` e `apple`.

Não há conector Google OAuth ou Apple Sign In configurado diretamente no projeto. A implementação deve, portanto, continuar usando o provedor OAuth gerenciado do WebDev, sem armazenar client secrets no frontend e sem criar um segundo callback inseguro.

## Verificação funcional do portal

O fluxo `/app-auth` foi aberto com a configuração pública da RendeBit. Para uma sessão existente, o portal oferece a conta já reconhecida e a ação **Usar outra conta**. Essa ação abre o modo `forceLogin=true`, que exibiu explicitamente **Continuar com Google** e **Continuar com Apple**. Portanto, a RendeBit pode implementar os dois métodos reais usando o portal gerenciado e forçando a tela de escolha quando o usuário seleciona um provedor na aplicação.

O parâmetro experimental `provider=apple` não eliminou a tela intermediária de conta já existente. A implementação não deve depender de redirecionamento direto não documentado; ela deve abrir a tela segura de escolha, registrar o provedor solicitado no `state` protegido por nonce e conferir no callback se o provedor efetivamente usado é Google ou Apple.

## Arquitetura implementada

1. O cliente gera um nonce único, grava-o em cookie `__Host-` com vida de dez minutos e inclui no `state` o callback e o provedor solicitado (`google` ou `apple`).
2. Ao selecionar Google ou Apple, a RendeBit abre o portal gerenciado com `forceLogin=true`, garantindo que a tela de provedores fique visível mesmo quando já existe uma conta Manus reconhecida.
3. O callback compara o nonce em tempo constante, troca o código somente no backend, consulta o usuário e aceita exclusivamente Google ou Apple.
4. Se o método efetivamente usado for diferente do solicitado, a sessão não é emitida. A aplicação retorna uma mensagem amigável para o usuário escolher novamente.
5. Nome, e-mail autorizado, identificador, função e método de login são persistidos. Entradas e saídas passam a gerar eventos em `auth_events`.
6. A sessão utiliza JWT assinado em cookie HttpOnly, Secure e SameSite=None. O token fica vinculado ao `appId` da RendeBit e expira em até 30 dias.
7. O frontend oferece estado conectado, identificação do provedor e logout real, sem armazenar senha ou tokens sociais em `localStorage`.

## Limites atuais

A autenticação social está pronta e usa o portal real. O produto ainda permanece em ambiente sandbox para KYC, Pix, compra, custódia e rendimento. Login não significa aprovação cadastral: as operações financeiras continuam exigindo elegibilidade brasileira e perfil verificado.

## Domínio de callback

O portal recusou a autorização final quando o callback apontava para o domínio temporário `*.manus.computer`, com `invalid redirect_uri`. Esse endereço serve ao preview de desenvolvimento, mas não está na lista estável de callbacks do aplicativo. O teste OAuth completo deve ocorrer no domínio publicado `*.manus.space` associado à RendeBit. A configuração de produção também deverá manter uma lista fechada de origens permitidas, sem curingas amplos.
