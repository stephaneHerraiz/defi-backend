import { AaveMarketEntity } from '../entities/aave-market.entity';
import { AccountEntity } from '../entities/accounts.entity';

export interface AaveMarketStatusInterface {
  healthFactor: number;

  totalBorrows: number;

  liquidationThreshold: number;

  account: AccountEntity;

  market: AaveMarketEntity;
}
