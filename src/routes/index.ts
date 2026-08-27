import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middlewares/authenticate.js';
import { listMyInstallations } from '../controllers/installation.controller.js';
import * as telemetry from '../controllers/telemetry.controller.js';
import type { Query } from '../controllers/telemetry.controller.js';

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', { schema: { tags: ['Sistema'], summary: 'Verifica a disponibilidade da API' } }, async () => ({ status: 'ok', service: 'g7i-read-api', message: 'Service is running and healthy' }));
  app.get('/me', { preHandler: authenticate, schema: protectedSchema('Usuário', 'Retorna os dados do token autenticado') }, async (request) => ({ user: request.user }));
  app.get('/my-installations', { preHandler: authenticate, schema: protectedSchema('Usuário', 'Lista as instalações do usuário autenticado') }, listMyInstallations);
  app.get<{ Querystring: Query }>('/generation', { preHandler: authenticate, schema: devicePeriodSchema('Série temporal de geração', ['deviceId', 'period']) }, telemetry.generation);
  app.get<{ Querystring: Query }>('/current-ac-power', { preHandler: authenticate, schema: deviceSchema('Última potência AC', 'Identificador de um dispositivo AC') }, telemetry.currentAcPower);
  app.get<{ Querystring: Query }>('/current-temperature', { preHandler: authenticate, schema: deviceSchema('Última temperatura ambiental', 'Identificador de um dispositivo ENV') }, telemetry.currentTemperature);
  app.get<{ Querystring: Query }>('/total-generation', { preHandler: authenticate, schema: devicePeriodSchema('Total de geração AC', ['deviceId', 'period']) }, telemetry.totalGeneration);
  app.get<{ Querystring: Query }>('/dc-ac-efficiency', { preHandler: authenticate, schema: acDcSchema }, telemetry.dcAcEfficiency);
  app.get<{ Querystring: Query }>('/devices-last-read', { preHandler: authenticate, schema: installationSchema }, telemetry.devicesLastRead);
}

const errorResponseSchema = {
  type: 'object',
  required: ['error'],
  properties: { error: { type: 'string' } },
} as const;
const errorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  500: errorResponseSchema,
};
const protectedSchema = (tag: string, summary: string) => ({ tags: [tag], summary, security: [{ bearerAuth: [] }], response: errorResponses });
const uuid = { type: 'string', format: 'uuid' } as const;
const period = { type: 'string', enum: ['24h', '7d', '30d', 'year'] };
const deviceSchema = (summary: string, description: string) => ({ ...protectedSchema('Telemetria', summary), querystring: { type: 'object', required: ['deviceId'], properties: { deviceId: { ...uuid, description } } } });
const devicePeriodSchema = (summary: string, required: string[]) => ({ ...protectedSchema('Telemetria', summary), querystring: { type: 'object', required, properties: { deviceId: uuid, period } } });
const acDcSchema = { ...protectedSchema('Telemetria', 'Calcula a eficiência de conversão DC para AC'), querystring: { type: 'object', required: ['acDeviceId', 'dcDeviceId', 'period'], properties: { acDeviceId: uuid, dcDeviceId: uuid, period } } };
const installationSchema = { ...protectedSchema('Telemetria', 'Retorna a última leitura dos dispositivos de uma instalação'), querystring: { type: 'object', required: ['installationId'], properties: { installationId: uuid } } };
