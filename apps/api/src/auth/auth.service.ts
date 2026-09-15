import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/config.service';

const SALT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async register(email: string, password: string): Promise<TokenPair> {
    email = email.trim().toLowerCase();
    if (Buffer.byteLength(password, 'utf8') > 72) throw new BadRequestException('Senha deve ter no máximo 72 bytes');
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictException('E-mail já cadastrado');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.users.create(email, passwordHash);
    return this.issueTokenPair(user.id, user.email);
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.issueTokenPair(user.id, user.email);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let claims: { sub: string; email: string; jti: string };
    try {
      claims = this.jwt.verify(refreshToken, {
        secret: this.config.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido');
    }

    return this.prisma.$transaction(async (db) => {
      const consumed = await db.refreshToken.updateMany({
        where: { id: claims.jti, userId: claims.sub, tokenHash: this.hashToken(refreshToken), revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (consumed.count !== 1) throw new UnauthorizedException('Refresh token inválido ou expirado');
      return this.issueTokenPair(claims.sub, claims.email, db);
    });
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    // Revoke only this browser's refresh session, even if its access token expired.
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokenPair(userId: string, email: string, db: Prisma.TransactionClient = this.prisma): Promise<TokenPair> {
    const accessToken = this.jwt.sign(
      { sub: userId, email },
      {
        secret: this.config.jwtAccessSecret,
        expiresIn: this.config.jwtAccessExpiresIn,
      },
    );

    const jti = crypto.randomUUID();
    const refreshToken = this.jwt.sign(
      { sub: userId, email, jti },
      {
        secret: this.config.jwtRefreshSecret,
        expiresIn: this.config.jwtRefreshExpiresIn,
      },
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    await db.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
