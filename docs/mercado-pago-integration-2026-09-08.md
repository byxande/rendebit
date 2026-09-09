# Integração Mercado Pago — base técnica

**Data-base:** 8 de setembro de 2026.

## Papel correto na arquitetura

O Mercado Pago será usado como **provedor de pagamento em BRL**, oferecendo Pix e cartão. A documentação pública verificada descreve recebimento e processamento de pagamentos, não uma API comercial para comprar BTC em nome da RendeBit. Portanto, a compra de Bitcoin continua sendo uma etapa separada, executada pelo adaptador de custódia/liquidez após o pagamento aprovado. Essa separação evita representar incorretamente a capacidade do Mercado Pago.

## Opções de checkout

O Checkout Transparente via Orders API oferece Pix e cartão dentro do site, com mais controle, mas exige integração de dados de pagamento e cuidados adicionais de PCI/3DS. O Checkout Pro cria uma preferência de pagamento no backend e redireciona para o ambiente hospedado do Mercado Pago; por padrão, a preferência aceita os meios de pagamento disponíveis, e a resposta fornece um identificador que deve ser salvo. Para o MVP, o caminho hospedado é o mais seguro porque reduz a exposição da RendeBit a dados de cartão.

## Controles obrigatórios

O Access Token é privado e deve ser usado somente no backend, enviado no header `Authorization: Bearer`. O Mercado Pago distingue credenciais de teste e produção; as credenciais de teste ficam disponíveis depois da criação de uma aplicação. Pagamentos com cartão exigem `X-Idempotency-Key`. Notificações chegam por webhook HTTPS. A origem deve ser validada usando `x-signature`, `x-request-id`, `data.id` e o segredo da aplicação. Depois de responder com HTTP 200/201, o backend deve consultar o recurso oficial para confirmar o estado, sem confiar somente no payload recebido.

## Estado no repositório

A integração é implementada com adaptador substituível e modo seguro. Sem `MERCADO_PAGO_ACCESS_TOKEN`, nenhuma cobrança real é criada. O sandbox existente continua disponível para testes locais. A ativação real depende de credenciais de teste, URL pública de webhook, cadastro da aplicação e aceite dos requisitos comerciais/regulatórios.

Em 8 de setembro de 2026, a configuração das credenciais foi **adiada pelo proprietário**. Por isso, `PAYMENTS_PROVIDER` deve permanecer em `sandbox` até que `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` e `PUBLIC_BASE_URL` sejam configurados juntos. Ativar apenas parte dessa configuração faz o adaptador falhar fechado, sem criar compra de BTC.

## Máquina de estados implementada

1. A RendeBit persiste uma compra em `awaiting_payment` e cria uma preferência hospedada com chave idempotente.
2. O usuário paga via Pix ou cartão no domínio do Mercado Pago; dados de cartão não passam pelo backend da RendeBit.
3. O retorno do navegador apenas informa o usuário e abre “Meus aportes”; ele **não aprova** a compra.
4. O webhook valida HMAC, consulta `GET /v1/payments/{id}` com o Access Token privado e compara valor e referência externa.
5. Somente um pagamento `approved` muda a compra para `processing` e aciona compra de BTC, custódia e estratégia de rendimento.
6. Estados pendente ou rejeitado não criam BTC nem ativam rendimento. Eventos inesperados ficam em revisão manual.
7. O histórico soma somente compras liquidadas e permite retomar um checkout ainda pendente.

## Fontes oficiais

1. Checkout Transparente / Orders API: https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/overview
2. Notificações e validação de origem: https://www.mercadopago.com.br/developers/en/docs/checkout-api-orders/notifications
3. Cartões e idempotência: https://www.mercadopago.com.ar/developers/en/docs/checkout-bricks/payment-brick/payment-submission/cards
4. Preferências do Checkout Pro: https://www.mercadopago.com.br/developers/en/docs/checkout-pro/create-payment-preference
5. Credenciais e boas práticas: https://www.mercadopago.com.br/developers/en/docs/your-integrations/credentials
