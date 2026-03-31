import {
  BadRequestException, Injectable,
  HttpException, HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AuthRepository } from './auth.repository';
import {
  generateSessionToken,
  generateSixDigitCode,
  hashOtpCode,
  hashSessionToken,
  normalizeEmail,
} from '../../common/utils/auth.utils';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  public requestCode = async (rawEmail: string) => {
    // Check Feature Flags
    const authEnabled = await this.featureFlagsService.isEnabled('auth_enabled');

    if (!authEnabled) {
      throw new NotFoundException('Authentication is not available.');
    }

    const emailOtpLoginEnabled =
      await this.featureFlagsService.isEnabled('email_otp_login');

    if (!emailOtpLoginEnabled) {
      throw new NotFoundException('Email OTP login is not available.');
    }

    // Check Email
    const email = normalizeEmail(rawEmail);

    if (!email) {
      throw new BadRequestException('Email is required.');
    }

    const latestCode = await this.authRepository.findLatestActiveCodeByEmail(
      email,
    );

    const now = new Date();

    if (latestCode?.resend_after && new Date(latestCode.resend_after) > now) {
      throw new HttpException(
        'Please wait before requesting another code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = generateSixDigitCode();
    const codeHash = hashOtpCode(code);

    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    const resendAfter = new Date(now.getTime() + 60 * 1000);

    const loginCode = await this.authRepository.createEmailLoginCode({
      email,
      codeHash,
      expiresAt,
      resendAfter,
    });

    return {
      ok: true,
      message: 'Verification code sent.',
      expiresAt: loginCode.expires_at,
      resendAfter: loginCode.resend_after,
    };
  };

  public async verifyCode(params: {
    email: string;
    code: string;
    userAgent?: string | null;
    ipAddress?: string | null;
  }) {
    // Check Feature Flags
    const authEnabled = await this.featureFlagsService.isEnabled('auth_enabled');

    if (!authEnabled) {
      throw new NotFoundException('Authentication is not available.');
    }

    const emailOtpLoginEnabled =
      await this.featureFlagsService.isEnabled('email_otp_login');

    if (!emailOtpLoginEnabled) {
      throw new NotFoundException('Email OTP login is not available.');
    }

    const email = normalizeEmail(params.email);
    const code = params.code.trim();

    const loginCode =
      await this.authRepository.findLatestVerifiableCodeByEmail(email);

    if (!loginCode) {
      throw new BadRequestException('Invalid or expired code.');
    }

    const now = new Date();

    if (loginCode.consumed_at) {
      throw new BadRequestException('Invalid or expired code.');
    }

    if (new Date(loginCode.expires_at) < now) {
      throw new BadRequestException('Invalid or expired code.');
    }

    if (loginCode.attempt_count >= loginCode.max_attempts) {
      throw new BadRequestException('Too many invalid attempts.');
    }

    const incomingCodeHash = hashOtpCode(code);

    if (incomingCodeHash !== loginCode.code_hash) {
      await this.authRepository.incrementCodeAttempt(loginCode.id);
      throw new BadRequestException('Invalid or expired code.');
    }

    await this.authRepository.consumeCode(loginCode.id);

    let user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      user = await this.authRepository.createUser(email);
    }

    const accessToken = generateSessionToken();
    const tokenHash = hashSessionToken(accessToken);
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await this.authRepository.createSession({
      userId: user.id,
      tokenHash,
      expiresAt,
      userAgent: params.userAgent ?? null,
      ipAddress: params.ipAddress ?? null,
    });

    return {
      ok: true,
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
      sessionExpiresAt: expiresAt,
    };
  };

  public async validateAccessToken(accessToken: string) {
    const tokenHash = hashSessionToken(accessToken);

    const record = await this.authRepository.findSessionByTokenHash(tokenHash);

    if (!record) {
      return null;
    }

    const now = new Date();

    if (record.revoked_at) {
      return null;
    }

    if (new Date(record.expires_at) < now) {
      return null;
    }

    return {
      user: {
        id: record.user_id_ref,
        email: record.email,
        status: record.status,
      },
      session: {
        id: record.session_id,
        userId: record.user_id,
        expiresAt: record.expires_at,
        revokedAt: record.revoked_at,
      },
    };
  }

  public async getMe(accessToken: string) {
    const auth = await this.validateAccessToken(accessToken);

    if (!auth) {
      return null;
    }

    return {
      ok: true,
      user: auth.user,
      session: auth.session,
    };
  }

  public async logout(accessToken: string) {
  const tokenHash = hashSessionToken(accessToken);

  const revokedSession =
    await this.authRepository.revokeSessionByTokenHash(tokenHash);

  if (!revokedSession) {
    return {
      ok: true,
      message: 'Already logged out or session not found.',
    };
  }

  return {
    ok: true,
    message: 'Logged out successfully.',
    session: {
      id: revokedSession.id,
      userId: revokedSession.user_id,
      expiresAt: revokedSession.expires_at,
      revokedAt: revokedSession.revoked_at,
    },
  };
}
}