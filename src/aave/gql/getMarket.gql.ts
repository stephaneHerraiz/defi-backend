import { gql } from 'graphql-request';

export const GET_MARKET = gql`
  query Market($request: MarketRequest!) {
    market(request: $request) {
      reserves {
        underlyingToken {
          address
          symbol
          name
        }
        supplyInfo {
          liquidationThreshold {
            value
          }
        }
      }
      userState {
        totalDebtBase
      }
    }
  }
`;
