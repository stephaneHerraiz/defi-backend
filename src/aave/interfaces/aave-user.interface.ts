export interface AaveUserSuppliesInterface {
  balance: {
    usd: number;
    amount: {
      value: number;
    };
    usdPerToken: number;
  };
  canBeCollateral: boolean;
  isCollateral: boolean;
  currency: {
    imageUrl: string;
    address: string;
    name: string;
    symbol: string;
  };
  apy: {
    value: number;
  };
}

export interface AaveUserBorrowsInterface {
  balance: {
    usd: number;
    amount: {
      value: number;
    };
  };
  canBeCollateral: boolean;
  isCollateral: boolean;
  currency: {
    imageUrl: string;
    address: string;
    name: string;
    symbol: string;
  };
  apy: {
    value: number;
  };
}
