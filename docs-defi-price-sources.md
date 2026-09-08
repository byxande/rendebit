# Fontes e fórmulas de preços DeFi

| Ativo | Fonte/fórmula | Limitação | Status no produto |
|---|---|---|---|
| zstSTX | Valor do vault Zest `v0-vault-ststx`: `get-total-assets / get-total-supply`, multiplicado pelo preço derivado do stSTX | É NAV de receipt token, não cotação executável; o contrato exato foi verificado no deployment oficial da Zest | Derivado on-chain |
| LiSTX | 1 LiSTX = 1 STX conforme documentação LISA; preço = STX/USD | É um peg de protocolo/redemption, não garantia de venda imediata | Derivado por peg |
| vLiALEX | `get-shares-to-tokens(100000000)` no contrato `SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.auto-alex-v3-wrapped`; preço = razão × ALEX/USD | Sem mercado direto verificado; depende do preço ALEX e da razão on-chain | Derivado on-chain |
| rstSTX | Nenhum mercado, pool ou oracle público verificado | O contrato aparece como token não verificado e não deve receber preço inventado | Sem preço |
| STX/stSTX LP | NAV indicativo = `(reserva STX × STX/USD + reserva stSTX × stSTX/USD) / total-shares` lido de `get-pool` | Ignora fees, slippage, imbalance e risco de redemption | Derivado por reservas |
| STX/aeUSDC LP | NAV indicativo = `(reserva STX × STX/USD + reserva aeUSDC × USD) / total-shares` lido de `get-pool` | Pool pode estar em migração; valor não é cotação executável | Derivado por reservas |

Fontes verificadas: Zest vault docs https://docs.zestprotocol.com/start/stacks-market-smart-contracts/v2-contracts/vaults.md; deployment Zest https://github.com/Zest-Protocol/zest-v2-contracts/blob/main/mainnet/README.md; CoinGecko simple prices https://api.coingecko.com/api/v3/simple/price; Hiro call-read https://docs.stacks.co/reference/api/stacks-blockchain-api; LISA LiSTX docs https://docs.lisalab.io/supported-tokens/stx; LISA/ALEX docs https://docs.lisalab.io/supported-tokens/alex.md; Bitflow pool state via Hiro contracts `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-stx-ststx-v-1-4` and `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-1`.

The wealth chart is a mark-to-market estimate: it keeps the wallet's current token quantities constant and replays historical market prices from CoinGecko for STX, BTC, ALEX and stSTX over 30 days. Stablecoins use a one-dollar peg. The series is reconciled to the live portfolio value at the latest point so that derivative NAV positions and the overview total remain consistent. It is explicitly labeled an estimate rather than a historical accounting ledger because the public frontend does not persist daily wallet snapshots.
