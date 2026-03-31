import {
    Body, Controller,
    Get, Headers,
    Ip, Post,
    Req, UnauthorizedException, UseGuards
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentSession, CurrentUser } from './auth.decorators';
import type { AuthSession, AuthUser } from './auth.types';
import { RequestCodeDto } from './dto/request-code.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { extractBearerToken } from './auth-header.utils';

type AuthenticatedRequest = Request & {
  authUser?: {
    id: string;
    email: string;
    status: 'active' | 'inactive';
  };
  authSession?: {
    id: string;
    userId: string;
    expiresAt: Date;
    revokedAt: Date | null;
  };
};

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('request-code')
    public async requestCode (@Body() dto: RequestCodeDto){
        return this.authService.requestCode(dto.email);
    };
    
    @Post('verify-code')
    public async verifyCode(
        @Body() dto: VerifyCodeDto,
        @Headers('user-agent') userAgent?: string,
        @Ip() ipAddress?: string,
    ) {
        return this.authService.verifyCode({
            email: dto.email,
            code: dto.code,
            userAgent: userAgent ?? null,
            ipAddress: ipAddress ?? null,
        });
    }

    @Get('me')
    @UseGuards(AuthGuard)
    public async me(
        @CurrentUser() user?: AuthUser,
        @CurrentSession() session?: AuthSession,
    ) {
        if (!user || !session) {
            throw new UnauthorizedException('Unauthorized.');
        }

        return {
            ok: true,
            user,
            session,
        };
    }

    @Post('logout')
    @UseGuards(AuthGuard)
    public async logout(@Req() req: Request) {
        const token = extractBearerToken(req.headers.authorization);
        return this.authService.logout(token);
    }
}