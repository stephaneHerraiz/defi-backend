import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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
    return this.accountsRepository.findOneBy({
      address: address,
      userAddress: userAddress,
    });
  }

  async create(
    account: AccountInterface,
    userAddress: string,
  ): Promise<AccountEntity> {
    const user = await this.etherSignService.findOne(userAddress);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const accountEntity = new AccountEntity();
    accountEntity.address = account.address;
    accountEntity.label = account.label;
    accountEntity.userAddress = userAddress;
    return this.accountsRepository.save(accountEntity);
  }

  async remove(id: number, userAddress: string): Promise<void> {
    const account = await this.accountsRepository.findOneBy({ id });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    if (account.userAddress !== userAddress) {
      throw new ForbiddenException(
        'You do not have permission to remove this account',
      );
    }
    await this.accountsRepository.delete(id);
  }
}
