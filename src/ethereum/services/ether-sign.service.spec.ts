import { Test, TestingModule } from '@nestjs/testing';
import { EtherSignService } from './ether-sign.service';

describe('EtherSignService', () => {
  let service: EtherSignService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EtherSignService],
    }).compile();

    service = module.get<EtherSignService>(EtherSignService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
