import { Test, TestingModule } from '@nestjs/testing';
import { AaveMarketsService } from './aave-markets.service';

describe('AaveMarketsService', () => {
  let service: AaveMarketsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AaveMarketsService],
    }).compile();

    service = module.get<AaveMarketsService>(AaveMarketsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
