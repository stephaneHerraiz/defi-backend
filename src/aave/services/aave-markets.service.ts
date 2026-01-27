import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AaveMarketEntity } from '../entities/aave-market.entity';

@Injectable()
export class AaveMarketsService {
  constructor(
    @InjectRepository(AaveMarketEntity)
    private aaveMarketRepository: Repository<AaveMarketEntity>,
  ) {}

  async findAll(): Promise<AaveMarketEntity[]> {
    return await this.aaveMarketRepository.find();
  }
}
