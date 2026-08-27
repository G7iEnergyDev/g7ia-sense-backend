import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { registerRoutes } from './routes/index.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(registerRoutes);

try {
  await app.listen({ port: env.port, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
