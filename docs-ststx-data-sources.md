# Fontes de dados do rastreador stSTX

- StackingDAO stSTX basics: https://docs.stackingdao.com/stackingdao/the-stacking-dao-app/ststx-liquid-stx-staking-with-stx-rewards/ststx-basics.md
  - stSTX é uma representação tokenizada de STX em staking com rewards STX auto-compound.
  - A documentação informa que a taxa stSTX/STX aumenta gradualmente ao longo do ciclo e atualiza aproximadamente a cada 70 blocos Bitcoin (~12h).
- StackingDAO core contract: https://docs.stackingdao.com/stackingdao/core-contracts/ststx-stacking-dao-core.md
  - Contrato de dados: `SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.data-stx-v2`.
  - Função read-only `get-stx-per-ststx` retorna os micro-STX que respaldam 1 stSTX.
  - Token oficial: `SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token::ststx`.
- Hiro Stacks API: https://docs.stacks.co/reference/api/stacks-blockchain-api
  - Base pública usada: `https://api.hiro.so`.
  - Saldos: `/extended/v1/address/{address}/balances?proof=0`.
  - Bloco por timestamp: `/extended/v2/blocks/by-block-time/{timestamp}`.
  - Chamada Clarity histórica: `POST /v2/contracts/call-read/{address}/{contract}/{function}?tip={index_block_hash}`; o `tip` precisa ser o hash sem o prefixo `0x`.
- CoinGecko Keyless API: https://docs.coingecko.com/docs/keyless-public-api
  - Preço STX/USD usado: `https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd&include_24hr_change=true`.
  - A documentação informa que o endpoint keyless é público, sem chave, mas sujeito a limite de aproximadamente 10–30 chamadas/minuto.
- StackingDAO public endpoints observados na aplicação oficial:
  - APY: `https://app.stackingdao.com/api/apy?v=2`.
  - Lifetime yield por endereço: `https://app.stackingdao.com/api/lifetime-yield/{address}`.

Implementação: o preço implícito do stSTX é calculado como `taxa stSTX/STX × preço STX/USD`; o gráfico histórico consulta sete pontos reais da blockchain (30, 25, 20, 15, 10, 5 e 0 dias). A janela é mantida após a implantação do contrato atual `data-stx-v2`, evitando pontos anteriores à existência desse contrato, e não usa uma curva simulada.
