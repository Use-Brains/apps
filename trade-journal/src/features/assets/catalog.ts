export type AssetClass = 'crypto' | 'stocks' | 'options' | 'futures' | 'forex';

export interface AssetOption {
  symbol: string;
  assetClass: AssetClass;
  displayName: string;
  quoteSymbol: string;
  popularity: number;
  aliases: readonly string[];
}

interface SuggestionOptions {
  preferredAssetClass?: AssetClass;
  limit?: number;
}

const ASSET_DATA: readonly AssetOption[] = [
  // Crypto (canonicalized to /USD when common quote bases exist)
  {
    symbol: 'BTC/USD',
    assetClass: 'crypto',
    displayName: 'Bitcoin',
    quoteSymbol: 'BTC-USD',
    popularity: 100,
    aliases: ['BTCUSDT', 'BTCUSDC', 'BTC/USDT', 'BTC/USDC', 'BTCUSD', 'XBT/USD'],
  },
  {
    symbol: 'ETH/USD',
    assetClass: 'crypto',
    displayName: 'Ethereum',
    quoteSymbol: 'ETH-USD',
    popularity: 95,
    aliases: ['ETHUSDT', 'ETHUSDC', 'ETH/USDT', 'ETH/USDC', 'ETHUSD'],
  },
  {
    symbol: 'SOL/USD',
    assetClass: 'crypto',
    displayName: 'Solana',
    quoteSymbol: 'SOL-USD',
    popularity: 85,
    aliases: ['SOLUSDT', 'SOLUSDC', 'SOL/USDT', 'SOL/USDC', 'SOLUSD'],
  },
  {
    symbol: 'XRP/USD',
    assetClass: 'crypto',
    displayName: 'XRP',
    quoteSymbol: 'XRP-USD',
    popularity: 80,
    aliases: ['XRPUSDT', 'XRPUSDC', 'XRP/USDT', 'XRP/USDC', 'XRPUSD'],
  },
  {
    symbol: 'BNB/USD',
    assetClass: 'crypto',
    displayName: 'BNB',
    quoteSymbol: 'BNB-USD',
    popularity: 78,
    aliases: ['BNBUSDT', 'BNBUSDC', 'BNB/USDT', 'BNB/USDC', 'BNBUSD'],
  },
  {
    symbol: 'ADA/USD',
    assetClass: 'crypto',
    displayName: 'Cardano',
    quoteSymbol: 'ADA-USD',
    popularity: 72,
    aliases: ['ADAUSDT', 'ADAUSDC', 'ADA/USDT', 'ADA/USDC', 'ADAUSD'],
  },
  {
    symbol: 'DOGE/USD',
    assetClass: 'crypto',
    displayName: 'Dogecoin',
    quoteSymbol: 'DOGE-USD',
    popularity: 70,
    aliases: ['DOGEUSDT', 'DOGEUSDC', 'DOGE/USDT', 'DOGE/USDC', 'DOGEUSD'],
  },
  {
    symbol: 'AVAX/USD',
    assetClass: 'crypto',
    displayName: 'Avalanche',
    quoteSymbol: 'AVAX-USD',
    popularity: 66,
    aliases: ['AVAXUSDT', 'AVAXUSDC', 'AVAX/USDT', 'AVAX/USDC', 'AVAXUSD'],
  },
  {
    symbol: 'LINK/USD',
    assetClass: 'crypto',
    displayName: 'Chainlink',
    quoteSymbol: 'LINK-USD',
    popularity: 64,
    aliases: ['LINKUSDT', 'LINKUSDC', 'LINK/USDT', 'LINK/USDC', 'LINKUSD'],
  },
  {
    symbol: 'LTC/USD',
    assetClass: 'crypto',
    displayName: 'Litecoin',
    quoteSymbol: 'LTC-USD',
    popularity: 60,
    aliases: ['LTCUSDT', 'LTCUSDC', 'LTC/USDT', 'LTC/USDC', 'LTCUSD'],
  },

  // Stocks
  {
    symbol: 'AAPL',
    assetClass: 'stocks',
    displayName: 'Apple',
    quoteSymbol: 'AAPL',
    popularity: 100,
    aliases: ['APPLE'],
  },
  {
    symbol: 'MSFT',
    assetClass: 'stocks',
    displayName: 'Microsoft',
    quoteSymbol: 'MSFT',
    popularity: 98,
    aliases: ['MICROSOFT'],
  },
  {
    symbol: 'NVDA',
    assetClass: 'stocks',
    displayName: 'NVIDIA',
    quoteSymbol: 'NVDA',
    popularity: 96,
    aliases: ['NVIDIA'],
  },
  {
    symbol: 'AMZN',
    assetClass: 'stocks',
    displayName: 'Amazon',
    quoteSymbol: 'AMZN',
    popularity: 94,
    aliases: ['AMAZON'],
  },
  {
    symbol: 'GOOGL',
    assetClass: 'stocks',
    displayName: 'Alphabet',
    quoteSymbol: 'GOOGL',
    popularity: 92,
    aliases: ['GOOG', 'ALPHABET'],
  },
  {
    symbol: 'META',
    assetClass: 'stocks',
    displayName: 'Meta',
    quoteSymbol: 'META',
    popularity: 90,
    aliases: ['FACEBOOK'],
  },
  {
    symbol: 'TSLA',
    assetClass: 'stocks',
    displayName: 'Tesla',
    quoteSymbol: 'TSLA',
    popularity: 88,
    aliases: ['TESLA'],
  },
  {
    symbol: 'SPY',
    assetClass: 'stocks',
    displayName: 'SPDR S&P 500 ETF',
    quoteSymbol: 'SPY',
    popularity: 86,
    aliases: ['S&P500', 'SP500'],
  },
  {
    symbol: 'QQQ',
    assetClass: 'stocks',
    displayName: 'Invesco QQQ ETF',
    quoteSymbol: 'QQQ',
    popularity: 84,
    aliases: ['NASDAQ100', 'NAS100'],
  },
  {
    symbol: 'AMD',
    assetClass: 'stocks',
    displayName: 'Advanced Micro Devices',
    quoteSymbol: 'AMD',
    popularity: 82,
    aliases: ['ADVANCED MICRO DEVICES'],
  },

  // Forex
  {
    symbol: 'EUR/USD',
    assetClass: 'forex',
    displayName: 'Euro / US Dollar',
    quoteSymbol: 'EURUSD=X',
    popularity: 100,
    aliases: ['EURUSD', 'EU'],
  },
  {
    symbol: 'GBP/USD',
    assetClass: 'forex',
    displayName: 'British Pound / US Dollar',
    quoteSymbol: 'GBPUSD=X',
    popularity: 94,
    aliases: ['GBPUSD', 'GU'],
  },
  {
    symbol: 'USD/JPY',
    assetClass: 'forex',
    displayName: 'US Dollar / Japanese Yen',
    quoteSymbol: 'JPY=X',
    popularity: 92,
    aliases: ['USDJPY', 'UJ'],
  },
  {
    symbol: 'AUD/USD',
    assetClass: 'forex',
    displayName: 'Australian Dollar / US Dollar',
    quoteSymbol: 'AUDUSD=X',
    popularity: 88,
    aliases: ['AUDUSD', 'AU'],
  },
  {
    symbol: 'USD/CAD',
    assetClass: 'forex',
    displayName: 'US Dollar / Canadian Dollar',
    quoteSymbol: 'CAD=X',
    popularity: 84,
    aliases: ['USDCAD', 'UC'],
  },
  {
    symbol: 'USD/CHF',
    assetClass: 'forex',
    displayName: 'US Dollar / Swiss Franc',
    quoteSymbol: 'CHF=X',
    popularity: 82,
    aliases: ['USDCHF'],
  },
  {
    symbol: 'NZD/USD',
    assetClass: 'forex',
    displayName: 'New Zealand Dollar / US Dollar',
    quoteSymbol: 'NZDUSD=X',
    popularity: 78,
    aliases: ['NZDUSD'],
  },

  // Futures
  {
    symbol: 'ES',
    assetClass: 'futures',
    displayName: 'E-mini S&P 500',
    quoteSymbol: 'ES=F',
    popularity: 90,
    aliases: ['ES1!', 'MES'],
  },
  {
    symbol: 'NQ',
    assetClass: 'futures',
    displayName: 'E-mini Nasdaq-100',
    quoteSymbol: 'NQ=F',
    popularity: 86,
    aliases: ['NQ1!', 'MNQ'],
  },
  {
    symbol: 'CL',
    assetClass: 'futures',
    displayName: 'Crude Oil',
    quoteSymbol: 'CL=F',
    popularity: 84,
    aliases: ['WTI'],
  },
  {
    symbol: 'GC',
    assetClass: 'futures',
    displayName: 'Gold',
    quoteSymbol: 'GC=F',
    popularity: 82,
    aliases: ['XAU/USD', 'XAUUSD'],
  },
  {
    symbol: 'ZN',
    assetClass: 'futures',
    displayName: '10Y Treasury Note',
    quoteSymbol: 'ZN=F',
    popularity: 76,
    aliases: ['ZN1!'],
  },

  // Options (underlying shorthand)
  {
    symbol: 'SPY',
    assetClass: 'options',
    displayName: 'SPY Options',
    quoteSymbol: 'SPY',
    popularity: 95,
    aliases: ['SPY OPTIONS'],
  },
  {
    symbol: 'QQQ',
    assetClass: 'options',
    displayName: 'QQQ Options',
    quoteSymbol: 'QQQ',
    popularity: 92,
    aliases: ['QQQ OPTIONS'],
  },
  {
    symbol: 'AAPL',
    assetClass: 'options',
    displayName: 'AAPL Options',
    quoteSymbol: 'AAPL',
    popularity: 90,
    aliases: ['AAPL OPTIONS'],
  },
  {
    symbol: 'TSLA',
    assetClass: 'options',
    displayName: 'TSLA Options',
    quoteSymbol: 'TSLA',
    popularity: 88,
    aliases: ['TSLA OPTIONS'],
  },
  {
    symbol: 'NVDA',
    assetClass: 'options',
    displayName: 'NVDA Options',
    quoteSymbol: 'NVDA',
    popularity: 86,
    aliases: ['NVDA OPTIONS'],
  },
];

