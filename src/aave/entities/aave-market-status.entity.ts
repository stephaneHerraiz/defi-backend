import {
  Entity,
  Column,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { AaveMarketStatusInterface } from '../interfaces/aave-market-status.interface';
import { AaveMarketEntity } from './aave-market.entity';
import { AccountEntity } from './accounts.entity';

@Entity()
export class AaveMarketStatusEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ type: 'float' })
  healthFactor!: number;

  @Column({ type: 'float' })
  totalBorrows!: number;

  @Column({ type: 'float' })
  liquidationThreshold!: number;

  @ManyToOne(() => AccountEntity)
  account?: AccountEntity;

  @ManyToOne(() => AaveMarketEntity, (market: AaveMarketEntity) => market.chain)
  market!: AaveMarketEntity;

  constructor(aaveMarketStatus: AaveMarketStatusInterface) {
    if (aaveMarketStatus === undefined) return;
    this.healthFactor = aaveMarketStatus.healthFactor;
    this.totalBorrows = aaveMarketStatus.totalBorrows;
    this.liquidationThreshold = aaveMarketStatus.liquidationThreshold;
    this.account = aaveMarketStatus.account;
    this.market = aaveMarketStatus.market;
  }
}
