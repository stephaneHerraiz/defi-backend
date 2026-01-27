import { Test, TestingModule } from '@nestjs/testing';
import { EtherSignController } from './ether-sign.controller';

describe('EtherSignController', () => {
  let controller: EtherSignController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EtherSignController],
    }).compile();

    controller = module.get<EtherSignController>(EtherSignController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
