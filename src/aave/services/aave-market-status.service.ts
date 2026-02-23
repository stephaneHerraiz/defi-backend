import {
  ComputedUserReserve,
  FormatReserveUSDResponse,
  FormatUserSummaryResponse,
} from '@aave/math-utils';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { request } from 'graphql-request';
import { AaveMarketStatusEntity } from '../entities/aave-market-status.entity';
import { GET_USER_TRANSACTIONS } from '../gql/user-transactions.gql';
import { AccountInterface } from '../interfaces/account.interface';
import { AaveUtils } from './aave-utils';
import { UserTransactionsResponse } from '../interfaces/user-transaction.interface';
import { AccountEntity } from '../entities/accounts.entity';
import { AaveMarketsService } from './aave-markets.service';
import { ReserveDataHumanized } from '@aave/contract-helpers';
import { CoingeckoService } from '../../coingecko/coingecko.service';
import { HistoricalPriceDataService } from 'src/historical-price-data/historical-price-data.service';

const AAVE_SUBGRAPH_API_KEY = 'a5133c74a7c022d407d40bfc277e1aa4';

export interface AAveReserveStatus {
  id: string;
  underlyingAsset: string;
  name: string;
  symbol: string;
  decimals: number;
  underlyingBalance: number;
  monthlyBB?: {
    lower: number;
    middle: number;
    upper: number;
  };
}

export interface AaveMarketStatus {
  totalBorrowsUSD: number;
  monthlyBBScenario: lowerBollingerBandScenario;
}

export interface lowerBollingerBandScenario {
  healthFactor: number;
  maximumBorrowPower: number;
  liquidationBorrowPower: number;
  reserveStatusList: AAveReserveStatus[];
}

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
    const options: FindManyOptions<AaveMarketStatusEntity> = {
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

  async getMarketStatus(
    accountAddress: AccountEntity,
    marketChain: string,
  ): Promise<AaveMarketStatus> {
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

    const reserveStatusList: AAveReserveStatus[] = [];

    let totalLowerBBBalanceUSD = 0;

    for (const reserve of collateralReserves) {
      const bbres =
        await this.historicalPriceDataService.getMonthlyBollingerBands(
          reserve.underlyingAsset,
          market.chainid,
        );
      if (bbres) {
        if (bbres.lower < 0) {
          bbres.lower = 0;
        }
        if (bbres.lower > 0) {
          const lowerBBBalanceUSD =
            Number(reserve.underlyingBalance) * bbres.lower;
          totalLowerBBBalanceUSD +=
            lowerBBBalanceUSD *
            Number(reserve.reserve.formattedReserveLiquidationThreshold);
        }
      }

      const reserveStatus: AAveReserveStatus = {
        id: reserve.reserve.id,
        underlyingAsset: reserve.underlyingAsset,
        name: reserve.reserve.name,
        symbol: reserve.reserve.symbol,
        decimals: reserve.reserve.decimals,
        underlyingBalance: Number(reserve.underlyingBalance),
      };

      if (bbres) {
        reserveStatus.monthlyBB = {
          lower: bbres.lower,
          middle: bbres.middle,
          upper: bbres.upper,
        };
      }

      reserveStatusList.push(reserveStatus);
    }
    const lowerMonthlyBBHealthFactor = totalLowerBBBalanceUSD / totalBorrowsUSD;
    const maximumBorrowPowerUSD = totalLowerBBBalanceUSD / 1.2;
    return {
      totalBorrowsUSD,
      monthlyBBScenario: {
        healthFactor: lowerMonthlyBBHealthFactor,
        maximumBorrowPower: maximumBorrowPowerUSD,
        liquidationBorrowPower: totalLowerBBBalanceUSD,
        reserveStatusList,
      },
    };
  }
}
