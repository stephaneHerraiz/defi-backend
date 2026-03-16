import { gql } from 'graphql-request';

export const GET_MARKETS = gql`
  query Markets($request: MarketsRequest!) {
    markets(request: $request) {
      name
      address
      icon
      userState {
        healthFactor
        netAPY {
          value
        }
        totalCollateralBase
        totalDebtBase
        userDebtAPY {
          value
        }
        userEarnedAPY {
          value
        }
        netWorth
        availableBorrowsBase
        currentLiquidationThreshold {
          value
        }
      }
      reserves {
        underlyingToken {
          address
          imageUrl
          name
          decimals
          symbol
        }
        supplyInfo {
          liquidationThreshold {
          value
        }
      }
      }
    }
  }
`;
