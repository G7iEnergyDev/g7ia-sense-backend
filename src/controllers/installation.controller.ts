import type { FastifyReply, FastifyRequest } from 'fastify';
import { InstallationService } from '../services/installation.service.js';

const installations = new InstallationService();
const userNotFound = (reply: FastifyReply) => reply.status(404).send({ error: 'Usuário não encontrado no banco de dados.' });

export async function listMyInstallations(request: FastifyRequest, reply: FastifyReply) {
  const userId = await installations.userId(request.user!.sub);
  if (!userId) return userNotFound(reply);
  return installations.listForUser(userId);
}

export async function ensureInstallationOwner(request: FastifyRequest, reply: FastifyReply, installationId?: string) {
  if (!installationId) return reply.status(400).send({ error: 'installationId é obrigatório.' });
  const userId = await installations.userId(request.user!.sub);
  if (!userId) return userNotFound(reply);
  if (!(await installations.assertOwnership(installationId, userId))) return reply.status(403).send({ error: 'Instalação não encontrada ou acesso não autorizado.' });
  return { installationId, userId };
}
