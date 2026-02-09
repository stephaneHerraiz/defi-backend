/**
 * Interface for generic row data insertion into QuestDB
 * This provides flexibility to insert data into any table structure
 */
export interface RowData {
  /** Target table name */
  table: string;

  /**
   * Symbol columns - these are indexed string columns in QuestDB
   * Use for low-cardinality string values that you'll filter on frequently
   * Examples: currency pairs, status codes, category names
   */
  symbols?: Record<string, string>;

  /**
   * Regular columns - various data types
   * Supported types: number (float), string, boolean, bigint (integer)
   */
  columns?: Record<string, number | string | boolean | bigint>;

  /**
   * Optional Unix timestamp in milliseconds
   * If not provided, the current time will be used
   */
  timestamp?: number;
}

/**
 * Interface for QuestDB query result
 */
export interface QueryResult<T = Record<string, unknown>> {
  /** The SQL query that was executed */
  query: string;

  /** Column definitions from the result */
  columns: Array<{
    name: string;
    type: string;
  }>;

  /** The actual data rows, transformed to objects */
  dataset: T[];

  /** Number of rows in the result */
  count: number;
}
