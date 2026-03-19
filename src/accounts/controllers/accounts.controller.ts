import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { AccountEntity } from '../entities/accounts.entity';
import { AccountsService } from '../services/accounts.service';
import { Address } from '../../ethereum/decorators/address.decorator';
import { AccountInterface } from '../interfaces/account.interface';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll(@Address() userAddress: string): Promise<AccountEntity[]> {
    return this.accountsService.findAll(userAddress);
  }

  @Post()
  create(
    @Body() account: AccountInterface,
    @Address() userAddress: string,
  ): Promise<AccountEntity> {
    return this.accountsService.create(account, userAddress);
  }

  @Delete(':id')
  remove(
    @Param('id') id: number,
    @Address() userAddress: string,
  ): Promise<void> {
    return this.accountsService.remove(id, userAddress);
  }
}
