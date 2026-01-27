import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AccountEntity } from '../entities/accounts.entity';
import { EtherSignService } from '../../ethereum/services/ether-sign.service';
import { Repository } from 'typeorm';
import { AccountInterface } from '../interfaces/account.interface';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(AccountEntity)
    private accountsRepository: Repository<AccountEntity>,
    private readonly etherSignService: EtherSignService,
  ) {}

  async findAll(userAddress: string): Promise<AccountEntity[]> {
    return this.accountsRepository.findBy({ userAddress });
  }

  async findOne(
    address: string,
    userAddress: string,
  ): Promise<AccountEntity | null> {
    const user = await this.etherSignService.findOne(userAddress);
    if (!user) {
      throw new Error('User not found');
    }
    return this.accountsRepository.findOneBy({
      address: address,
      userAddress: userAddress,
    });
  }

  async remove(address: string): Promise<void> {
    await this.accountsRepository.delete(address);
  }

  async create(
    account: AccountInterface,
    userAddress: string,
  ): Promise<AccountEntity> {
    const user = await this.etherSignService.findOne(userAddress);
    if (!user) {
      throw new Error('User not found');
    }

    const accountEntity = new AccountEntity();
    accountEntity.address = account.address;
    accountEntity.label = account.label;
    accountEntity.userAddress = userAddress;
    return this.accountsRepository.save(accountEntity);
  }
}
