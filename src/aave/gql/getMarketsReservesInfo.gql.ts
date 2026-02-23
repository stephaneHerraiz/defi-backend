import { gql } from 'graphql-request';

export const GET_MARKETS_RESERVES_INFO = gql`
  query Markets($request: MarketsRequest!) {
    markets(request: $request) {
      reserves {
        underlyingToken {
          address
          imageUrl
          name
          decimals
          symbol
        }
      }
    }
  }
`;
