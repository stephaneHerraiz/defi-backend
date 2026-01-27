export interface Reserve {
  symbol: string;
  decimals: number;
}

export interface BaseTransaction {
  id: string;
  timestamp: number;
  txHash: string;
  action: string;
}

export interface Supply extends BaseTransaction {
  action: 'Supply';
  amount: string;
  reserve: Reserve;
  assetPriceUSD: string;
}

export interface RedeemUnderlying extends BaseTransaction {
  action: 'RedeemUnderlying';
  amount: string;
  reserve: Reserve;
  assetPriceUSD: string;
}

export interface Borrow extends BaseTransaction {
  action: 'Borrow';
  amount: string;
  borrowRateMode: string;
  borrowRate: string;
  stableTokenDebt: string;
  variableTokenDebt: string;
  reserve: Reserve;
  assetPriceUSD: string;
}

export interface UsageAsCollateral extends BaseTransaction {
  action: 'UsageAsCollateral';
  fromState: boolean;
  toState: boolean;
  reserve: Omit<Reserve, 'decimals'>;
}

export interface Repay extends BaseTransaction {
  action: 'Repay';
  amount: string;
  reserve: Reserve;
  assetPriceUSD: string;
}

export interface SwapBorrowRate extends BaseTransaction {
  action: 'SwapBorrowRate';
  borrowRateModeFrom: string;
  borrowRateModeTo: string;
  variableBorrowRate: string;
  stableBorrowRate: string;
  reserve: Reserve;
}

export interface LiquidationCall extends BaseTransaction {
  action: 'LiquidationCall';
  collateralAmount: string;
  collateralReserve: Reserve;
  principalAmount: string;
  principalReserve: Reserve;
  collateralAssetPriceUSD: string;
  borrowAssetPriceUSD: string;
}

export type UserTransaction =
  | Supply
  | RedeemUnderlying
  | Borrow
  | UsageAsCollateral
  | Repay
  | SwapBorrowRate
  | LiquidationCall;

export interface UserTransactionsResponse {
  userTransactions: UserTransaction[];
}

export interface UserTransactionsVariables {
  userAddress: string;
  first: number;
  skip: number;
}
