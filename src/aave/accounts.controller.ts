import { Body, Controller, Get, Post } from '@nestjs/common';
import { AccountEntity } from './entities/accounts.entity';
import { AccountsService } from './services/accounts.service';
import { Address } from '../ethereum/decorators/address.decorator';
import { AccountInterface } from './interfaces/account.interface';
import { Public } from 'src/ethereum/guards/public.decorator';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Public()
  @Get()
  findAll(@Address() userAddress: string): Promise<AccountEntity[]> {
    return this.accountsService.findAll(userAddress);
  }

  @Public()
  @Post()
  create(
    @Body() account: AccountInterface,
    @Address() userAddress: string,
  ): Promise<AccountEntity> {
    return this.accountsService.create(account, userAddress);
  }
}
