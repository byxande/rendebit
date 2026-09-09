import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearBtcBrlQuoteCache, fetchBinanceBtcBrl, fetchCoinGeckoBtcBrl, getBtcBrlQuote } from "./btcBrlQuote";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("cotação BTC/BRL", () => {
  beforeEach(clearBtcBrlQuoteCache);

  it("usa Binance como fonte principal e valida o par BTCBRL", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ symbol: "BTCBRL", price: "400115.59400000" }));
    const quote = await getBtcBrlQuote({ fetcher: fetcher as typeof fetch, now: 1_789_000_000_000 });
    expect(quote).toMatchObject({ pair: "BTC/BRL", priceBrl: 400115.59, source: "Binance", stale: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("usa Coinbase quando Binance falha e CoinGecko como terceira fonte", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: "indisponível" }, 503))
      .mockResolvedValueOnce(jsonResponse({ data: { amount: "400094", base: "BTC", currency: "BRL" } }));
    const quote = await getBtcBrlQuote({ fetcher: fetcher as typeof fetch, now: 1_789_000_000_000 });
    expect(quote).toMatchObject({ priceBrl: 400094, source: "Coinbase" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("valida a resposta pública da Binance", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ symbol: "ETHBRL", price: "400000" }));
    await expect(fetchBinanceBtcBrl(fetcher as typeof fetch)).rejects.toThrow("Par inesperado");
  });

  it("rejeita preços fora do intervalo defensivo", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ bitcoin: { brl: 1, last_updated_at: 1_788_913_370 } }));
    await expect(fetchCoinGeckoBtcBrl(fetcher as typeof fetch)).rejects.toThrow("fora do intervalo esperado");
  });

  it("serve o cache sem uma nova chamada durante 60 segundos", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ symbol: "BTCBRL", price: "400000" }));
    await getBtcBrlQuote({ fetcher: fetcher as typeof fetch, now: 1_789_000_000_000 });
    const quote = await getBtcBrlQuote({ fetcher: fetcher as typeof fetch, now: 1_789_000_030_000 });
    expect(quote.priceBrl).toBe(400000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("marca o último valor como desatualizado se as duas fontes falharem", async () => {
    const success = vi.fn().mockResolvedValue(jsonResponse({ symbol: "BTCBRL", price: "400000" }));
    await getBtcBrlQuote({ fetcher: success as typeof fetch, now: 1_789_000_000_000 });
    const unavailable = vi.fn().mockResolvedValue(jsonResponse({ error: "fora do ar" }, 503));
    const quote = await getBtcBrlQuote({ fetcher: unavailable as typeof fetch, now: 1_789_000_120_000, forceRefresh: true });
    expect(quote).toMatchObject({ priceBrl: 400000, stale: true });
    expect(unavailable).toHaveBeenCalledTimes(3);
  });
});
