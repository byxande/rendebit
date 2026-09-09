import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearBtcBrlQuoteCache, fetchCoinGeckoBtcBrl, getBtcBrlQuote } from "./btcBrlQuote";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("cotação BTC/BRL", () => {
  beforeEach(clearBtcBrlQuoteCache);

  it("usa Coinbase como fonte principal e valida o par", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ data: { amount: "400115.594", base: "BTC", currency: "BRL" } }));
    const quote = await getBtcBrlQuote({ fetcher: fetcher as typeof fetch, now: 1_789_000_000_000 });
    expect(quote).toMatchObject({ pair: "BTC/BRL", priceBrl: 400115.59, source: "Coinbase", stale: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("usa CoinGecko quando a Coinbase falha", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: "indisponível" }, 503))
      .mockResolvedValueOnce(jsonResponse({ bitcoin: { brl: 400094, last_updated_at: 1_788_913_370 } }));
    const quote = await getBtcBrlQuote({ fetcher: fetcher as typeof fetch, now: 1_789_000_000_000 });
    expect(quote).toMatchObject({ priceBrl: 400094, source: "CoinGecko", marketUpdatedAt: 1_788_913_370_000 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejeita preços fora do intervalo defensivo", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ bitcoin: { brl: 1, last_updated_at: 1_788_913_370 } }));
    await expect(fetchCoinGeckoBtcBrl(fetcher as typeof fetch)).rejects.toThrow("fora do intervalo esperado");
  });

  it("serve o cache sem uma nova chamada durante 60 segundos", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ data: { amount: "400000", base: "BTC", currency: "BRL" } }));
    await getBtcBrlQuote({ fetcher: fetcher as typeof fetch, now: 1_789_000_000_000 });
    const quote = await getBtcBrlQuote({ fetcher: fetcher as typeof fetch, now: 1_789_000_030_000 });
    expect(quote.priceBrl).toBe(400000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("marca o último valor como desatualizado se as duas fontes falharem", async () => {
    const success = vi.fn().mockResolvedValue(jsonResponse({ data: { amount: "400000", base: "BTC", currency: "BRL" } }));
    await getBtcBrlQuote({ fetcher: success as typeof fetch, now: 1_789_000_000_000 });
    const unavailable = vi.fn().mockResolvedValue(jsonResponse({ error: "fora do ar" }, 503));
    const quote = await getBtcBrlQuote({ fetcher: unavailable as typeof fetch, now: 1_789_000_120_000, forceRefresh: true });
    expect(quote).toMatchObject({ priceBrl: 400000, stale: true });
    expect(unavailable).toHaveBeenCalledTimes(2);
  });
});
