import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, TokenPair } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { AppConfigService } from '../config/config.service';
import { parseDurationMs } from '../common/utils/parse-duration';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.constants';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.register(dto.email, dto.password);
    this.setAuthCookies(res, tokens);
    return { authenticated: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.auth.login(dto.email, dto.password);
    this.setAuthCookies(res, tokens);
    return { authenticated: true };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // O refresh token é httpOnly (o JS do browser não consegue lê-lo), então
    // o fluxo via cookie do próprio frontend é o caminho normal; o campo no
    // corpo continua existindo para uso via API/Swagger direto.
    const refreshToken = dto.refreshToken ?? req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!refreshToken) throw new UnauthorizedException('Refresh token ausente');

    try {
      const tokens = await this.auth.refresh(refreshToken);
      this.setAuthCookies(res, tokens);
      return { authenticated: true };
    } catch (err) {
      if (err instanceof UnauthorizedException) this.clearAuthCookies(res);
      throw err;
    }
  }

  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.[REFRESH_TOKEN_COOKIE]);
    this.clearAuthCookies(res);
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
  }

  @Get('me')
  async me(@CurrentUser() user: CurrentUserPayload) {
    const found = await this.users.findById(user.userId);
    return { id: found?.id, email: found?.email };
  }

  private setAuthCookies(res: Response, tokens: TokenPair) {
    const secure = this.config.nodeEnv === 'production';
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: parseDurationMs(this.config.jwtAccessExpiresIn),
    });
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: parseDurationMs(this.config.jwtRefreshExpiresIn),
    });
  }
}
