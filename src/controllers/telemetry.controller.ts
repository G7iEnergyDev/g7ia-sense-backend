import type { FastifyReply, FastifyRequest } from 'fastify';
import { isPeriod, type Period, type DeviceType } from '../models/device.js';
import { InstallationService } from '../services/installation.service.js';
import { TelemetryService } from '../services/telemetry.service.js';
import { ensureInstallationOwner } from './installation.controller.js';

const installations = new InstallationService();
const telemetry = new TelemetryService();
export type Query = {
  deviceId?: string;
  period?: Period;
  acDeviceId?: string;
  dcDeviceId?: string;
  installationId?: string;
};

async function userId(request: FastifyRequest, reply: FastifyReply) {
  const id = await installations.userId(request.user!.sub);
  if (!id) reply.status(404).send({ error: 'Usuário não encontrado no banco de dados.' });
  return id;
}
function requiredPeriod(reply: FastifyReply, period?: string): Period | undefined {
  if (!period) {
    reply.status(400).send({ error: 'period é obrigatório.' });
    return;
  }
  if (!isPeriod(period)) {
    reply.status(400).send({ error: 'Período inválido. Use: 24h, 7d, 30d ou year.' });
    return;
  }
  return period;
}
async function verifyDevice(
  request: FastifyRequest,
  reply: FastifyReply,
  deviceId: string | undefined,
  expected: DeviceType,
) {
  if (!deviceId) {
    reply.status(400).send({ error: 'deviceId é obrigatório.' });
    return;
  }
  const ownerId = await userId(request, reply);
  if (!ownerId) return;
  const access = await telemetry.assertDevice(deviceId, ownerId, expected);
  if (access === 'not-found') {
    reply.status(403).send({ error: 'Dispositivo não encontrado ou acesso não autorizado.' });
    return;
  }
  if (access === 'wrong-type') {
    reply.status(400).send({ error: `Esta rota aceita apenas dispositivos do tipo ${expected}.` });
    return;
  }
  return { deviceId, ownerId };
}

export async function generation(
  request: FastifyRequest<{ Querystring: Query }>,
  reply: FastifyReply,
) {
  const { deviceId, period } = request.query;
  if (!deviceId) return reply.status(400).send({ error: 'deviceId é obrigatório.' });
  const validPeriod = requiredPeriod(reply, period);
  if (!validPeriod) return;
  const ownerId = await userId(request, reply);
  if (!ownerId) return;
  try {
    return await telemetry.generation(deviceId, validPeriod, ownerId);
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '42501')
      return reply
        .status(403)
        .send({ error: 'Você não tem permissão para acessar este dispositivo.' });
    throw error;
  }
}
export async function currentAcPower(
  request: FastifyRequest<{ Querystring: Query }>,
  reply: FastifyReply,
) {
  const device = await verifyDevice(request, reply, request.query.deviceId, 'AC');
  if (!device) return;
  const data = await telemetry.currentAcPower(device.deviceId);
  return (
    data ??
    reply.status(404).send({ error: 'Nenhuma telemetria AC encontrada para este dispositivo.' })
  );
}
export async function currentTemperature(
  request: FastifyRequest<{ Querystring: Query }>,
  reply: FastifyReply,
) {
  const device = await verifyDevice(request, reply, request.query.deviceId, 'ENV');
  if (!device) return;
  const data = await telemetry.currentTemperature(device.deviceId);
  return (
    data ??
    reply.status(404).send({ error: 'Nenhuma telemetria ENV encontrada para este dispositivo.' })
  );
}
export async function totalGeneration(
  request: FastifyRequest<{ Querystring: Query }>,
  reply: FastifyReply,
) {
  const period = requiredPeriod(reply, request.query.period);
  if (!period) return;
  const device = await verifyDevice(request, reply, request.query.deviceId, 'AC');
  if (!device) return;
  return telemetry.totalGeneration(device.deviceId, period);
}
export async function dcAcEfficiency(
  request: FastifyRequest<{ Querystring: Query }>,
  reply: FastifyReply,
) {
  const { acDeviceId, dcDeviceId, period } = request.query;
  if (!acDeviceId || !dcDeviceId)
    return reply
      .status(400)
      .send({ error: !acDeviceId ? 'acDeviceId é obrigatório.' : 'dcDeviceId é obrigatório.' });
  const validPeriod = requiredPeriod(reply, period);
  if (!validPeriod) return;
  const ownerId = await userId(request, reply);
  if (!ownerId) return;
  const validation = await telemetry.validateAcDcPair(acDeviceId, dcDeviceId, ownerId);
  if (!validation.acFound)
    return reply
      .status(403)
      .send({ error: 'Dispositivo AC não encontrado ou acesso não autorizado.' });
  if (!validation.dcFound)
    return reply
      .status(403)
      .send({ error: 'Dispositivo DC não encontrado ou acesso não autorizado.' });
  if (!validation.sameInstallation)
    return reply
      .status(400)
      .send({ error: 'Os dispositivos AC e DC precisam pertencer à mesma instalação.' });
  return telemetry.dcAcEfficiency(acDeviceId, dcDeviceId, validPeriod);
}
export async function devicesLastRead(
  request: FastifyRequest<{ Querystring: Query }>,
  reply: FastifyReply,
) {
  const owner = await ensureInstallationOwner(request, reply, request.query.installationId);
  if (!owner) return;
  return telemetry.lastReads(owner.installationId);
}
