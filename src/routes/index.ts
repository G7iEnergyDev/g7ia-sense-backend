import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middlewares/authenticate.js';
import { listMyInstallations } from '../controllers/installation.controller.js';
import * as telemetry from '../controllers/telemetry.controller.js';
import type { Query } from '../controllers/telemetry.controller.js';

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok', service: 'g7i-read-api', message: 'Service is running and healthy' }));
  app.get('/me', { preHandler: authenticate }, async (request) => ({ user: request.user }));
  app.get('/my-installations', { preHandler: authenticate }, listMyInstallations);
  app.get<{ Querystring: Query }>('/generation', { preHandler: authenticate }, telemetry.generation);
  app.get<{ Querystring: Query }>('/current-ac-power', { preHandler: authenticate }, telemetry.currentAcPower);
  app.get<{ Querystring: Query }>('/current-temperature', { preHandler: authenticate }, telemetry.currentTemperature);
  app.get<{ Querystring: Query }>('/total-generation', { preHandler: authenticate }, telemetry.totalGeneration);
  app.get<{ Querystring: Query }>('/dc-ac-efficiency', { preHandler: authenticate }, telemetry.dcAcEfficiency);
  app.get<{ Querystring: Query }>('/devices-last-read', { preHandler: authenticate }, telemetry.devicesLastRead);
}
