import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { HistoricalPriceDataService } from './historical-price-data.service';
import { OHLCData, OHLCRecord } from './interfaces/ohlc.interface';
import { QueryResult } from '../questdb/questdb.service';
import { Public } from '../ethereum/guards/public.decorator';

/**
 * DTO for inserting a single OHLC record
 */
class InsertOHLCDto {
  address: string;
  chainId: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  timestamp?: number;
}

@Controller('historical-price-data')
export class HistoricalPriceDataController {
  constructor(
    private readonly historicalPriceDataService: HistoricalPriceDataService,
  ) {}

  /**
   * POST /historical-price-data/ohlc
   * Insert a single OHLC record
   */
  @Public()
  @Post('ohlc')
  @HttpCode(HttpStatus.CREATED)
  async insertOHLC(@Body() data: InsertOHLCDto): Promise<{ success: boolean }> {
    await this.historicalPriceDataService.insertOHLC(data as OHLCData);
    return { success: true };
  }

  /**
   * POST /historical-price-data/ohlc/batch
   * Insert multiple OHLC records
   */
  @Public()
  @Post('ohlc/batch')
  @HttpCode(HttpStatus.CREATED)
  async insertOHLCBatch(
    @Body() body: OHLCData[],
  ): Promise<{ success: boolean; count: number }> {
    await this.historicalPriceDataService.insertOHLCBatch(body);
    return { success: true, count: body.length };
  }

  /**
   * GET /historical-price-data/ohlc/:address
   * Get OHLC data for a specific token address
   */
  @Public()
  @Get('ohlc/:address')
  async getOHLC(
    @Param('address') address: string,
    @Query('chainId') chainId?: string,
    @Query('from') fromTimestamp?: string,
    @Query('to') toTimestamp?: string,
    @Query('limit') limit?: string,
    @Query('order') order?: 'ASC' | 'DESC',
  ): Promise<QueryResult<OHLCRecord>> {
    return this.historicalPriceDataService.getOHLC({
      address,
      chainId: chainId ? parseInt(chainId, 10) : undefined,
      fromTimestamp,
      toTimestamp,
      limit: limit ? parseInt(limit, 10) : undefined,
      order,
    });
  }

  /**
   * GET /historical-price-data/ohlc/:address/latest
   * Get the latest OHLC record for a token
   */
  @Public()
  @Get('ohlc/:address/latest')
  async getLatestOHLC(
    @Param('address') address: string,
    @Query('chainId') chainId?: string,
  ): Promise<OHLCRecord | null> {
    return this.historicalPriceDataService.getLatestOHLC(
      address,
      chainId ? parseInt(chainId, 10) : undefined,
    );
  }

  /**
   * GET /historical-price-data/ohlc/:address/aggregated
   * Get aggregated OHLC data (candlestick data) for a specific interval
   */
  @Public()
  @Get('ohlc/:address/aggregated')
  async getAggregatedOHLC(
    @Param('address') address: string,
    @Query('interval')
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' = '1h',
    @Query('chainId') chainId?: string,
    @Query('from') fromTimestamp?: string,
    @Query('to') toTimestamp?: string,
    @Query('limit') limit?: string,
    @Query('order') order?: 'ASC' | 'DESC',
  ): Promise<QueryResult<OHLCRecord>> {
    return this.historicalPriceDataService.getAggregatedOHLC({
      address,
      interval,
      chainId: chainId ? parseInt(chainId, 10) : undefined,
      fromTimestamp,
      toTimestamp,
      limit: limit ? parseInt(limit, 10) : undefined,
      order,
    });
  }

  /**
   * GET /historical-price-data/ohlc/:address/stats
   * Get price statistics for a token
   */
  @Public()
  @Get('ohlc/:address/stats')
  async getPriceStats(
    @Param('address') address: string,
    @Query('chainId') chainId?: string,
    @Query('from') fromTimestamp?: string,
  ): Promise<{
    firstPrice: number;
    lastPrice: number;
    highPrice: number;
    lowPrice: number;
    priceChange: number;
    priceChangePercent: number;
    totalVolume: number;
  } | null> {
    return this.historicalPriceDataService.getPriceStats(
      address,
      chainId ? parseInt(chainId, 10) : undefined,
      fromTimestamp,
    );
  }

  /**
   * POST /historical-price-data/setup
   * Create the OHLC table (admin endpoint)
   */
  @Post('setup')
  @HttpCode(HttpStatus.OK)
  async createTable(): Promise<{ success: boolean; message: string }> {
    await this.historicalPriceDataService.createTable();
    return { success: true, message: 'OHLC table created successfully' };
  }
}
