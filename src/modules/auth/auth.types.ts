export type AuthUser = {
  id: string;
  email: string;
  status: string;
};

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type AuthenticatedRequestUserData = {
  authUser?: AuthUser;
  authSession?: AuthSession;
};