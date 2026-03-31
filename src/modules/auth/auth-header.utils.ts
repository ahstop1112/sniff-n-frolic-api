import { UnauthorizedException } from '@nestjs/common';

export const extractBearerToken = (
  authorizationHeader?: string,
): string => {
  if (!authorizationHeader) {
    throw new UnauthorizedException('Missing authorization header.');
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedException('Invalid authorization header.');
  }

  return token;
};