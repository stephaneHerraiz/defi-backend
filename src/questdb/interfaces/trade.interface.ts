/**
 * Interface for trade data to insert into QuestDB
 */
export interface TradeData {
  /** token address */
  address: string;
  /** price in USD */
  priceUSD: number;
  /** Optional Unix timestamp in milliseconds */
  timestamp: number;
}

/**
 * Interface for trade data retrieved from QuestDB (includes timestamp as string)
 */
export interface TradeRecord extends Omit<TradeData, 'timestamp'> {
  /** Timestamp as ISO string from QuestDB */
  timestamp: string;
}
