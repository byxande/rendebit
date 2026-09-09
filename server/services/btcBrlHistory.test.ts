import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearBtcBrlHistoryCache,
  downsampleBtcHistory,
  fetchCoinGeckoBtcBrlHistory,
  getBtcBrlHistory,
} from "./btcBrlHistory";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const now = Date.UTC(2026, 8, 8, 21, 0, 0);

describe("histórico BTC/BRL", () => {
  beforeEach(() => clearBtcBrlHistoryCache());

  it("calcula variação, mínima e máxima de uma série CoinGecko", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ prices: [
      [now - 2 * 60 * 60_000, 380000],
      [now - 60 * 60_000, 410000],
      [now, 400000],
    ] }));
    const history = await fetchCoinGeckoBtcBrlHistory("24h", fetcher as typeof fetch, now);
    expect(history).toMatchObject({ source: "CoinGecko", startPriceBrl: 380000, endPriceBrl: 400000, changeBrl: 20000, lowPriceBrl: 380000, highPriceBrl: 410000, changePercent: 5.26 });
  });

  it("preserva primeiro, último e extremos ao reduzir séries grandes", () => {
    const points = Array.from({ length: 1000 }, (_, index) => ({ timestamp: index, priceBrl: index === 501 ? 100000 : index === 502 ? 900000 : 400000 + index }));
    const sampled = downsampleBtcHistory(points, 120);
    expect(sampled.length).toBeLessThanOrEqual(120);
    expect(sampled[0]).toEqual(points[0]);
    expect(sampled.at(-1)).toEqual(points.at(-1));
    expect(sampled.some(point => point.priceBrl === 100000)).toBe(true);
    expect(sampled.some(point => point.priceBrl === 900000)).toBe(true);
  });

  it("usa Yahoo Finance quando o CoinGecko estiver indisponível", async () => {
    const timestamps = [Math.floor((now - 60 * 60_000) / 1000), Math.floor(now / 1000)];
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ error: "rate limit" }, 429))
      .mockResolvedValueOnce(response({ chart: { result: [{ timestamp: timestamps, indicators: { quote: [{ close: [78000, 80000] }] } }] } }))
      .mockResolvedValueOnce(response({ chart: { result: [{ meta: { regularMarketPrice: 5 }, timestamp: timestamps, indicators: { quote: [{ close: [5, 5] }] } }] } }));
    const history = await getBtcBrlHistory("24h", { fetcher: fetcher as typeof fetch, now, forceRefresh: true });
    expect(history).toMatchObject({ source: "Yahoo Finance", startPriceBrl: 390000, endPriceBrl: 400000, changePercent: 2.56 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("serve cache por período durante cinco minutos", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ prices: [[now - 1000, 399000], [now, 400000]] }));
    await getBtcBrlHistory("24h", { fetcher: fetcher as typeof fetch, now });
    const cached = await getBtcBrlHistory("24h", { fetcher: fetcher as typeof fetch, now: now + 60_000 });
    expect(cached.endPriceBrl).toBe(400000);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
