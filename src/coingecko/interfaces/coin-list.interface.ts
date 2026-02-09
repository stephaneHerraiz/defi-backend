export interface Coin {
  id: string;
  symbol: string;
  name: string;
  platforms: Record<string, string>;
}

export interface CoinListResponse extends Array<Coin> {}

export interface CachedCoinList {
  data: Coin[];
  timestamp: number;
  expiresAt: number;
}
