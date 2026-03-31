import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

type CreateEmailLoginCodeParams = {
  email: string;
  codeHash: string;
  expiresAt: Date;
  resendAfter: Date;
};

@Injectable()
export class AuthRepository {
    constructor(private readonly databaseService: DatabaseService) {}

    public async createEmailLoginCode({
    email,
    codeHash,
    expiresAt,
    resendAfter,
    }: CreateEmailLoginCodeParams){
    const query = `
        INSERT INTO email_login_codes (
        email,
        code_hash,
        expires_at,
        resend_after
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, expires_at, resend_after, created_at
    `;

    const values = [email, codeHash, expiresAt, resendAfter];

    const result = await this.databaseService.query<{
        id: string;
        email: string;
        expires_at: Date;
        resend_after: Date;
        created_at: Date;
    }>(query, values);

    return result.rows[0];
    };

    public async findLatestActiveCodeByEmail(email: string){
    const query = `
        SELECT
        id,
        email,
        resend_after,
        expires_at,
        consumed_at,
        created_at
        FROM email_login_codes
        WHERE email = $1
        AND consumed_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1
    `;

    const result = await this.databaseService.query<{
        id: string;
        email: string;
        resend_after: Date;
        expires_at: Date;
        consumed_at: Date | null;
        created_at: Date;
    }>(query, [email]);

    return result.rows[0] ?? null;
    };
    
    public async findLatestVerifiableCodeByEmail(email: string) {
        const query = `
            SELECT
                id,
                email,
                code_hash,
                expires_at,
                consumed_at,
                attempt_count,
                max_attempts,
                resend_after,
                created_at
            FROM email_login_codes
            WHERE email = $1
                AND consumed_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const result = await this.databaseService.query<{
            id: string;
            email: string;
            code_hash: string;
            expires_at: Date;
            consumed_at: Date | null;
            attempt_count: number;
            max_attempts: number;
            resend_after: Date;
            created_at: Date;
        }>(query, [email]);

        return result.rows[0] ?? null;
    }

    public async incrementCodeAttempt(id: string) {
        const query = `
        UPDATE email_login_codes
        SET attempt_count = attempt_count + 1
        WHERE id = $1
        `;

        await this.databaseService.query(query, [id]);
    }

    public async consumeCode(id: string) {
        const query = `
        UPDATE email_login_codes
        SET consumed_at = NOW()
        WHERE id = $1
        `;

        await this.databaseService.query(query, [id]);
    }

    public async findUserByEmail(email: string) {
        const query = `
        SELECT id, email, status, created_at, updated_at
        FROM users
        WHERE email = $1
        LIMIT 1
        `;

        const result = await this.databaseService.query<{
        id: string;
        email: string;
        status: string;
        created_at: Date;
        updated_at: Date;
        }>(query, [email]);

        return result.rows[0] ?? null;
    }

    public async createUser(email: string) {
        const query = `
        INSERT INTO users (email, status, created_at, updated_at)
        VALUES ($1, 'active', NOW(), NOW())
        RETURNING id, email, status, created_at, updated_at
        `;

        const result = await this.databaseService.query<{
            id: string;
            email: string;
            status: string;
            created_at: Date;
            updated_at: Date;
        }>(query, [email]);

        return result.rows[0];
    }

    public async createSession(params: {
        userId: string;
        tokenHash: string;
        expiresAt: Date;
        userAgent: string | null;
        ipAddress: string | null;
    }) {
        const query = `
        INSERT INTO auth_sessions (
            user_id,
            access_token_hash,
            expires_at,
            user_agent,
            ip_address
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, expires_at, created_at
        `;

        const values = [
        params.userId,
        params.tokenHash,
        params.expiresAt,
        params.userAgent,
        params.ipAddress,
        ];

        const result = await this.databaseService.query<{
        id: string;
        user_id: string;
        expires_at: Date;
        created_at: Date;
        }>(query, values);

        return result.rows[0];
    }

    public async findSessionByTokenHash(tokenHash: string) {
        const query = `
            SELECT
                s.id AS session_id,
                s.user_id,
                s.expires_at,
                s.revoked_at,
                u.id AS user_id_ref,
                u.email,
                u.status
            FROM auth_sessions s
            INNER JOIN users u
            ON u.id = s.user_id
            WHERE s.access_token_hash = $1
            LIMIT 1
        `;

        const result = await this.databaseService.query<{
            session_id: string;
            user_id: string;
            expires_at: Date;
            revoked_at: Date | null;
            user_id_ref: string;
            email: string;
            status: string;
        }>(query, [tokenHash]);

        return result.rows[0] ?? null;
    }

    public async revokeSessionByTokenHash(tokenHash: string) {
        const query = `
            UPDATE auth_sessions
            SET revoked_at = NOW()
            WHERE access_token_hash = $1
            AND revoked_at IS NULL
            RETURNING id, user_id, expires_at, revoked_at
        `;

        const result = await this.databaseService.query<{
            id: string;
            user_id: string;
            expires_at: Date;
            revoked_at: Date | null;
        }>(query, [tokenHash]);

        return result.rows[0] ?? null;
        }
}