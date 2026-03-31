import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type {
  AuthSession,
  AuthUser,
  AuthenticatedRequestUserData,
} from './auth.types';

type AuthenticatedRequest = Request & AuthenticatedRequestUserData;

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.authUser;
  },
);

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthSession | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.authSession;
  },
);