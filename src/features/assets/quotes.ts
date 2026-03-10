import type { AssetOption } from './catalog';

interface YahooQuoteResponse {
  quoteResponse?: {
    result?: Array<{
      symbol?: string;
      regularMarketPrice?: number;
      postMarketPrice?: number;
      preMarketPrice?: number;
      regularMarketPreviousClose?: number;
    }>;
  };
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
      };
    }>;
  };
}

const YAHOO_QUOTE_ENDPOINTS = [
  'https://query1.finance.yahoo.com/v7/finance/quote?symbols=',
  'https://query2.finance.yahoo.com/v7/finance/quote?symbols=',
];
const YAHOO_CHART_ENDPOINT = 'https://query2.finance.yahoo.com/v8/finance/chart/';
const SUCCESS_CACHE_TTL_MS = 60 * 1000;
const FAILURE_CACHE_TTL_MS = 10 * 1000;
const REQUEST_HEADERS = {
  Accept: 'application/json',
};

interface QuoteCacheEntry {
  price: number | null;
  expiresAt: number;
}

const quoteCache = new Map<string, QuoteCacheEntry>();

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function readCachedPrice(symbol: string): number | null | undefined {
  const cached = quoteCache.get(symbol);
  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= Date.now()) {
    quoteCache.delete(symbol);
    return undefined;
  }

  return cached.price;
}

function writeCachedPrice(symbol: string, price: number | null): void {
  const ttl = price == null ? FAILURE_CACHE_TTL_MS : SUCCESS_CACHE_TTL_MS;
  quoteCache.set(symbol, {
    price,
    expiresAt: Date.now() + ttl,
  });
}

function pruneExpiredCacheEntries(): void {
  const now = Date.now();
  for (const [symbol, entry] of quoteCache.entries()) {
    if (entry.expiresAt <= now) {
      quoteCache.delete(symbol);
    }
  }
}

function pickBestYahooPrice(input: {
  regularMarketPrice?: number;
  postMarketPrice?: number;
  preMarketPrice?: number;
  regularMarketPreviousClose?: number;
  previousClose?: number;
}): number | null {
  const candidates = [
    input.regularMarketPrice,
    input.postMarketPrice,
    input.preMarketPrice,
    input.regularMarketPreviousClose,
    input.previousClose,
  ];

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

async function fetchYahooQuoteBatch(
  symbols: string[],
  fallback: Record<string, number | null>
): Promise<Record<string, number | null>> {
  const query = symbols.map((symbol) => encodeURIComponent(symbol)).join('%2C');

  for (const endpoint of YAHOO_QUOTE_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}${query}`, { headers: REQUEST_HEADERS });
      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as YahooQuoteResponse;
      const quoteResults = payload.quoteResponse?.result ?? [];

      return quoteResults.reduce<Record<string, number | null>>((acc, item) => {
        const symbol = item.symbol;

        if (!symbol || !hasOwn(fallback, symbol)) {
          return acc;
        }

        acc[symbol] = pickBestYahooPrice(item);
        return acc;
      }, { ...fallback });
    } catch {
      continue;
    }
  }

  return { ...fallback };
}

async function fetchYahooChartPrice(symbol: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${YAHOO_CHART_ENDPOINT}${encodeURIComponent(symbol)}?interval=1m&range=1d`,
      { headers: REQUEST_HEADERS }
    );
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as YahooChartResponse;
    const meta = payload.chart?.result?.[0]?.meta;
    if (!meta) {
      return null;
    }

    return pickBestYahooPrice(meta);
  } catch {
    return null;
  }
}

export async function fetchCurrentPrices(
  quoteSymbols: string[]
): Promise<Record<string, number | null>> {
  pruneExpiredCacheEntries();

  const uniqueSymbols = Array.from(
    new Set(quoteSymbols.map((symbol) => symbol.trim()).filter((symbol) => symbol.length > 0))
  );

  if (uniqueSymbols.length === 0) {
    return {};
  }

  const resolved = uniqueSymbols.reduce<Record<string, number | null | undefined>>((acc, symbol) => {
    acc[symbol] = readCachedPrice(symbol);
    return acc;
  }, {});

  const uncachedSymbols = uniqueSymbols.filter((symbol) => resolved[symbol] === undefined);
  if (uncachedSymbols.length === 0) {
    return resolved as Record<string, number | null>;
  }

  const fallback = uncachedSymbols.reduce<Record<string, number | null>>((acc, symbol) => {
    acc[symbol] = null;
    return acc;
  }, {});

  const fetched = await fetchYahooQuoteBatch(uncachedSymbols, fallback);

  const stillMissingSymbols = uncachedSymbols.filter((symbol) => fetched[symbol] == null);
  if (stillMissingSymbols.length > 0) {
    const chartPrices = await Promise.all(
      stillMissingSymbols.map(async (symbol) => ({
        symbol,
        price: await fetchYahooChartPrice(symbol),
      }))
    );

    for (const { symbol, price } of chartPrices) {
      if (price != null) {
        fetched[symbol] = price;
      }
    }
  }

  uncachedSymbols.forEach((symbol) => {
    writeCachedPrice(symbol, fetched[symbol] ?? null);
  });

  return { ...(resolved as Record<string, number | null>), ...fetched };
}

export async function fetchCurrentPrice(quoteSymbol: string): Promise<number | null> {
  const prices = await fetchCurrentPrices([quoteSymbol]);
  if (!hasOwn(prices, quoteSymbol)) {
    return null;
  }

  return prices[quoteSymbol];
}

export function formatDisplayPrice(price: number | null | undefined): string {
  if (price == null) {
    return price === null ? 'N/A' : '...';
  }

  if (price >= 1000) {
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  }

  return `$${price.toFixed(6)}`;
}

export async function fetchCurrentPriceForAsset(asset: AssetOption): Promise<number | null> {
  return fetchCurrentPrice(asset.quoteSymbol);
}

export function roundPrefillPrice(price: number): number {
  return Number(price.toFixed(8));
}

export function clearQuoteCache(): void {
  quoteCache.clear();
}
