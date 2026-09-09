export type BtcBrlQuote = {
  pair: "BTC/BRL";
  priceBrl: number;
  source: "Coinbase" | "CoinGecko";
  sourceUrl: string;
  marketUpdatedAt: number;
  fetchedAt: number;
  stale: boolean;
};

type FetchLike = typeof fetch;

const CACHE_TTL_MS = 60_000;
const MAX_STALE_MS = 15 * 60_000;
const REQUEST_TIMEOUT_MS = 5_000;
let cachedQuote: BtcBrlQuote | null = null;

function validPrice(value: unknown) {
  const price = typeof value === "string" ? Number(value) : value;
  if (typeof price !== "number" || !Number.isFinite(price) || price < 10_000 || price > 10_000_000) {
    throw new Error("Cotação BTC/BRL fora do intervalo esperado.");
  }
  return Math.round(price * 100) / 100;
}

async function fetchJson(url: string, fetcher: FetchLike) {
  const response = await fetcher(url, {
    headers: { accept: "application/json", "user-agent": "RendeBit/1.0" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Fonte respondeu HTTP ${response.status}.`);
  return response.json() as Promise<unknown>;
}

export async function fetchCoinbaseBtcBrl(fetcher: FetchLike = fetch, now = Date.now()): Promise<BtcBrlQuote> {
  const sourceUrl = "https://api.coinbase.com/v2/prices/BTC-BRL/spot";
  const payload = await fetchJson(sourceUrl, fetcher) as { data?: { amount?: unknown; base?: string; currency?: string } };
  if (payload.data?.base !== "BTC" || payload.data.currency !== "BRL") throw new Error("Par inesperado na resposta da Coinbase.");
  return { pair: "BTC/BRL", priceBrl: validPrice(payload.data.amount), source: "Coinbase", sourceUrl, marketUpdatedAt: now, fetchedAt: now, stale: false };
}

export async function fetchCoinGeckoBtcBrl(fetcher: FetchLike = fetch, now = Date.now()): Promise<BtcBrlQuote> {
  const sourceUrl = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_last_updated_at=true";
  const payload = await fetchJson(sourceUrl, fetcher) as { bitcoin?: { brl?: unknown; last_updated_at?: unknown } };
  const updatedAt = Number(payload.bitcoin?.last_updated_at);
  return {
    pair: "BTC/BRL",
    priceBrl: validPrice(payload.bitcoin?.brl),
    source: "CoinGecko",
    sourceUrl,
    marketUpdatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt * 1_000 : now,
    fetchedAt: now,
    stale: false,
  };
}

export async function getBtcBrlQuote(options: { fetcher?: FetchLike; now?: number; forceRefresh?: boolean } = {}): Promise<BtcBrlQuote> {
  const now = options.now ?? Date.now();
  const fetcher = options.fetcher ?? fetch;
  if (!options.forceRefresh && cachedQuote && now - cachedQuote.fetchedAt < CACHE_TTL_MS) return cachedQuote;

  const errors: string[] = [];
  for (const source of [fetchCoinbaseBtcBrl, fetchCoinGeckoBtcBrl]) {
    try {
      const quote = await source(fetcher, now);
      cachedQuote = quote;
      return quote;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (cachedQuote && now - cachedQuote.fetchedAt <= MAX_STALE_MS) return { ...cachedQuote, stale: true };
  throw new Error(`Cotação BTC/BRL indisponível. ${errors.join(" ")}`);
}

export function clearBtcBrlQuoteCache() {
  cachedQuote = null;
}
