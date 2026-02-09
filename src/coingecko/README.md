# CoinGecko Module

This module provides integration with the CoinGecko API to fetch cryptocurrency data.

## Features

- **Get Coin Historical Market Data**: Fetch historical price, market cap, and volume data for any cryptocurrency
- **Get Coins List**: Retrieve a comprehensive list of all coins with ID, name, and symbol
- **File-Based Caching with TTL**: Coin list is cached in a JSON file with configurable Time-To-Live
- **Cache Management**: Clear cache manually or check cache status

## API Endpoints

### 1. Get Coin Market Chart
```
GET /coingecko/coins/:id/market_chart
```

Fetches historical market data (price, market cap, volume) for a specific coin.

**Parameters:**
- `id` (path) - Coin ID (e.g., 'bitcoin', 'ethereum')
- `vs_currency` (query) - Target currency, default: 'usd'
- `days` (query) - Number of days (1, 7, 14, 30, 90, 180, 365, or 'max'), default: '7'
- `interval` (query, optional) - Data interval ('daily' or 'hourly')
- `precision` (query, optional) - Price precision ('full' or number of decimals)

**Example:**
```bash
# Get Bitcoin price data for the last 7 days
curl http://localhost:3000/coingecko/coins/bitcoin/market_chart?vs_currency=usd&days=7

# Get Ethereum price data for 30 days with daily interval
curl http://localhost:3000/coingecko/coins/ethereum/market_chart?vs_currency=usd&days=30&interval=daily
```

**Response:**
```json
{
  "prices": [[1706534400000, 42580.5], [1706620800000, 43120.3]],
  "market_caps": [[1706534400000, 834000000000], [1706620800000, 845000000000]],
  "total_volumes": [[1706534400000, 25000000000], [1706620800000, 28000000000]]
}
```

### 2. Get Coins List
```
GET /coingecko/coins/list
```

Retrieves a list of all coins with their IDs, names, and symbols. Results are cached with TTL.

**Parameters:**
- `refresh` (query, optional) - Force refresh the cache ('true' or 'false'), default: 'false'

**Example:**
```bash
# Get coins list from cache (if available)
curl http://localhost:3000/coingecko/coins/list

# Force refresh the cache
curl http://localhost:3000/coingecko/coins/list?refresh=true
```

**Response:**
```json
[
  {
    "id": "bitcoin",
    "symbol": "btc",
    "name": "Bitcoin"
  },
  {
    "id": "ethereum",
    "symbol": "eth",
    "name": "Ethereum"
  }
]
```

### 3. Get Cache Info
```
GET /coingecko/cache/info
```

Returns information about the current cache state.

**Example:**
```bash
curl http://localhost:3000/coingecko/cache/info
```

**Response:**
```json
{
  "exists": true,
  "timestamp": 1706534400000,
  "expiresAt": 1706620800000,
  "isValid": true
}
```

### 4. Clear Cache
```
DELETE /coingecko/cache
```

Clears the coin list cache.

**Example:**
```bash
curl -X DELETE http://localhost:3000/coingecko/cache/info
```

**Response:** 204 No Content

## Configuration

Add the following environment variables to your `.env` file:

```env
# Optional: CoinGecko API Key (for higher rate limits)
COINGECKO_API_KEY=your_api_key_here

# Optional: Cache TTL in milliseconds (default: 24 hours)
COINGECKO_CACHE_TTL=86400000
```

### Configuration Options

- **COINGECKO_API_KEY**: Optional API key from CoinGecko. Get one at https://www.coingecko.com/en/api
- **COINGECKO_CACHE_TTL**: Cache Time-To-Live in milliseconds
  - Default: 86400000 (24 hours)
  - Example values:
    - 1 hour: 3600000
    - 6 hours: 21600000
    - 12 hours: 43200000
    - 24 hours: 86400000
    - 7 days: 604800000

## Cache Storage

The coin list is cached in a JSON file at:
```
/storage/coingecko-coins-list.json
```

The cache file includes:
- `data`: Array of coins
- `timestamp`: When the cache was created
- `expiresAt`: When the cache will expire

The cache is automatically:
- Created on first request
- Used for subsequent requests if still valid
- Refreshed when expired or when `refresh=true` is passed

## Using the Service in Your Code

You can inject the `CoingeckoService` into your own services:

```typescript
import { Injectable } from '@nestjs/common';
import { CoingeckoService } from './coingecko/coingecko.service';

@Injectable()
export class YourService {
  constructor(private readonly coingeckoService: CoingeckoService) {}

  async getEthereumPrice() {
    const data = await this.coingeckoService.getCoinMarketChart('ethereum', {
      vs_currency: 'usd',
      days: '1',
    });
    
    // Get latest price
    const latestPrice = data.prices[data.prices.length - 1][1];
    return latestPrice;
  }

  async getAllCoins() {
    return this.coingeckoService.getCoinsList();
  }
}
```

## API Documentation References

- [Coin Market Chart API](https://docs.coingecko.com/v3.0.1/reference/coins-id-market-chart)
- [Coins List API](https://docs.coingecko.com/v3.0.1/reference/coins-list)
