import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsController } from './accounts.controller';
import { AaveMarketEntity } from './entities/aave-market.entity';
import { AccountEntity } from './entities/accounts.entity';
import { AaveMarketStatusEntity } from './entities/aave-market-status.entity';
import { AccountsService } from './services/accounts.service';
import { AaveMarketsService } from './services/aave-markets.service';
import { AaveMarketStatusService } from './services/aave-market-status.service';
import { AaveMarketController } from './aave-markets.controller';
import { JwtModule } from '@nestjs/jwt';
import { EthereumModule } from 'src/ethereum/ethereum.module';
import { CoingeckoModule } from '../coingecko/coingecko.module';
import { HistoricalPriceDataModule } from 'src/historical-price-data/historical-price-data.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      AaveMarketEntity,
      AaveMarketStatusEntity,
    ]),
    EthereumModule,
    JwtModule,
    CoingeckoModule,
    HistoricalPriceDataModule,
  ],
  controllers: [AccountsController, AaveMarketController],
  providers: [AccountsService, AaveMarketsService, AaveMarketStatusService],
})
export class AaveModule {}
