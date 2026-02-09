import { Controller, Get, Param, Query, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { CoingeckoService } from './coingecko.service';
import { CoinMarketChartParams, CoinMarketChartResponse } from './interfaces/coin-market-chart.interface';
import { Coin } from './interfaces/coin-list.interface';
import { Public } from 'src/ethereum/guards/public.decorator';

@Controller('coingecko')
export class CoingeckoController {
  constructor(private readonly coingeckoService: CoingeckoService) {}

  /**
   * GET /coingecko/coins/:id/market_chart
   * Get historical market data (price, market cap, volume) for a coin
   * 
   * @param id - Coin ID (e.g., 'bitcoin', 'ethereum')
   * @param vs_currency - Target currency (e.g., 'usd', 'eur')
   * @param days - Number of days (1, 7, 14, 30, 90, 180, 365, or 'max')
   * @param interval - Data interval ('daily' or 'hourly') - optional
   * @param precision - Price precision ('full' or number of decimals) - optional
   */
  @Get('coins/:id/market_chart')
  async getCoinMarketChart(
    @Param('id') id: string,
    @Query('vs_currency') vs_currency = 'usd',
    @Query('days') days: string | number = '7',
    @Query('interval') interval?: string,
    @Query('precision') precision?: string,
  ): Promise<CoinMarketChartResponse> {
    const params: CoinMarketChartParams = {
      vs_currency,
      days,
      ...(interval && { interval }),
      ...(precision && { precision }),
    };

    return this.coingeckoService.getCoinMarketChart(id, params);
  }

  /**
   * GET /coingecko/coins/list
   * Get list of all coins with id, name, and symbol
   * Uses caching with configurable TTL
   * 
   * @param refresh - Force refresh the cache (optional, default: false)
   */
  @Public()
  @Get('coins/list')
  async getCoinsList(@Query('refresh') refresh?: string): Promise<Coin[]> {
    const forceRefresh = refresh === 'true';
    return this.coingeckoService.getCoinsList(forceRefresh);
  }

  /**
   * GET /coingecko/tokens/:address/market_chart
   * Get historical market data for a token by its contract address
   * 
   * @param address - Token contract address
   * @param platform - Platform/blockchain name (e.g., 'ethereum', 'binance-smart-chain', 'polygon-pos')
   * @param vs_currency - Target currency (e.g., 'usd', 'eur')
   * @param days - Number of days (1, 7, 14, 30, 90, 180, 365, or 'max')
   * @param interval - Data interval ('daily' or 'hourly') - optional
   * @param precision - Price precision ('full' or number of decimals) - optional
   */
  @Get('tokens/:address/market_chart')
  async getTokenMarketChart(
    @Param('address') address: string,
    @Query('platform') platform: string,
    @Query('vs_currency') vs_currency = 'usd',
    @Query('days') days: string | number = '7',
    @Query('interval') interval?: string,
    @Query('precision') precision?: string,
  ): Promise<CoinMarketChartResponse> {
    const params: CoinMarketChartParams = {
      vs_currency,
      days,
      ...(interval && { interval }),
      ...(precision && { precision }),
    };

    return this.coingeckoService.getTokenMarketChart(address, platform, params);
  }

  /**
   * GET /coingecko/cache/info
   * Get information about the current cache state
   */
  @Get('cache/info')
  async getCacheInfo() {
    return this.coingeckoService.getCacheInfo();
  }

  /**
   * DELETE /coingecko/cache
   * Clear the coin list cache
   */
  @Delete('cache')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearCache(): Promise<void> {
    await this.coingeckoService.clearCache();
  }
}
