# Cotação BTC/BRL ao vivo

**Data de validação:** 08/09/2026.

A RendeBit consulta a cotação pública `BTC-BRL` da Coinbase como fonte principal:

- https://api.coinbase.com/v2/prices/BTC-BRL/spot

Se a fonte principal estiver indisponível, usa o endpoint oficial `simple/price` do CoinGecko com `ids=bitcoin`, `vs_currencies=brl` e `include_last_updated_at=true`:

- https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_last_updated_at=true
- Documentação: https://docs.coingecko.com/reference/simple-price

A documentação do CoinGecko informa atualização a cada 60 segundos na API pública sem chave. O backend mantém cache em memória por 60 segundos, timeout de cinco segundos por fonte e aceita o último valor conhecido por até quinze minutos apenas quando as duas fontes falham, marcando-o como desatualizado.

Na validação, a Coinbase respondeu HTTP 200 com **R$ 400.115,59** e o CoinGecko respondeu HTTP 200 com **R$ 400.094,00**. Uma verificação independente por Yahoo Finance, derivando `BTC-USD × USD-BRL`, retornou **R$ 400.064,12**. Esses valores são apenas o registro do teste; a aplicação consulta novamente em tempo de execução.
