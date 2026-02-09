import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AaveMarketsService } from '../aave/services/aave-markets.service';
import { AaveUtils, AaveMarkets, AaveAsset } from '../aave/services/aave-utils';
import { CoingeckoService } from '../coingecko/coingecko.service';
import { HistoricalPriceDataService } from '../historical-price-data/historical-price-data.service';
import { OHLCData } from '../historical-price-data/interfaces/ohlc.interface';
import * as dayjs from 'dayjs';

interface DailyOHLC {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Injectable()
export class OhlcCronService {
  private readonly logger = new Logger(OhlcCronService.name);

  constructor(
    private readonly aaveMarketsService: AaveMarketsService,
    private readonly coingeckoService: CoingeckoService,
    private readonly historicalPriceDataService: HistoricalPriceDataService,
  ) {}

  /**
   * Cron job that runs every day at 3:00:00 AM
   * Fetches and stores the previous day's OHLC price for each reserve of each AAVE market
   */
  @Cron('0 0 3 * * *', {
    name: 'fetch-daily-ohlc',
    timeZone: 'UTC',
  })
  async handleDailyOHLCFetch(): Promise<void> {
    this.logger.log('Starting daily OHLC fetch for AAVE reserves...');

    try {
      const markets = await this.aaveMarketsService.findAll();
      this.logger.log(`Found ${markets.length} AAVE markets in database`);

      // Process each market
      for (const market of markets) {
        await this.processMarket(market.chain);
      }

      // Also process markets defined in AaveMarkets constant that might not be in DB
      for (const staticMarket of AaveMarkets) {
        const exists = markets.some((m) => m.chain === staticMarket.chain);
        if (!exists) {
          await this.processMarket(staticMarket.chain);
        }
      }

      this.logger.log('Daily OHLC fetch completed successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error during daily OHLC fetch: ${errorMessage}`);
    }
  }

  /**
   * Process a single AAVE market and fetch OHLC data for all its reserves
   */
  private async processMarket(chain: string): Promise<void> {
    this.logger.log(`Processing market: ${chain}`);

    try {
      const aaveUtils = new AaveUtils(chain);
      const marketInfo = aaveUtils.getMarketChainInfo() as {
        marketAddress: { CHAIN_ID: number };
      };
      const chainId: number = marketInfo.marketAddress.CHAIN_ID;
      const coingeckoPlatform = this.getCoingeckoPlatform(chain);

      // Get all assets from the market
      const assets = aaveUtils.assets as Record<string, AaveAsset>;

      for (const assetName in assets) {
        const asset = assets[assetName];
        const underlyingAddress: string = asset.UNDERLYING;

        if (!underlyingAddress) {
          this.logger.warn(`No underlying address for asset ${assetName}`);
          continue;
        }

        await this.fetchAndStoreOHLC(
          underlyingAddress,
          chainId,
          coingeckoPlatform,
          assetName,
        );

        // Add a small delay to avoid rate limiting on CoinGecko API
        await this.delay(500);
      }

      this.logger.log(`Completed processing market: ${chain}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error processing market ${chain}: ${errorMessage}`);
    }
  }

  /**
   * Fetch OHLC data from CoinGecko and store it in QuestDB
   */
  private async fetchAndStoreOHLC(
    address: string,
    chainId: number,
    platform: string,
    assetName: string,
  ): Promise<void> {
    try {
      // Find the coin on CoinGecko by address
      const coin = await this.coingeckoService.getCoinByAddress(
        address,
        platform,
      );

      if (!coin) {
        this.logger.warn(
          `Coin not found on CoinGecko for ${assetName} (${address}) on ${platform}`,
        );
        return;
      }

      // Fetch the last 2 days of data to get yesterday's OHLC
      const marketChart = await this.coingeckoService.getCoinMarketChart(
        coin.id,
        {
          vs_currency: 'usd',
          days: 2,
          interval: 'daily',
        },
      );

      if (!marketChart.prices || marketChart.prices.length < 2) {
        this.logger.warn(
          `Insufficient price data for ${assetName} (${coin.id})`,
        );
        return;
      }

      // Calculate yesterday's OHLC from the data
      const yesterdayOHLC = this.calculateYesterdayOHLC(marketChart);

      if (!yesterdayOHLC) {
        this.logger.warn(`Could not calculate OHLC for ${assetName}`);
        return;
      }

      // Get yesterday's date at 00:00:00 UTC
      const yesterday = dayjs().subtract(1, 'day').startOf('day');

      const ohlcData: OHLCData = {
        address: address.toLowerCase(),
        chainId,
        open: yesterdayOHLC.open,
        high: yesterdayOHLC.high,
        low: yesterdayOHLC.low,
        close: yesterdayOHLC.close,
        volume: yesterdayOHLC.volume,
        timestamp: yesterday.valueOf(),
      };

      await this.historicalPriceDataService.insertOHLC(ohlcData);

      this.logger.debug(
        `Stored OHLC for ${assetName}: O=${yesterdayOHLC.open.toFixed(4)}, H=${yesterdayOHLC.high.toFixed(4)}, L=${yesterdayOHLC.low.toFixed(4)}, C=${yesterdayOHLC.close.toFixed(4)}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error fetching OHLC for ${assetName} (${address}): ${errorMessage}`,
      );
    }
  }

  /**
   * Calculate yesterday's OHLC from CoinGecko market chart data
   * CoinGecko returns daily data points, so we extract the previous day's values
   */
  private calculateYesterdayOHLC(marketChart: {
    prices: [number, number][];
    total_volumes: [number, number][];
  }): DailyOHLC | null {
    const prices = marketChart.prices;
    const volumes = marketChart.total_volumes;

    if (prices.length < 2) {
      return null;
    }

    // For daily interval, CoinGecko returns one price per day
    // The second-to-last entry is yesterday's closing price
    // We use the data points to construct OHLC

    // Get yesterday's data (second to last for 2 days of data)
    const yesterdayIndex = prices.length - 2;

    // With daily interval, each point represents the price at that day
    // Open = price at start of day (approximated by previous close or first price)
    // Close = price at end of day
    // High/Low = approximated from available data

    const yesterdayPrice = prices[yesterdayIndex][1];
    const todayPrice = prices[prices.length - 1][1];

    // Since CoinGecko daily interval gives us one point per day,
    // we'll use that as the close price
    // For a more accurate OHLC, we could use hourly data
    const open = yesterdayPrice;
    const close = yesterdayPrice;
    const high = Math.max(yesterdayPrice, todayPrice);
    const low = Math.min(yesterdayPrice, todayPrice);

    const volume =
      volumes.length > yesterdayIndex ? volumes[yesterdayIndex][1] : 0;

    return {
      open,
      high,
      low,
      close,
      volume,
    };
  }

  /**
   * Map AAVE chain names to CoinGecko platform names
   */
  private getCoingeckoPlatform(chain: string): string {
    const platformMap: Record<string, string> = {
      Ethereum: 'ethereum',
      Polygon: 'polygon-pos',
      Arbitrum: 'arbitrum-one',
      Optimism: 'optimistic-ethereum',
      Avalanche: 'avalanche',
      ZkSync: 'zksync',
      Base: 'base',
      Gnosis: 'xdai',
      BNB: 'binance-smart-chain',
      Metis: 'metis-andromeda',
      Scroll: 'scroll',
    };

    return platformMap[chain] || chain.toLowerCase();
  }

  /**
   * Helper function to add delay between API calls
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Manual trigger for testing purposes
   */
  async triggerManualFetch(): Promise<void> {
    this.logger.log('Manual OHLC fetch triggered');
    await this.handleDailyOHLCFetch();
  }
}
