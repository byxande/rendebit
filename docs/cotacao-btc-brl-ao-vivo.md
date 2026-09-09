# Cotação BTC/BRL ao vivo

**Data de validação:** 09/09/2026.
**Estado:** componente público de referência; não representa cotação firme de compra.

A RendeBit consulta primeiro o ticker público Spot `BTCBRL` da **Binance**:

- https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCBRL
- Documentação: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints

O endpoint `GET /api/v3/ticker/price` retorna o último preço para um símbolo. A implementação valida tanto o símbolo `BTCBRL` quanto uma faixa defensiva de preço antes de expor a informação ao cliente. Durante a validação de 09/09/2026, o endpoint respondeu HTTP 200 com `{"symbol":"BTCBRL","price":"400782.00000000"}`.

Caso a fonte principal fique indisponível, o backend tenta a Coinbase e, em seguida, o CoinGecko:

1. https://api.coinbase.com/v2/prices/BTC-BRL/spot
2. https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_last_updated_at=true

O backend mantém cache em memória por 60 segundos, timeout de cinco segundos por fonte e aceita o último valor conhecido por até quinze minutos somente quando todas as fontes falham. Esse último valor é devolvido com `stale: true`; a interface o identifica como “Último valor conhecido”. A página inicial mostra a fonte efetivamente usada, horário de atualização e uma ação manual de atualização.

> O preço spot público é uma referência de mercado. A cotação de uma compra pode possuir spread, taxa, slippage, limite, validade e preço de execução próprios. A visualização não é oferta, recomendação ou garantia de preço.
