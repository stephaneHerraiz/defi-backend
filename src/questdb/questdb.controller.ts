import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QuestdbService, RowData, QueryResult } from './questdb.service';
import { Public } from 'src/ethereum/guards/public.decorator';

/**
 * DTO for inserting generic row data
 */
class InsertRowDto {
  table: string;
  symbols?: Record<string, string>;
  columns?: Record<string, number | string | boolean>;
  timestamp?: number;
}

/**
 * DTO for inserting multiple rows
 */
class InsertRowsDto {
  rows: InsertRowDto[];
}

/**
 * DTO for executing a custom SQL query
 */
class QueryDto {
  sql: string;
}

@Controller('questdb')
export class QuestdbController {
  constructor(private readonly questdbService: QuestdbService) {}

  /**
   * GET /questdb/health
   * Check QuestDB health status
   */
  @Public()
  @Get('health')
  async healthCheck(): Promise<{ status: string; message: string }> {
    return this.questdbService.healthCheck();
  }

  /**
   * GET /questdb/tables
   * Get list of all tables in QuestDB
   */
  @Get('tables')
  async getTables(): Promise<QueryResult<{ table_name: string }>> {
    return this.questdbService.getTables();
  }

  /**
   * GET /questdb/tables/:name/columns
   * Get columns/schema of a specific table
   */
  @Get('tables/:name/columns')
  async getTableColumns(
    @Query('name') name: string,
  ): Promise<QueryResult> {
    return this.questdbService.getTableColumns(name);
  }

  /**
   * POST /questdb/row
   * Insert a single generic row to any table
   */
  @Post('row')
  @HttpCode(HttpStatus.CREATED)
  async insertRow(@Body() row: InsertRowDto): Promise<{ success: boolean }> {
    await this.questdbService.insertRow(row as RowData);
    return { success: true };
  }

  /**
   * POST /questdb/rows
   * Insert multiple generic rows in batch
   */
  @Post('rows')
  @HttpCode(HttpStatus.CREATED)
  async insertRows(
    @Body() body: InsertRowsDto,
  ): Promise<{ success: boolean; count: number }> {
    await this.questdbService.insertRows(body.rows as RowData[]);
    return { success: true, count: body.rows.length };
  }

  /**
   * POST /questdb/query
   * Execute a custom SQL query (SELECT only for safety)
   */
  @Post('query')
  async executeQuery(@Body() body: QueryDto): Promise<QueryResult> {
    // Basic security: only allow SELECT queries
    const normalizedSql = body.sql.trim().toUpperCase();
    if (!normalizedSql.startsWith('SELECT') && !normalizedSql.startsWith('SHOW')) {
      throw new Error('Only SELECT and SHOW queries are allowed through this endpoint');
    }
    return this.questdbService.query(body.sql);
  }
}
