import { FormatUserSummaryResponse } from '@aave/math-utils';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { request } from 'graphql-request';
import { AaveMarketStatusEntity } from '../entities/aave-market-status.entity';
import { GET_USER_TRANSACTIONS } from '../gql/user-transactions.gql';
import { AccountInterface } from '../interfaces/account.interface';
import { AaveUtils } from './aave-utils';
import { UserTransaction, UserTransactionsResponse } from '../interfaces/user-transaction.interface';
import { AccountEntity } from '../entities/accounts.entity';

const AAVE_SUBGRAPH_API_KEY = 'a5133c74a7c022d407d40bfc277e1aa4';

@Injectable()
export class AaveMarketStatusService {
  constructor(
    @InjectRepository(AaveMarketStatusEntity)
    private aaveMarketStatusRepository: Repository<AaveMarketStatusEntity>,
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
    marketChain: string,
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

  getREserveStatus() {
    
  }

}
