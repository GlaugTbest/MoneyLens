import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AppConfigService } from '../../config/config.service';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ACCESS_TOKEN_COOKIE } from '../auth.constants';

interface AccessTokenClaims {
  sub: string;
  email: string;
}

function cookieExtractor(req: Request): string | null {
  return req?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwtAccessSecret,
    });
  }

  validate(payload: AccessTokenClaims): CurrentUserPayload {
    return { userId: payload.sub, email: payload.email };
  }
}
