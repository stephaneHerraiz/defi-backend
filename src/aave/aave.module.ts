import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AaveMarketEntity } from './entities/aave-market.entity';
import { AaveMarketStatusEntity } from './entities/aave-market-status.entity';
import { AaveMarketsService } from './services/aave-markets.service';
import { AaveMarketStatusService } from './services/aave-market-status.service';
import { AaveMarketController } from './aave-markets.controller';
import { JwtModule } from '@nestjs/jwt';
import { EthereumModule } from 'src/ethereum/ethereum.module';
import { CoingeckoModule } from '../coingecko/coingecko.module';
import { HistoricalPriceDataModule } from 'src/historical-price-data/historical-price-data.module';
import { RiskManagementService } from './services/risk-management.service';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AaveMarketEntity,
      AaveMarketStatusEntity,
    ]),
    EthereumModule,
    JwtModule,
    CoingeckoModule,
    HistoricalPriceDataModule,
    AccountsModule,
  ],
  controllers: [AaveMarketController],
  providers: [
    AaveMarketsService,
    AaveMarketStatusService,
    RiskManagementService,
  ],
})
export class AaveModule {}
