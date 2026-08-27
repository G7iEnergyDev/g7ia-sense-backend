import { FastifyReply, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { AuthenticatedToken } from "../types/types.js";

const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER;

if (!KEYCLOAK_ISSUER) {
  throw new Error("KEYCLOAK_ISSUER não configurado no .env");
}

const KEYCLOAK_JWKS_URI = process.env.KEYCLOAK_JWKS_URI;

if (!KEYCLOAK_JWKS_URI) {
  throw new Error("KEYCLOAK_JWKS_URI não configurado no .env");
}

const jwks = createRemoteJWKSet(new URL(KEYCLOAK_JWKS_URI));

export async function validateJwtToken(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthenticatedToken | null> {
  const authorization = request.headers.authorization;

  if (!authorization) {
    reply.status(401).send({
      error: "Token não enviado.",
    });

    return null;
  }

  const [type, token] = authorization.split(" ");

  if (type !== "Bearer" || !token) {
    reply.status(401).send({
      error: "Formato de token inválido.",
    });

    return null;
  }

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: KEYCLOAK_ISSUER,
    });

    if (!payload.sub) {
      reply.status(401).send({
        error: "Token sem sub do usuário.",
      });

      return null;
    }

    return {
      sub: payload.sub,
      payload,
    };
  } catch {
    reply.status(401).send({
      error: "Token inválido ou expirado.",
    });

    return null;
  }
}
