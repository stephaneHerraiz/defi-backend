export interface CoinMarketChartResponse {
  prices: [number, number][]; // [timestamp, price]
  market_caps: [number, number][]; // [timestamp, market_cap]
  total_volumes: [number, number][]; // [timestamp, volume]
}

export interface CoinMarketChartParams {
  vs_currency: string; // e.g., 'usd', 'eur'
  days: string | number; // e.g., '1', '7', '30', 'max'
  interval?: string; // 'daily', 'hourly' - optional
  precision?: string; // 'full' or number of decimals - optional
}
