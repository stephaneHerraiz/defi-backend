import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity()
export class AaveMarketEntity {
  @PrimaryColumn()
  chain!: string;

  @Column()
  rpcProviver!: string;

  constructor(market: any) {
    if (market === undefined) return;
    this.chain = market.chain;
    this.rpcProviver = market.rpcProviver;
  }
}
