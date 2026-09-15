import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { AppConfigService } from '../src/config/config.service';
import { UsersService } from '../src/users/users.service';
import { OriginGuard } from '../src/auth/guards/origin.guard';

describe('browser authentication over HTTP (mocked session store)', () => {
  let app: INestApplication;
  let base: string;
  const auth = {
    login: jest.fn().mockResolvedValue({ accessToken: 'access-fixture', refreshToken: 'refresh-fixture' }),
    refresh: jest.fn().mockRejectedValue(new UnauthorizedException()),
    logout: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: UsersService, useValue: {} },
        { provide: AppConfigService, useValue: { nodeEnv: 'production', corsOrigin: 'https://moneylens.example', jwtAccessExpiresIn: '15m', jwtRefreshExpiresIn: '7d' } },
        { provide: APP_GUARD, useClass: OriginGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  afterAll(async () => { await app?.close(); });

  it('sets secure HttpOnly cookies without returning tokens to JavaScript', async () => {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://moneylens.example' },
      body: JSON.stringify({ email: 'demo@example.test', password: 'sandbox-test' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: true });
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(2);
    for (const cookie of cookies) expect(cookie).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  });

  it('uses the refresh cookie with an empty request body and clears rejected sessions', async () => {
    const response = await fetch(`${base}/api/auth/refresh`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'ml_refresh_token=expired' },
    });
    expect(response.status).toBe(401);
    expect(auth.refresh).toHaveBeenCalledWith('expired');
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it('allows logout when the access cookie has expired', async () => {
    const response = await fetch(`${base}/api/auth/logout`, {
      method: 'POST', headers: { Cookie: 'ml_refresh_token=refresh-fixture' },
    });
    expect(response.status).toBe(204);
    expect(auth.logout).toHaveBeenCalledWith('refresh-fixture');
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it('rejects browser mutations from another origin', async () => {
    const response = await fetch(`${base}/api/auth/logout`, {
      method: 'POST', headers: { Origin: 'https://untrusted.example' },
    });
    expect(response.status).toBe(403);
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
