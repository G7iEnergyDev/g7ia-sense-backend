import Fastify, {
  type FastifyReply,
  type FastifyRequest,
  type preHandlerHookHandler,
} from "fastify";

import { AuthenticatedUser } from "../types/types.js";
import { createRemoteJWKSet, jwtVerify } from "jose";
const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER;
const KEYCLOAK_JWKS_URI = process.env.KEYCLOAK_JWKS_URI;

if (!KEYCLOAK_ISSUER) {
  throw new Error("KEYCLOAK_ISSUER não configurado no .env");
}
if (!KEYCLOAK_JWKS_URI) {
  throw new Error("KEYCLOAK_JWKS_URI não configurado no .env");
}
const jwks = createRemoteJWKSet(new URL(KEYCLOAK_JWKS_URI));

export const authenticate: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return reply.status(401).send({
      error: "Token ausente",
    });
  }

  const token = authorization.replace("Bearer ", "").trim();

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: KEYCLOAK_ISSUER,
    });

    if (!payload.sub) {
      return reply.status(401).send({
        error: "Token sem identificador de usuário",
      });
    }

    request.user = {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
      preferred_username:
        typeof payload.preferred_username === "string"
          ? payload.preferred_username
          : undefined,
      payload,
    };
  } catch {
    return reply.status(401).send({
      error: "Token inválido ou expirado",
    });
  }
};
