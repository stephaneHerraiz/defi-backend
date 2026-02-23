import { Controller, Get, Query, Param } from '@nestjs/common';
import { HistoricalPriceDataService } from './historical-price-data.service';
import { OHLCRecord } from './interfaces/ohlc.interface';
import { QueryResult } from '../questdb/questdb.service';
import { Public } from '../ethereum/guards/public.decorator';

@Controller('historical-price-data')
export class HistoricalPriceDataController {
  constructor(
    private readonly historicalPriceDataService: HistoricalPriceDataService,
  ) {}

  /**
   * GET /historical-price-data/ohlc/:address
   * Get OHLC data for a specific token address
   */
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
   * GET /historical-price-data/ohlc/:address/bollinger/latest
   * Get the latest Bollinger Bands for a token
   */
  @Get('ohlc/:address/bollinger/latest')
  async getMonthlyBollingerBands(
    @Param('address') address: string,
    @Query('chainId') chainId: number,
    @Query('limit') limit?: number,
    @Query('stdDev') stdDev?: number,
  ): Promise<{ lower: number; middle: number; upper: number } | undefined> {
    return this.historicalPriceDataService.getMonthlyBollingerBands(
      address,
      chainId,
      limit,
      stdDev,
    );
  }
}
