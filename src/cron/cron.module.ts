import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OhlcCronService } from './ohlc-cron.service';
import { CoingeckoModule } from '../coingecko/coingecko.module';
import { HistoricalPriceDataModule } from '../historical-price-data/historical-price-data.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AaveMarketEntity } from '../aave/entities/aave-market.entity';
import { AaveMarketsService } from '../aave/services/aave-markets.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([AaveMarketEntity]),
    CoingeckoModule,
    HistoricalPriceDataModule,
  ],
  providers: [OhlcCronService, AaveMarketsService],
  exports: [OhlcCronService],
})
export class CronModule {}
