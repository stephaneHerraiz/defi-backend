import { Module } from '@nestjs/common';
import { CoingeckoService } from './coingecko.service';
import { CoingeckoController } from './coingecko.controller';

@Module({
  providers: [CoingeckoService],
  controllers: [CoingeckoController],
  exports: [CoingeckoService],
})
export class CoingeckoModule {}
