# QuestDB Module

This NestJS module provides integration with QuestDB, a high-performance time-series database, using the PostgreSQL wire protocol via the `pg` library.

## Features

- **Data Ingestion**: Uses PostgreSQL protocol for inserting data
- **Data Querying**: Uses PostgreSQL protocol for reading data with parameterized queries
- **Batch Operations**: Support for inserting multiple records in a single operation
- **Connection Pooling**: Efficient connection management with pg Pool
- **Health Checks**: Built-in health check endpoint
- **Generic Row Insertion**: Flexible API for inserting data to any table structure

## Configuration

Add the following environment variables to your `.env` file:

```env
# QuestDB Configuration
QUESTDB_HOST=localhost
QUESTDB_PG_PORT=8812
QUESTDB_USERNAME=admin
QUESTDB_PASSWORD=quest
```

## Usage

### Import the Module

```typescript
import { QuestdbModule } from './questdb/questdb.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    QuestdbModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>('QUESTDB_HOST', 'localhost'),
        pgPort: configService.get<number>('QUESTDB_PG_PORT', 8812),
        username: configService.get<string>('QUESTDB_USERNAME', 'admin'),
        password: configService.get<string>('QUESTDB_PASSWORD', 'quest'),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### Inject the Service

```typescript
import { QuestdbService } from './questdb/questdb.service';

@Injectable()
export class MyService {
  constructor(private readonly questdbService: QuestdbService) {}
}
```

### Insert Trade Data

```typescript
// Single trade
await this.questdbService.insertTrade({
  symbol: 'ETH-USD',
  side: 'buy',
  price: 2615.54,
  amount: 0.5,
  timestamp: Date.now(), // Optional
});

// Batch insert
await this.questdbService.insertTrades([
  { symbol: 'ETH-USD', side: 'buy', price: 2615.54, amount: 0.5 },
  { symbol: 'BTC-USD', side: 'sell', price: 39269.98, amount: 0.001 },
]);
```

### Insert Generic Row Data

```typescript
// Flexible row insertion for any table
await this.questdbService.insertRow({
  table: 'metrics',
  symbols: { host: 'server1', region: 'us-east' },
  columns: {
    cpu_usage: 45.5,
    memory_usage: 72.3,
    disk_free: 1024000,
    is_healthy: true,
  },
  timestamp: Date.now(),
});
```

### Query Data

```typescript
// Get trades with filters
const trades = await this.questdbService.getTrades({
  symbol: 'ETH-USD',
  side: 'buy',
  limit: 100,
  fromTimestamp: '2024-01-01T00:00:00Z',
});

// Execute custom SQL query
const result = await this.questdbService.query('SELECT * FROM trades WHERE symbol = \'ETH-USD\' ORDER BY timestamp DESC LIMIT 10');

// Get all tables
const tables = await this.questdbService.getTables();

// Get table schema
const columns = await this.questdbService.getTableColumns('trades');
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/questdb/health` | Health check (public) |
| GET | `/questdb/tables` | List all tables |
| GET | `/questdb/tables/:name/columns` | Get table schema |
| POST | `/questdb/trade` | Insert single trade |
| POST | `/questdb/trades` | Insert multiple trades |
| GET | `/questdb/trades` | Query trades with filters |
| POST | `/questdb/row` | Insert generic row |
| POST | `/questdb/rows` | Insert multiple rows |
| POST | `/questdb/query` | Execute SQL query (SELECT/SHOW only) |

## QuestDB Data Types

When inserting data, the module maps JavaScript types to QuestDB types:

| JavaScript Type | QuestDB Type |
|-----------------|--------------|
| `number` | `DOUBLE` |
| `string` | `STRING` / `SYMBOL` |
| `boolean` | `BOOLEAN` |
| `bigint` | `LONG` |

## Best Practices

1. **Use parameterized queries** - The service uses parameterized queries to prevent SQL injection
2. **Include timestamps** when possible to leverage QuestDB's time-series optimizations
3. **Batch inserts** when inserting multiple rows for better performance
4. **Use LATEST ON** queries for getting the most recent value per partition
5. **Create tables beforehand** - Define your table schema in QuestDB before inserting data

## Running QuestDB

Using Docker:

```bash
docker run -p 9000:9000 -p 9009:9009 -p 8812:8812 questdb/questdb
```

Ports:
- `9000`: HTTP API (REST queries)
- `9009`: ILP over TCP
- `8812`: PostgreSQL wire protocol (used by this module)
