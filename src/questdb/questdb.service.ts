import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Pool, PoolClient, types } from 'pg';
import { QUESTDB_OPTIONS } from './questdb.constants';
import { QuestdbModuleOptions } from './questdb.module';

/**
 * Interface for generic row data insertion
 */
export interface RowData {
  table: string;
  symbols?: Record<string, string>;
  columns?: Record<string, number | string | boolean | bigint>;
  timestamp?: number; // Unix timestamp in milliseconds
}

/**
 * Interface for QuestDB query result
 */
export interface QueryResult<T = Record<string, unknown>> {
  dataset: T[];
  count: number;
}

@Injectable()
export class QuestdbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QuestdbService.name);
  private pool!: Pool;

  constructor(
    @Inject(QUESTDB_OPTIONS) private readonly options: QuestdbModuleOptions,
  ) {
    const { host, pgPort, username, password } = this.options;

    // Prevent automatic timezone conversion for timestamps
    // Return raw string values instead of Date objects
    types.setTypeParser(types.builtins.TIMESTAMP, (val) => val);
    types.setTypeParser(types.builtins.TIMESTAMPTZ, (val) => val);

    this.pool = new Pool({
      host,
      port: pgPort,
      user: username || 'admin',
      password: password || 'quest',
      database: 'qdb',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.logger.log(`QuestDB service initialized with host: ${host}:${pgPort}`);
  }

  async onModuleInit(): Promise<void> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();

      this.logger.log('QuestDB connection pool initialized');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to initialize QuestDB connection: ${errorMessage}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.pool.end();
      this.logger.log('QuestDB connection pool closed');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error closing QuestDB pool: ${errorMessage}`);
    }
  }

  /**
   * Insert a generic row of data to any table
   * Useful for custom data structures
   */
  async insertRow(data: RowData): Promise<void> {
    const columns: string[] = [];
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;

    // Add symbol columns
    if (data.symbols) {
      for (const [key, value] of Object.entries(data.symbols)) {
        columns.push(key);
        values.push(value);
        placeholders.push(`$${paramIndex++}`);
      }
    }

    // Add regular columns
    if (data.columns) {
      for (const [key, value] of Object.entries(data.columns)) {
        columns.push(key);
        values.push(typeof value === 'bigint' ? Number(value) : value);
        placeholders.push(`$${paramIndex++}`);
      }
    }

    // Add timestamp
    const timestamp = data.timestamp
      ? new Date(data.timestamp).toISOString()
      : new Date().toISOString();
    columns.push('timestamp');
    values.push(timestamp);
    placeholders.push(`$${paramIndex}`);

    const sql = `INSERT INTO ${data.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;

    try {
      await this.pool.query(sql, values);
      this.logger.debug(`Row inserted to table: ${data.table}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error inserting row: ${errorMessage}`);
      throw new HttpException(
        'Failed to insert row data',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Insert multiple rows of generic data
   */
  async insertRows(rows: RowData[]): Promise<void> {
    const client = await this.pool.connect();

    try {
      for (const data of rows) {
        const columns: string[] = [];
        const values: unknown[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        if (data.symbols) {
          for (const [key, value] of Object.entries(data.symbols)) {
            columns.push(key);
            values.push(value);
            placeholders.push(`$${paramIndex++}`);
          }
        }

        if (data.columns) {
          for (const [key, value] of Object.entries(data.columns)) {
            columns.push(key);
            values.push(typeof value === 'bigint' ? Number(value) : value);
            placeholders.push(`$${paramIndex++}`);
          }
        }

        const timestamp = data.timestamp
          ? new Date(data.timestamp).toISOString()
          : new Date().toISOString();
        columns.push('timestamp');
        values.push(timestamp);
        placeholders.push(`$${paramIndex}`);

        const sql = `INSERT INTO ${data.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
        await client.query(sql, values);
      }

      this.logger.debug(`Batch of ${rows.length} rows inserted`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error inserting rows batch: ${errorMessage}`);
      throw new HttpException(
        'Failed to insert rows batch',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      client.release();
    }
  }

  /**
   * Execute a SQL query against QuestDB using PostgreSQL wire protocol
   */
  async query<T = Record<string, unknown>>(sql: string): Promise<QueryResult<T>> {
    try {
      this.logger.debug(`Executing query: ${sql}`);

      const result = await this.pool.query(sql);

      return {
        dataset: result.rows as T[],
        count: result.rowCount || result.rows.length,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Query failed: ${errorMessage}`);
      throw new HttpException(
        'Failed to execute query on QuestDB',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get list of tables in QuestDB
   */
  async getTables(): Promise<QueryResult<{ table_name: string }>> {
    return this.query<{ table_name: string }>('SHOW TABLES');
  }

  /**
   * Get table schema/columns
   */
  async getTableColumns(tableName: string): Promise<
    QueryResult<{
      column: string;
      type: string;
      indexed: boolean;
      indexBlockCapacity: number;
      symbolCached: boolean;
      symbolCapacity: number;
      designated: boolean;
    }>
  > {
    return this.query(`SHOW COLUMNS FROM ${tableName}`);
  }

  /**
   * Check if QuestDB is healthy and accessible
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
    try {
      await this.query('SELECT 1');
      return { status: 'healthy', message: 'QuestDB is accessible' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'unhealthy', message: errorMessage };
    }
  }
}
