# Pesquisa de concorrentes e integrações — 08/09/2026

## Síntese competitiva

Não foi comprovado nenhum concorrente que combine integralmente: compra de Bitcoin em BRL/Pix, rendimento baseado em Stacks/stBTC, experiência principal sem carteira visível, resgate em BRL/Pix, contabilidade por lote, relatório fiscal brasileiro, prova on-chain, custódia segregada e API white-label.

Os substitutos brasileiros mais próximos são:

- **Bipa:** compra/venda BTC via Pix, recompensa em BTC e informe fiscal; o Cofrinho não é staking nem stBTC/Stacks. Fontes: https://bipa.app/cofrinho, https://suporte.bipa.app/hc/pt-br/articles/49368249092635-Cofrinho-Bitcoin-Como-funciona-a-recompensa-em-BTC, https://github.com/bipa-app/docs/blob/main/api-reference/partner/introduction.mdx
- **Binance Brasil:** Pix, compra BTC, Earn e CaaS; BTC Yield é covered call custodial e não stBTC. Fontes: https://www.binance.com/en/earn/btc, https://www.binance.com/en/earn/btc-yield, https://www.binance.com/en/crypto-as-a-service, https://www.binance.com/en/proof-of-reserves
- **Mercado Bitcoin:** compra/custódia/venda BTC em BRL/Pix, fiscal e MB Cloud; sem rendimento BTC/stBTC comprovado. Fontes: https://www.mercadobitcoin.com.br/renda-passiva, https://www.mercadobitcoin.com.br/cloud, https://www.mercadobitcoin.com.br/irpf
- **Nubank Cripto:** UX simples de compra/venda BTC e relatório, mas sem BTC yield/stBTC. Fontes: https://nubank.com.br/nu/nubank-criptomoeda, https://nubank.com.br/nu/imposto-de-renda
- **Nexo.com:** BTC Savings, exchange e white-label; não comprova fluxo completo BRL/Pix ou stBTC. O nome **Nexo** representa risco alto de marca e confusão. Fontes: https://nexo.com/pt-br, https://nexo.com/en-us/earn-crypto/bitcoin, https://nexo.com/pt-br/white-label

Infraestruturas comparáveis:

- **StackingDAO stBTC:** componente técnico mais próximo para rendimento em Bitcoin sobre Stacks, mas exige carteira e não oferece Pix/fiscal brasileiro. Fontes: https://docs.stackingdao.com/stackingdao/the-stacking-dao-app/stbtc-liquid-btc-staking-with-btc-rewards/stbtc-basics, https://docs.stackingdao.com/stackingdao/core-contracts/stbtc-stacking-dao-core
- **Lombard LBTC:** SDK e token BTC com rendimento; sem BRL/Pix e não baseado em Stacks/stBTC. Fontes: https://docs.lombard.finance/use/lbtc/understanding-yield, https://www.lombard.finance/products/sdk/
- **SolvBTC:** infraestrutura BTCFi e PoR; wallet-centric, sem integração brasileira comprovada. Fontes: https://docs.solv.finance/key-products/solvbtc, https://docs.solv.finance/staking-abstraction-layer-sal/overview/what-is-sal

A lacuna defensável é ser a camada Brasil-first de tradução e confiança entre Pix, Bitcoin produtivo, risco on-chain e fiscalidade por lote. A comunicação deve tratar o retorno como variável e denominado em BTC; BRL deve ser cotação/mark-to-market, não promessa de juros fixos em reais.

## Integrações verificadas

- **MetaMap CPF-light:** valida CPF/identidade brasileira, exige callbackURL/webhook e OAuth client credentials. Fonte: https://docs.metamap.com/reference/govchecks-brazil-cpf-light
- **Celcoin Pix Cash-out:** API autenticada, clientCode único, consulta de status e webhook `pix-payment-out`; respostas 5xx/PROCESSING não devem ser canceladas sem aguardar atualização. Fonte: https://developers.celcoin.com.br/docs/realizar-um-pix-cash-out
- **Stacks sBTC Bridge:** Emily API acompanha peg-in e peg-out. Fonte: https://docs.stacks.co/reference/api/sbtc-bridge
- **StackingDAO stBTC:** BTC nativo usa o peg path do sBTC antes da emissão de stBTC; rendimento, taxas, conversão e liquidez são variáveis e não garantidos. Fonte: https://docs.stackingdao.com/stackingdao/the-stacking-dao-app/stbtc-liquid-btc-staking-with-btc-rewards/stbtc-basics

## Decisão de arquitetura

O usuário escolheu **fullstack em sandbox primeiro**: banco, autenticação, ledger, webhooks simulados, idempotência, painel administrativo e adaptadores, sem movimentação real. A carteira organizacional e credenciais de produção permanecem bloqueios obrigatórios antes de ativar transferências reais.
