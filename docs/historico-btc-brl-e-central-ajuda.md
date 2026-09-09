# Histórico BTC/BRL e Central de Ajuda

**Data-base:** 08/09/2026.

## Série histórica

A área **Mercado BTC** oferece filtros de 24 horas, 7 dias, 30 dias, 90 dias, 1 ano, 10 anos e todo o histórico disponível. A fonte principal é o endpoint `coins/{id}/market_chart` do CoinGecko, consultado com `bitcoin` e `vs_currency=brl`. A documentação oficial informa que a resposta contém pares `[timestamp, price]` e aplica granularidade automática de cinco minutos para um dia, horária entre dois e noventa dias e diária acima de noventa dias.

Como contingência, o backend consulta as séries estruturadas `BTC-USD` e `BRL=X` do Yahoo Finance e deriva BTC/BRL por timestamp. Essa alternativa também viabiliza períodos longos quando a camada pública do CoinGecko limita a janela histórica ou retorna rate limit.

Cada período tem cache independente de cinco minutos. Se ambas as fontes falharem, uma série previamente obtida pode ser exibida por até 24 horas com o marcador de **última série conhecida**. As séries são reduzidas para no máximo 240 pontos, preservando primeiro ponto, último ponto, mínimas e máximas de cada janela visual.

O gráfico é uma referência de mercado. O preço de execução de compra ou resgate pode conter spread, taxas, liquidez e diferença temporal. A variação do BTC é apresentada separadamente do rendimento estimado da estratégia.

## Central de Ajuda

A Central de Ajuda agora oferece três caminhos rápidos para iniciantes: começar, entender segurança e receber via Pix. A busca continua cobrindo pergunta, resposta e categoria; os assuntos ganharam contagens, linguagem mais brasileira e acessos diretos para Segurança e Mercado BTC. Foram incluídas respostas específicas sobre origem da cotação, leitura do gráfico e diferença entre preço do Bitcoin e rendimento da estratégia.

## Fontes

- CoinGecko, `Coin Historical Chart Data by ID`: https://docs.coingecko.com/reference/coins-id-market-chart
- Yahoo Finance, gráfico histórico de `BTC-USD`: https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD
- Yahoo Finance, gráfico histórico de `BRL=X`: https://query1.finance.yahoo.com/v8/finance/chart/BRL%3DX
