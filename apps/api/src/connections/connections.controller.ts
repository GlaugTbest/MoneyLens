import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConnectionsService } from './connections.service';
import { ConnectTokenDto } from './dto/connect-token.dto';
import { RegisterConnectionDto } from './dto/register-connection.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('connections')
@Controller('api/connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Post('connect-token')
  createConnectToken(@CurrentUser() user: CurrentUserPayload, @Body() dto: ConnectTokenDto) {
    return this.connections.createConnectToken(user.userId, dto.itemId);
  }

  @Post()
  register(@CurrentUser() user: CurrentUserPayload, @Body() dto: RegisterConnectionDto) {
    return this.connections.registerConnection(user.userId, dto.itemId);
  }

  @Get()
  list(@CurrentUser() user: CurrentUserPayload) {
    return this.connections.listConnections(user.userId);
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.connections.getConnection(user.userId, id);
  }

  @Post(':id/sync')
  sync(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.connections.triggerManualSync(user.userId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.connections.deleteConnection(user.userId, id);
  }
}
