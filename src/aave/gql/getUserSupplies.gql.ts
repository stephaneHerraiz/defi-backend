import { gql } from 'graphql-request';

export const GET_USER_SUPPLIES = gql`
  query UserSupplies($request: UserSuppliesRequest!) {
    userSupplies(request: $request) {
      balance {
        usd
        amount {
          value
        }
        usdPerToken
      }
      canBeCollateral
      isCollateral
      currency {
        imageUrl
        address
        name
        symbol
      }
      apy {
        value
      }
    }
  }
`;
