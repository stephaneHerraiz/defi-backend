/**
 * Interface for OHLC (Open, High, Low, Close) price data
 */
export interface OHLCData {
  /** Token contract address */
  address: string;
  /** Chain ID (e.g., 1 for Ethereum mainnet) */
  chainId: number;
  /** Opening price for the period */
  open?: number;
  /** Highest price during the period */
  high?: number;
  /** Lowest price during the period */
  low?: number;
  /** Closing price for the period */
  close: number;
  /** Trading volume during the period */
  volume?: number;
  /** Timestamp in milliseconds (optional, defaults to current time) */
  timestamp?: number;
}

/**
 * Interface for OHLC data as stored/retrieved from QuestDB
 */
export interface OHLCRecord extends Omit<OHLCData, 'timestamp'> {
  /** Timestamp as ISO string from QuestDB */
  timestamp: string;
}

/**
 * Interface for querying OHLC data
 */
export interface OHLCQueryOptions {
  /** Token contract address */
  address: string;
  /** Chain ID */
  chainId?: number;
  /** Start timestamp (ISO string or Date) */
  fromTimestamp?: string;
  /** End timestamp (ISO string or Date) */
  toTimestamp?: string;
  /** Maximum number of records to return */
  limit?: number;
  /** Order by timestamp: 'ASC' or 'DESC' */
  order?: 'ASC' | 'DESC';
}

/**
 * Interface for aggregated OHLC data (for resampling)
 */
export interface AggregatedOHLCOptions extends OHLCQueryOptions {
  /** Time interval for aggregation: '1m', '5m', '15m', '1h', '4h', '1d', '1w' */
  interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
}
