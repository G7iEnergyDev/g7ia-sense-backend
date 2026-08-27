import type { JWTPayload } from 'jose';

export type AuthenticatedUser = {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  payload: JWTPayload;
};
