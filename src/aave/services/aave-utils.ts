import {
  ReservesDataHumanized,
  UiIncentiveDataProvider,
  UiPoolDataProvider,
} from '@aave/contract-helpers';
import { formatReserves, formatUserSummary } from '@aave/math-utils';
import * as dayjs from 'dayjs';
import * as addressbook from '@bgd-labs/aave-address-book';
import { ethers } from 'ethers';
import { AaveMarketStatusEntity } from './../entities/aave-market-status.entity';
import { AaveMarketEntity } from './../entities/aave-market.entity';
import { AccountEntity } from './../entities/accounts.entity';

export interface AaveAsset {
  name: string;
  decimals: number;
  id: number;
  UNDERLYING: string;
  A_TOKEN: string;
  V_TOKEN: string;
  INTEREST_RATE_STRATEGY: string;
  ORACLE: string;
}

export const AaveMarkets = [
  {
    chain: 'ZkSync',
    rpcProviver: 'https://mainnet.era.zksync.io',
    marketAddress: addressbook.AaveV3ZkSync,
  },
  {
    chain: 'Polygon',
    rpcProviver: 'https://polygon-bor-rpc.publicnode.com',
    marketAddress: addressbook.AaveV3Polygon,
  },
  {
    chain: 'Arbitrum',
    rpcProviver: 'https://arbitrum.meowrpc.com',
    marketAddress: addressbook.AaveV3Arbitrum,
  },
];

export class AaveUtils {
  assets;
  marketEntity: AaveMarketEntity;
  market: any;
  poolDataProviderContract: UiPoolDataProvider;
  incentiveDataProviderContract: UiIncentiveDataProvider;
  reserves!: ReservesDataHumanized;
  userReserves: any;
  reserveIncentives: any;
  userIncentives: any;
  currentAccount!: AccountEntity;

  constructor(chain: string) {
    this.market = AaveMarkets.find((market) => market.chain === chain);
    if (!this.market) {
      throw new Error(`Market not found for chain ${chain}`);
    }
    this.marketEntity = new AaveMarketEntity(this.market);

    const provider = new ethers.providers.JsonRpcProvider(
      this.marketEntity.rpcProviver,
    );
    this.assets = Object(this.market.marketAddress.ASSETS);
    this.poolDataProviderContract = new UiPoolDataProvider({
      uiPoolDataProviderAddress:
        this.market.marketAddress.UI_POOL_DATA_PROVIDER,
      provider,
      chainId: this.market.marketAddress.CHAIN_ID,
    });
    // View contract used to fetch all reserve incentives (APRs), and user incentives
    this.incentiveDataProviderContract = new UiIncentiveDataProvider({
      uiIncentiveDataProviderAddress:
        this.market.marketAddress.UI_INCENTIVE_DATA_PROVIDER,
      provider,
      chainId: this.market.marketAddress.CHAIN_ID,
    });
  }

  async fetchContractData(currentAccount: AccountEntity) {
    // Object containing array of pool reserves and market base currency data
    // { reservesArray, baseCurrencyData }
    this.reserves = await this.poolDataProviderContract.getReservesHumanized({
      lendingPoolAddressProvider:
        this.market.marketAddress.POOL_ADDRESSES_PROVIDER,
    });

    // Object containing array or users aave positions and active eMode category
    // { userReserves, userEmodeCategoryId }
    this.userReserves =
      await this.poolDataProviderContract.getUserReservesHumanized({
        lendingPoolAddressProvider:
          this.market.marketAddress.POOL_ADDRESSES_PROVIDER,
        user: currentAccount.address,
      });

    // Array of incentive tokens with price feed and emission APR
    // this.reserveIncentives =
    //     await this.incentiveDataProviderContract.getReservesIncentivesDataHumanized({
    //     lendingPoolAddressProvider:
    //         this.market.marketAddress.POOL_ADDRESSES_PROVIDER,
    //     });

    // // Dictionary of claimable user incentives
    // this.userIncentives =
    //     await this.incentiveDataProviderContract.getUserReservesIncentivesDataHumanized({
    //     lendingPoolAddressProvider:
    //         this.market.marketAddress.POOL_ADDRESSES_PROVIDER,
    //     user: currentAccount.address,
    //     });
    this.currentAccount = currentAccount;
  }

  formatUserSummary() {
    const reservesArray = this.reserves.reservesData;
    const baseCurrencyData = this.reserves.baseCurrencyData;
    const userReservesArray = this.userReserves.userReserves;

    const currentTimestamp = dayjs().unix();

    const formattedReserves = formatReserves({
      reserves: reservesArray,
      currentTimestamp,
      marketReferenceCurrencyDecimals:
        baseCurrencyData.marketReferenceCurrencyDecimals,
      marketReferencePriceInUsd:
        baseCurrencyData.marketReferenceCurrencyPriceInUsd,
    });
    /*
      - @param `currentTimestamp` Current UNIX timestamp in seconds, Math.floor(Date.now() / 1000)
      - @param `marketReferencePriceInUsd` Input from [Fetching Protocol Data](#fetching-protocol-data), `reserves.baseCurrencyData.marketReferencePriceInUsd`
      - @param `marketReferenceCurrencyDecimals` Input from [Fetching Protocol Data](#fetching-protocol-data), `reserves.baseCurrencyData.marketReferenceCurrencyDecimals`
      - @param `userReserves` Input from [Fetching Protocol Data](#fetching-protocol-data), combination of `userReserves.userReserves` and `reserves.reservesArray`
      - @param `userEmodeCategoryId` Input from [Fetching Protocol Data](#fetching-protocol-data), `userReserves.userEmodeCategoryId`
      */
    return formatUserSummary({
      currentTimestamp,
      marketReferencePriceInUsd:
        baseCurrencyData.marketReferenceCurrencyPriceInUsd,
      marketReferenceCurrencyDecimals:
        baseCurrencyData.marketReferenceCurrencyDecimals,
      userReserves: userReservesArray,
      formattedReserves,
      userEmodeCategoryId: this.userReserves.userEmodeCategoryId,
    });
  }

  getTokenByUnderLyingAddress(address: string): AaveAsset | undefined {
    let asset: AaveAsset | undefined = undefined;
    for (const _asset in this.assets) {
      if (
        String(this.assets[_asset].UNDERLYING).toUpperCase() ===
        String(address).toUpperCase()
      ) {
        asset = this.assets[_asset];
        if (asset) {
          asset.name = _asset;
        }
        break;
      }
    }
    return asset;
  }

  getMarketStatus(): AaveMarketStatusEntity {
    const userSummary = this.formatUserSummary();
    return new AaveMarketStatusEntity({
      account: this.currentAccount,
      market: this.marketEntity,
      healthFactor: Number(userSummary.healthFactor),
      liquidationThreshold: Number(userSummary.currentLiquidationThreshold),
      totalBorrows: Number(userSummary.totalBorrowsMarketReferenceCurrency),
    });
  }

  getReserves() {
    const userSummary = this.formatUserSummary();
    return userSummary.userReservesData;
  }
}
