# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Development (watch mode)
npm run start:dev

# Build
npm run build

# Production
npm run start:prod

# Lint (with auto-fix)
npm run lint

# Format
npm run format

# Tests
npm run test              # Unit tests
npm run test:watch        # Watch mode
npm run test:cov          # Coverage
npm run test:e2e          # E2E tests (test/*.e2e-spec.ts)
```

## Architecture

NestJS 11 backend (TypeScript, ES2023, CommonJS) serving as a DeFi aggregation API. Ethereum signature-based authentication (Web3 nonces + JWT). AuthGuard is applied globally — use `@Public()` decorator to bypass.

### Modules

- **EthereumModule** — Wallet signature verification, nonce management, JWT auth
- **AaveModule** — Multi-chain Aave protocol integration (ZkSync, Polygon, Arbitrum, Base, Ethereum, Optimism). Market data, user positions, risk management (EWMA volatility, stressed correlations, VaR, systemic liquidation prices)
- **CoingeckoModule** — Price data from CoinGecko API, cached in Redis (24h TTL) and local file (`/storage/coingecko-coins-list.json`)
- **HistoricalPriceDataModule** — OHLC data stored in QuestDB, supports intervals (1m to 1w), aggregation, Bollinger Bands
- **CronModule** — Scheduled OHLC data collection via `@nestjs/schedule`
- **QuestdbModule** — QuestDB connection (PostgreSQL wire protocol)
- **TerminusModule** — Health checks at `GET /health`

### Data Flow

CoinGecko API → CronModule (scheduled fetch) → QuestDB (OHLC storage) → HistoricalPriceDataModule (queries/aggregation) → RiskManagementService (volatility, correlations, VaR)

Aave subgraph (GraphQL via graphql-request) → AaveMarketStatusService → Controllers

### Databases

- **PostgreSQL 16** — Users, accounts, Aave markets/status (TypeORM, entities in each module)
- **QuestDB 8.2** — Time-series OHLC data (raw SQL via pg driver, port 8812)
- **Redis 7** — CoinGecko coin list cache. In k8s: Redis master + slave sidecar

### Key Libraries

- `ethers` v5 for blockchain interaction
- `@aave/contract-helpers` + `@aave/math-utils` for Aave protocol math
- `graphql-request` for Aave subgraph queries
- `@debut/indicators` for technical analysis (Bollinger Bands)
- `bignumber.js` + `dayjs` for precision math and date handling

## Configuration

Environment variables in `.env` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | JWT signing |
| `DATABASE_HOST/PORT/USERNAME/PASSWORD/NAME` | PostgreSQL connection |
| `QUESTDB_HOST/PG_PORT/USERNAME/PASSWORD` | QuestDB connection |
| `COINGECKO_API_KEY` | CoinGecko API (optional) |
| `REDIS_HOST/PORT` or `REDIS_SOCKET_PATH` | Redis connection |
| `COINGECKO_CACHE_TTL` | Cache TTL in ms (default 86400000) |
| `PORT` | Server port (default 3000) |

## Deployment

- **Docker**: Multi-stage build (Node 20-alpine), runs as non-root user (nestjs:1001), port 3000
- **Kubernetes**: `k8s/deployment.yaml` — 1 replica, 128-512Mi memory, 100-500m CPU. Redis master in separate deployment (`k8s/redis.yaml`), Redis slave as sidecar in main pod

## Code Conventions

- ESLint 9 flat config with TypeScript type-checking + Prettier
- Single quotes, trailing commas everywhere
- Feature-based module structure: `src/<module>/services/`, `controllers/`, `entities/`, `interfaces/`, `gql/`
- TypeORM entities with `synchronize: true`
- Aave chain configs defined in `src/aave/services/aave-utils.ts`
