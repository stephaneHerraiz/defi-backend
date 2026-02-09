import { Module } from '@nestjs/common';
import { HistoricalPriceDataService } from './historical-price-data.service';
import { HistoricalPriceDataController } from './historical-price-data.controller';

@Module({
  providers: [HistoricalPriceDataService],
  controllers: [HistoricalPriceDataController],
  exports: [HistoricalPriceDataService],
})
export class HistoricalPriceDataModule {}
