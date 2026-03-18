import { FormatUserSummaryResponse } from '@aave/math-utils';
import { Controller, Get, HttpStatus, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AaveMarketStatusEntity } from './entities/aave-market-status.entity';
import { AaveMarketEntity } from './entities/aave-market.entity';
import { AaveMarketStatusService } from './services/aave-market-status.service';
import { AaveMarketsService } from './services/aave-markets.service';
import { AccountsService } from './services/accounts.service';
import { Address } from 'src/ethereum/decorators/address.decorator';
import { Public } from 'src/ethereum/guards/public.decorator';
import { RiskManagementService } from './services/risk-management.service';

@Controller('aavemarkets')
export class AaveMarketController {
  constructor(
    private readonly aaveMarketStatusService: AaveMarketStatusService,
    private readonly aaveMarketService: AaveMarketsService,
    private readonly accountsService: AccountsService,
    private readonly riskManagementService: RiskManagementService,
  ) {}

  @Get()
  findAll(
    @Query('accountAddress') accountAddress: string,
    @Query('marketChain') marketChain: string,
  ): Promise<AaveMarketStatusEntity[]> {
    return this.aaveMarketStatusService.findAll(accountAddress, marketChain);
  }

  @Get('markets')
  findAllMarkets(): Promise<AaveMarketEntity[]> {
    return this.aaveMarketService.findAll();
  }

  @Get('transactions')
  async getUseTransactions(
    @Query('accountAddress') accountAddress: string,
    @Address() userAddress: string,
    @Res() res: Response,
  ) {
    const account = await this.accountsService.findOne(
      accountAddress,
      userAddress,
    );
    if (!account) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .send('Account not found. Please provide a valid account address.');
      return;
    }
    const result =
      await this.aaveMarketStatusService.getUserTransactions(account);
    res.status(HttpStatus.OK).send(result);
  }

  @Public()
  @Get('risk-management')
  async getRiskManagement(
    @Query('accountAddress') accountAddress: string,
    @Query('marketChain') marketChain: string,
    @Query('chainId') chainId: number,
    @Address() userAddress: string,
    @Res() res: Response,
  ): Promise<FormatUserSummaryResponse | undefined> {
    const account = await this.accountsService.findOne(
      accountAddress,
      userAddress,
    );
    if (!account) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .send('Account not found. Please provide a valid account address.');
      return;
    }
    const result = await this.riskManagementService.getPortfolioRisk(
      account.address,
      chainId,
      marketChain,
    );
    res.status(HttpStatus.OK).send(result);
  }
}
