import {
  ComputedUserReserve,
  FormatReserveUSDResponse,
  FormatUserSummaryResponse,
} from '@aave/math-utils';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { request } from 'graphql-request';
import { BollingerBands } from '@debut/indicators';
import { AaveMarketStatusEntity } from '../entities/aave-market-status.entity';
import { GET_USER_TRANSACTIONS } from '../gql/user-transactions.gql';
import { AccountInterface } from '../interfaces/account.interface';
import { AaveUtils } from './aave-utils';
import { UserTransactionsResponse } from '../interfaces/user-transaction.interface';
import { AccountEntity } from '../entities/accounts.entity';
import { AaveMarketsService } from './aave-markets.service';
import { ReserveDataHumanized } from '@aave/contract-helpers';
import { CoingeckoService } from '../../coingecko/coingecko.service';
import * as dayjs from 'dayjs';
import { HistoricalPriceDataService } from 'src/historical-price-data/historical-price-data.service';

const AAVE_SUBGRAPH_API_KEY = 'a5133c74a7c022d407d40bfc277e1aa4';

@Injectable()
export class AaveMarketStatusService {
  constructor(
    @InjectRepository(AaveMarketStatusEntity)
    private aaveMarketStatusRepository: Repository<AaveMarketStatusEntity>,
    private readonly aaveMarketsService: AaveMarketsService,
    private readonly coingeckoService: CoingeckoService,
    private readonly historicalPriceDataService: HistoricalPriceDataService,
  ) {}

  async findAll(
    accountAddress?: string,
    marketChain?: string,
  ): Promise<AaveMarketStatusEntity[]> {
    let options: FindManyOptions<AaveMarketStatusEntity> = {
      relations: {
        market: true,
        account: true,
      },
      order: {
        created_at: 'ASC',
      },
    };
    if (accountAddress) {
      options.relations = {
        ...options.relations,
        account: false,
      };
      options.where = {
        account: {
          address: accountAddress,
        },
      };
    }
    if (marketChain) {
      options.relations = {
        ...options.relations,
        market: false,
      };
      options.where = {
        ...options.where,
        market: {
          chain: marketChain,
        },
      };
    }

    return await this.aaveMarketStatusRepository.find(options);
  }

  async getUserReserves(
    accountAddress: AccountEntity,
    marketChain: string,
  ): Promise<FormatUserSummaryResponse> {
    const utils = new AaveUtils(marketChain);
    await utils.fetchContractData(accountAddress);
    return utils.formatUserSummary();
  }

  async getUserTransactions(
    accountAddress: AccountInterface,
  ): Promise<UserTransactionsResponse> {
    try {
      const data = await request<UserTransactionsResponse>(
        'https://gateway.thegraph.com/api/subgraphs/id/DLuE98kEb5pQNXAcKFQGQgfSQ57Xdou4jnVbAEqMfy3B',
        GET_USER_TRANSACTIONS,
        {
          userAddress: accountAddress.address.toLowerCase(),
          first: 100,
          skip: 0,
        },
        {
          Authorization: `Bearer ${AAVE_SUBGRAPH_API_KEY}`,
        },
      );
      return data;
    } catch (error) {
      throw new Error(
        `Error fetching data from The Graph API. Please check your query and try again. ${error}`,
      );
    }
  }

  async getReserveStatus(accountAddress: AccountEntity, marketChain: string) {
    const market = await this.aaveMarketsService.find(marketChain);
    if (!market) {
      throw new Error(`Market not found for chain ${marketChain}`);
    }
    const borrowReserves: ComputedUserReserve<
      ReserveDataHumanized & FormatReserveUSDResponse
    >[] = [];
    const collateralReserves: ComputedUserReserve<
      ReserveDataHumanized & FormatReserveUSDResponse
    >[] = [];
    const utils = new AaveUtils(market.chain);
    await utils.fetchContractData(accountAddress);
    const reserves = utils.getReserves();
    reserves.forEach((reserve) => {
      if (Number(reserve.totalBorrows) > 0) {
        borrowReserves.push(reserve);
      } else if (
        Number(reserve.underlyingBalance) > 0 &&
        reserve.usageAsCollateralEnabledOnUser
      ) {
        collateralReserves.push(reserve);
      }
    });

    let totalBorrowsUSD = 0;
    borrowReserves.forEach((reserve) => {
      totalBorrowsUSD += Number(reserve.totalBorrowsUSD);
    });

    const reserveStatus: {
      reserve: ComputedUserReserve<
        ReserveDataHumanized & FormatReserveUSDResponse
      >;
      bb:
        | {
            lower: number;
            middle: number;
            upper: number;
          }
        | undefined;
    }[] = [];

    let lowerHealthFactor = 0;

    for (const reserve of collateralReserves) {
      const bbres = await this.getMounthlyBB(
        reserve.underlyingAsset,
        utils.market.marketAddress.CHAIN_ID,
      );
      if (bbres && bbres.lower > 0) {
        const lowerBBBalanceUSD = Number(reserve.underlyingBalance) * bbres.lower;
        lowerHealthFactor += lowerBBBalanceUSD * Number(reserve.reserve.formattedReserveLiquidationThreshold);
      }

      reserveStatus.push({
        bb: bbres,
        reserve,
      });
    }
    lowerHealthFactor = lowerHealthFactor / totalBorrowsUSD;
    return { lowerHealthFactor, reserveStatus };
  }

  private async getMounthlyBB(
    assetAddress: string,
    chainId: number,
  ): Promise<{ lower: number; middle: number; upper: number } | undefined> {
    const tokenMarketChart =
      await this.historicalPriceDataService.getAggregatedOHLC({
        address: assetAddress,
        interval: '1M',
        chainId: chainId,
        limit: 20,
        toTimestamp: dayjs().startOf('month').toISOString(),
        order: 'DESC',
      });

    let bbres: { lower: number; middle: number; upper: number } | undefined;
    const bb = new BollingerBands(20, 2);
    tokenMarketChart.dataset.reverse().forEach((price) => {
      bbres = bb.nextValue(price.close);
    });
    return bbres;
  }
}
