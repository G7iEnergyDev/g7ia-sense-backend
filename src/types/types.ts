import { JWTPayload } from "jose";

export type AuthenticatedUser = {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  payload: JWTPayload;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

export type AuthenticatedToken = {
  sub: string;
  payload: JWTPayload;
};
