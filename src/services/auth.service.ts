import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import type { AuthenticatedUser } from '../models/auth.js';

const jwks = createRemoteJWKSet(new URL(env.keycloakJwksUri));

export class AuthService {
  async verify(authorization?: string): Promise<AuthenticatedUser | null> {
    if (!authorization?.startsWith('Bearer ')) return null;
    try {
      const { payload } = await jwtVerify(authorization.slice(7).trim(), jwks, { issuer: env.keycloakIssuer });
      if (!payload.sub) return null;
      return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        preferred_username: typeof payload.preferred_username === 'string' ? payload.preferred_username : undefined, payload };
    } catch { return null; }
  }
}
