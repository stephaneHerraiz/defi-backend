import { UnderlyingToken } from './aave-market';

export interface GetMarketInterface {
  market: {
    reserves: {
      underlyingToken: UnderlyingToken;
      supplyInfo: {
        liquidationThreshold: {
          value: number;
        };
      };
    }[];
    userState: {
      totalDebtBase: number;
    };
  };
}
