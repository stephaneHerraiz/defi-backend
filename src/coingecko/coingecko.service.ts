import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  CoinMarketChartResponse,
  CoinMarketChartParams,
} from './interfaces/coin-market-chart.interface';
import { Coin } from './interfaces/coin-list.interface';

@Injectable()
export class CoingeckoService {
  private readonly logger = new Logger(CoingeckoService.name);
  private readonly baseUrl = 'https://api.coingecko.com/api/v3';
  private readonly cacheKey = 'coingecko:coins-list';
  private readonly cacheTTL: number; // in milliseconds
  private apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    // Default TTL: 24 hours (in milliseconds)
    this.cacheTTL = this.configService.get<number>(
      'COINGECKO_CACHE_TTL',
      24 * 60 * 60 * 1000,
    );
    this.apiKey = this.configService.get<string>('COINGECKO_API_KEY', '');
  }

  /**
   * Make HTTP request to CoinGecko API
   */
  private async makeRequest<T>(
    endpoint: string,
    params?: Record<string, any>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    // Add API key if available
    if (this.apiKey) {
      url.searchParams.append('x_cg_demo_api_key', this.apiKey);
    }

    try {
      this.logger.debug(`Making request to: ${url.toString()}`);
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `CoinGecko API error: ${response.status} - ${errorText}`,
        );
        throw new HttpException(
          `CoinGecko API error: ${response.statusText}`,
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Request failed: ${error.message}`);
      throw new HttpException(
        'Failed to fetch data from CoinGecko',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get coin historical market data by ID
   * @param coinId - The coin ID (e.g., 'bitcoin', 'ethereum')
   * @param params - Query parameters for the market chart
   * @returns Historical price, market cap, and volume data
   */
  async getCoinMarketChart(
    coinId: string,
    params: CoinMarketChartParams,
  ): Promise<CoinMarketChartResponse> {
    this.logger.log(`Fetching market chart for coin: ${coinId}`);

    const endpoint = `/coins/${coinId}/market_chart`;
    const queryParams = {
      vs_currency: params.vs_currency,
      days: String(params.days),
      ...(params.interval && { interval: params.interval }),
      ...(params.precision && { precision: params.precision }),
    };

    return this.makeRequest<CoinMarketChartResponse>(endpoint, queryParams);
  }

  /**
   * Get list of all coins with id, name, and symbol
   * Uses Redis caching with TTL
   * @param forceRefresh - Force refresh the cache
   * @returns List of all coins
   */
  async getCoinsList(forceRefresh = false): Promise<Coin[]> {
    this.logger.log('Fetching coins list');

    // Check cache first unless force refresh is requested
    if (!forceRefresh) {
      const cachedData = await this.cacheManager.get<Coin[]>(this.cacheKey);
      if (cachedData) {
        this.logger.log('Using cached coin list from Redis');
        return cachedData;
      }
    }

    // Fetch fresh data from API
    this.logger.log('Fetching fresh coin list from CoinGecko API');
    const endpoint = '/coins/list';
    const coins = await this.makeRequest<Coin[]>(endpoint, {
      include_platform: 'true',
    });

    // Cache the result in Redis
    await this.cacheManager.set(this.cacheKey, coins, this.cacheTTL);
    this.logger.log('Coin list cached successfully in Redis');

    return coins;
  }

  async getCoinByAddress(
    address: string,
    platform: string,
  ): Promise<Coin | undefined> {
    const coins = await this.getCoinsList();
    const coin = coins.find(
      (c) =>
        c.platforms &&
        c.platforms[platform.toLowerCase()]?.toLowerCase() ===
          address.toLowerCase(),
    );
    return coin;
  }

  /**
   * Get historical market data for a token by its contract address
   * @param address - Token contract address
   * @param platform - Platform/blockchain name (e.g., 'ethereum', 'binance-smart-chain')
   * @param params - Query parameters for the market chart
   * @returns Historical price, market cap, and volume data
   */
  async getTokenMarketChart(
    address: string,
    platform: string,
    params: CoinMarketChartParams,
  ): Promise<CoinMarketChartResponse> {
    this.logger.log(
      `Fetching market chart for token: ${address} on ${platform}`,
    );

    // First, find the coin by address
    const coin = await this.getCoinByAddress(address, platform);

    if (!coin) {
      throw new HttpException(
        `Token not found for address ${address} on platform ${platform}`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Then fetch the market chart using the coin ID
    return this.getCoinMarketChart(coin.id, params);
  }

  /**
   * Clear the coin list cache
   */
  async clearCache(): Promise<void> {
    try {
      await this.cacheManager.del(this.cacheKey);
      this.logger.log('Cache cleared successfully from Redis');
    } catch (error) {
      this.logger.error(`Failed to clear cache: ${(error as any).message}`);
      throw new HttpException(
        'Failed to clear cache',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get cache information
   */
  async getCacheInfo(): Promise<{
    exists: boolean;
    ttl?: number;
  }> {
    try {
      const cachedData = await this.cacheManager.get<Coin[]>(this.cacheKey);
      if (cachedData) {
        return {
          exists: true,
          ttl: this.cacheTTL,
        };
      }
      return { exists: false };
    } catch (error) {
      return { exists: false };
    }
  }
}
