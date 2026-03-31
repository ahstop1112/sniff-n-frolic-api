import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedRequestUserData } from './auth.types';

type AuthenticatedRequest = Request & AuthenticatedRequestUserData;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader) {
      throw new UnauthorizedException('Missing authorization header.');
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization header.');
    }

    const auth = await this.authService.validateAccessToken(token);

    if (!auth) {
      throw new UnauthorizedException('Invalid or expired session.');
    }

    request.authUser = auth.user;
    request.authSession = auth.session;

    return true;
  }
}