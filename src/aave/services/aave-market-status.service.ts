import {
  ComputedUserReserve,
  FormatReserveUSDResponse,
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
import {
  AaveUserBorrowsInterface,
  AaveUserSuppliesInterface,
} from '../interfaces/aave-user.interface';
import { GET_USER_SUPPLIES } from '../gql/getUserSupplies.gql';
import { GET_USER_BORROWS } from '../gql/getUserBorrows.gql';
import { GetMarketInterface } from '../interfaces/get-market.interface';
import { GET_MARKET } from '../gql/getMarket.gql';
import { MarketInterface } from '../interfaces/aave-market';

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

  async getUserTransactions(
    accountAddress: AccountInterface,
  ): Promise<UserTransactionsResponse> {
    try {
      const data = await request<UserTransactionsResponse>(
        'https://api.v3.aave.com/graphql',
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

  async getUserSupplies(
    chainId: number,
    marketAddress: string,
    accountAddress: string,
  ): Promise<AaveUserSuppliesInterface[]> {
    const data = await request<{ userSupplies: AaveUserSuppliesInterface[] }>(
      'https://api.v3.aave.com/graphql',
      GET_USER_SUPPLIES,
      {
        request: {
          markets: [
            {
              chainId: chainId,
              address: marketAddress,
            },
          ],
          user: accountAddress.toLowerCase(),
        },
      },
      {
        Authorization: `Bearer ${AAVE_SUBGRAPH_API_KEY}`,
      },
    );
    if (!data || !data.userSupplies) {
      throw new Error('No supplies found for the given user and market chain');
    }
    return data.userSupplies;
  }

  async getMarket(
    chainId: number,
    marketAddress: string,
    accountAddress: string,
  ): Promise<MarketInterface> {
    try {
      const data = await request<GetMarketInterface>(
        'https://api.v3.aave.com/graphql',
        GET_MARKET,
        {
          request: {
            chainId: chainId,
            address: marketAddress,
            user: accountAddress.toLowerCase(),
          },
        },
        {
          Authorization: `Bearer ${AAVE_SUBGRAPH_API_KEY}`,
        },
      );
      return {
        userState: {
          totalDebtBase: data.market.userState.totalDebtBase,
        },
        reserves: data.market.reserves.map((reserve) => ({
          supplyInfo: {
            liquidationThreshold: reserve.supplyInfo.liquidationThreshold.value,
          },
          underlyingToken: {
            address: reserve.underlyingToken.address,
            imageUrl: reserve.underlyingToken.imageUrl,
            name: reserve.underlyingToken.name,
            decimals: reserve.underlyingToken.decimals,
            symbol: reserve.underlyingToken.symbol,
          },
        })),
      };
    } catch (error) {
      throw new Error(
        `Error fetching data from The Graph API. Please check your query and try again. ${error}`,
      );
    }
  }

  async getUserBorrows(
    chainId: number,
    marketAddress: string,
    accountAddress: string,
  ): Promise<AaveUserBorrowsInterface[]> {
    const data = await request<{ userBorrows: AaveUserBorrowsInterface[] }>(
      'https://gateway.thegraph.com/api/subgraphs/id/DLuE98kEb5pQNXAcKFQGQgfSQ57Xdou4jnVbAEqMfy3B',
      GET_USER_BORROWS,
      {
        request: {
          markets: [
            {
              chainId: chainId,
              address: marketAddress,
            },
          ],
          user: accountAddress.toLowerCase(),
        },
      },
      {
        Authorization: `Bearer ${AAVE_SUBGRAPH_API_KEY}`,
      },
    );
    if (!data || !data.userBorrows) {
      throw new Error('No borrows found for the given user and market chain');
    }
    return data.userBorrows;
  }
}
