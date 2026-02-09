import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  OnModuleInit,
} from '@nestjs/common';
import { QuestdbService, QueryResult } from '../questdb/questdb.service';
import {
  OHLCData,
  OHLCRecord,
  OHLCQueryOptions,
  AggregatedOHLCOptions,
} from './interfaces/ohlc.interface';

@Injectable()
export class HistoricalPriceDataService implements OnModuleInit {
  private readonly logger = new Logger(HistoricalPriceDataService.name);
  private readonly tableName = 'ohlc_prices';

  constructor(private readonly questdbService: QuestdbService) {}

  async onModuleInit(): Promise<void> {
    await this.createTable();
  }

  /**
   * Insert a single OHLC price record
   */
  async insertOHLC(data: OHLCData): Promise<void> {
    try {
      await this.questdbService.insertRow({
        table: this.tableName,
        symbols: {
          address: data.address.toLowerCase(),
        },
        columns: {
          chain_id: data.chainId,
          open: data.open ?? -1,
          high: data.high ?? -1,
          low: data.low ?? -1,
          close: data.close,
          volume: data.volume ?? 0,
        },
        timestamp: data.timestamp,
      });

      this.logger.debug(`OHLC data inserted for ${data.address}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error inserting OHLC data: ${errorMessage}`);
      throw new HttpException(
        'Failed to insert OHLC data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Insert multiple OHLC price records in batch
   */
  async insertOHLCBatch(dataArray: OHLCData[]): Promise<void> {
    try {
      const rows = dataArray.map((data) => ({
        table: this.tableName,
        symbols: {
          address: data.address.toLowerCase(),
        },
        columns: {
          chain_id: data.chainId,
          open: data.open ?? -1,
          high: data.high ?? -1,
          low: data.low ?? -1,
          close: data.close,
          volume: data.volume ?? 0,
        },
        timestamp: data.timestamp,
      }));

      await this.questdbService.insertRows(rows);

      this.logger.debug(`Batch of ${dataArray.length} OHLC records inserted`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error inserting OHLC batch: ${errorMessage}`);
      throw new HttpException(
        'Failed to insert OHLC batch',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Query OHLC data with filters
   */
  async getOHLC(options: OHLCQueryOptions): Promise<QueryResult<OHLCRecord>> {
    try {
      let sql = `SELECT address, chain_id, open, high, low, close, volume, timestamp FROM ${this.tableName}`;
      const conditions: string[] = [];

      // Address is required
      conditions.push(`address = '${options.address.toLowerCase()}'`);

      if (options.chainId !== undefined) {
        conditions.push(`chain_id = ${options.chainId}`);
      }

      if (options.fromTimestamp) {
        conditions.push(`timestamp >= '${options.fromTimestamp}'`);
      }

      if (options.toTimestamp) {
        conditions.push(`timestamp <= '${options.toTimestamp}'`);
      }

      sql += ' WHERE ' + conditions.join(' AND ');
      sql += ` ORDER BY timestamp ${options.order || 'DESC'}`;

      if (options.limit) {
        sql += ` LIMIT ${options.limit}`;
      }

      return this.questdbService.query<OHLCRecord>(sql);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error querying OHLC data: ${errorMessage}`);
      throw new HttpException(
        'Failed to query OHLC data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get the latest OHLC record for a token
   */
  async getLatestOHLC(
    address: string,
    chainId?: number,
  ): Promise<OHLCRecord | null> {
    const result = await this.getOHLC({
      address,
      chainId,
      limit: 1,
      order: 'DESC',
    });

    return result.dataset.length > 0 ? result.dataset[0] : null;
  }

  /**
   * Get aggregated OHLC data (resampled to a specific interval)
   * Uses QuestDB's SAMPLE BY functionality
   */
  async getAggregatedOHLC(
    options: AggregatedOHLCOptions,
  ): Promise<QueryResult<OHLCRecord>> {
    try {
      const intervalMap: Record<string, string> = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '1h': '1h',
        '4h': '4h',
        '1d': '1d',
        '1w': '1w',
        '1M': '1M',
      };

      const sampleInterval = intervalMap[options.interval];

      let sql = `
        SELECT 
          address,
          chain_id,
          first(open) as open,
          max(high) as high,
          min(low) as low,
          last(close) as close,
          sum(volume) as volume,
          timestamp
        FROM ${this.tableName}
        WHERE address = '${options.address.toLowerCase()}'
      `;

      if (options.chainId !== undefined) {
        sql += ` AND chain_id = ${options.chainId}`;
      }

      if (options.fromTimestamp) {
        sql += ` AND timestamp >= '${options.fromTimestamp}'`;
      }

      if (options.toTimestamp) {
        sql += ` AND timestamp <= '${options.toTimestamp}'`;
      }

      sql += ` SAMPLE BY ${sampleInterval} ALIGN TO CALENDAR`;

      if (options.order) {
        sql += ` ORDER BY timestamp ${options.order}`;
      }

      if (options.limit) {
        sql += ` LIMIT ${options.limit}`;
      }

      return this.questdbService.query<OHLCRecord>(sql);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error querying aggregated OHLC data: ${errorMessage}`);
      throw new HttpException(
        'Failed to query aggregated OHLC data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get price change statistics for a token
   */
  async getPriceStats(
    address: string,
    chainId?: number,
    fromTimestamp?: string,
  ): Promise<{
    firstPrice: number;
    lastPrice: number;
    highPrice: number;
    lowPrice: number;
    priceChange: number;
    priceChangePercent: number;
    totalVolume: number;
  } | null> {
    try {
      let sql = `
        SELECT 
          first(open) as first_price,
          last(close) as last_price,
          max(high) as high_price,
          min(low) as low_price,
          sum(volume) as total_volume
        FROM ${this.tableName}
        WHERE address = '${address.toLowerCase()}'
      `;

      if (chainId !== undefined) {
        sql += ` AND chain_id = ${chainId}`;
      }

      if (fromTimestamp) {
        sql += ` AND timestamp >= '${fromTimestamp}'`;
      }

      const result = await this.questdbService.query<{
        first_price: number;
        last_price: number;
        high_price: number;
        low_price: number;
        total_volume: number;
      }>(sql);

      if (
        result.dataset.length === 0 ||
        result.dataset[0].first_price === null
      ) {
        return null;
      }

      const data = result.dataset[0];
      const priceChange = data.last_price - data.first_price;
      const priceChangePercent =
        data.first_price !== 0 ? (priceChange / data.first_price) * 100 : 0;

      return {
        firstPrice: data.first_price,
        lastPrice: data.last_price,
        highPrice: data.high_price,
        lowPrice: data.low_price,
        priceChange,
        priceChangePercent,
        totalVolume: data.total_volume,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error getting price stats: ${errorMessage}`);
      throw new HttpException(
        'Failed to get price statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create the OHLC prices table if it doesn't exist
   * Note: Run this manually or in a migration script
   */
  async createTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        address SYMBOL capacity 256 CACHE,
        chain_id INT,
        open DOUBLE,
        high DOUBLE,
        low DOUBLE,
        close DOUBLE,
        volume DOUBLE,
        timestamp TIMESTAMP
      ) timestamp(timestamp) PARTITION BY YEAR WAL;
    `;

    try {
      await this.questdbService.query(sql);
      this.logger.log(`Table ${this.tableName} created or already exists`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error creating table: ${errorMessage}`);
      throw new HttpException(
        'Failed to create OHLC table',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
