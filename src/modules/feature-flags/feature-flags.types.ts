export type FeatureFlagRecord = {
  key: string;
  enabled: boolean;
  description: string | null;
  updated_at: Date;
};

export type FeatureFlagKey =
  | 'auth_enabled'
  | 'email_otp_login';