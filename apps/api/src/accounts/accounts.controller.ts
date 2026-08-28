import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('accounts')
@Controller('api/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.accounts.listForUser(user.userId);
  }

  @Get(':id')
  async get(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    const account = await this.accounts.getForUser(user.userId, id);
    if (!account) throw new NotFoundException('Conta não encontrada');
    return account;
  }
}
