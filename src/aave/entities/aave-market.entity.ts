import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class AaveMarketEntity {
  @PrimaryColumn()
  chain!: string;

  @Column()
  rpcProviver!: string;

  @Column({ nullable: true })
  coingeckoName!: string;

  constructor(market: any) {
    if (market === undefined) return;
    this.chain = market.chain;
    this.rpcProviver = market.rpcProviver;
    this.coingeckoName = market.coingeckoName;
  }
}
