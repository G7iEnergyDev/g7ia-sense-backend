import type { preHandlerHookHandler } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import type { AuthenticatedUser } from '../models/auth.js';

declare module 'fastify' { interface FastifyRequest { user?: AuthenticatedUser } }

const authService = new AuthService();

export const authenticate: preHandlerHookHandler = async (request, reply) => {
  const user = await authService.verify(request.headers.authorization);
  if (!user) return reply.status(401).send({ error: 'Token inválido, expirado ou ausente.' });
  request.user = user;
};
