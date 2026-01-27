import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from 'src/ethereum/entities/users.entity';

@Entity()
export class AccountEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  address!: string;

  @Column()
  label!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userAddress' })
  user?: UserEntity;

  @Column({ nullable: true })
  userAddress?: string;
}