interface IndexedAsset {
  asset: AssetOption;
  normalizedSymbol: string;
  normalizedAliases: readonly string[];
}

const normalize = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

const INDEXED_ASSETS: readonly IndexedAsset[] = ASSET_DATA.map((asset) => ({
  asset,
  normalizedSymbol: normalize(asset.symbol),
  normalizedAliases: asset.aliases.map((alias) => normalize(alias)),
}));

export const ASSET_CATALOG = ASSET_DATA;

export function normalizeAssetInput(value: string): string {
  return normalize(value.trim());
}

export function getAssetSuggestions(
  input: string,
  options: SuggestionOptions = {}
): AssetOption[] {
  const query = normalizeAssetInput(input);
  const preferredAssetClass = options.preferredAssetClass;
  const limit = options.limit ?? 8;

  const scored = INDEXED_ASSETS
    .map((candidate) => {
      const exactSymbolMatch = candidate.normalizedSymbol === query;
      const exactAliasMatch = candidate.normalizedAliases.includes(query);
      const startsWithSymbol = candidate.normalizedSymbol.startsWith(query);
      const startsWithAlias = candidate.normalizedAliases.some((alias) => alias.startsWith(query));
      const includesSymbol = candidate.normalizedSymbol.includes(query);
      const includesAlias = candidate.normalizedAliases.some((alias) => alias.includes(query));

      const matches =
        query.length === 0 ||
        exactSymbolMatch ||
        exactAliasMatch ||
        startsWithSymbol ||
        startsWithAlias ||
        includesSymbol ||
        includesAlias;

      if (!matches) {
        return null;
      }

      let score = candidate.asset.popularity;

      if (preferredAssetClass && candidate.asset.assetClass === preferredAssetClass) {
        score += 40;
      }

      if (query.length > 0) {
        if (exactSymbolMatch) score += 1000;
        else if (exactAliasMatch) score += 900;
        else if (startsWithSymbol) score += 800;
        else if (startsWithAlias) score += 700;
        else if (includesSymbol) score += 600;
        else if (includesAlias) score += 500;
      }

      return { asset: candidate.asset, score };
    })
    .filter((item): item is { asset: AssetOption; score: number } => item !== null)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.asset.popularity !== b.asset.popularity) {
        return b.asset.popularity - a.asset.popularity;
      }
      return a.asset.symbol.localeCompare(b.asset.symbol);
    });

  return scored.slice(0, limit).map((item) => item.asset);
}

export function resolveAssetSelection(
  input: string,
  options: SuggestionOptions = {}
): AssetOption | null {
  const query = normalizeAssetInput(input);
  if (!query) return null;

  const preferredAssetClass = options.preferredAssetClass;

  const exactMatches = INDEXED_ASSETS
    .filter(
      (candidate) =>
        candidate.normalizedSymbol === query || candidate.normalizedAliases.includes(query)
    )
    .map((candidate) => candidate.asset)
    .sort((a, b) => {
      if (preferredAssetClass) {
        const aPreferred = a.assetClass === preferredAssetClass;
        const bPreferred = b.assetClass === preferredAssetClass;
        if (aPreferred !== bPreferred) {
          return aPreferred ? -1 : 1;
        }
      }

      if (a.popularity !== b.popularity) {
        return b.popularity - a.popularity;
      }

      return a.symbol.localeCompare(b.symbol);
    });

  return exactMatches[0] ?? null;
}
