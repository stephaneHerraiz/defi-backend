export interface MarketsReservesInfo {
  markets: {
    reserves: {
      underlyingToken: UnderlyingToken;
    }[];
  }[];
}

export interface UnderlyingToken {
  address: string;
  imageUrl: string;
  name: string;
  decimals: number;
  symbol: string;
}
