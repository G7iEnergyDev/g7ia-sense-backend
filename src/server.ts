import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { generationRoute } from './generation.js';
import { healthRoute } from './health.js';
import { meRoute } from './me.js';
import { installationsRoute } from './my-installations.js';
import { currentAcPowerRoute } from './current-ac-power.js';
import { currentTemperatureRoute } from './current-temperature.js';
import { totalGenerationRoute } from './total-generation.js';
import { dcAcEfficiencyRoute } from './dc-ac-efficiency.js';
import { devicesLastReadRoute } from './devices-last-read.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL não configurado no .env');
}
const KEYCLOAK_ISSUER = process.env.KEYCLOAK_ISSUER;
if (!KEYCLOAK_ISSUER) {
  throw new Error('KEYCLOAK_ISSUER não configurado no .env');
}
const KEYCLOAK_JWKS_URI = process.env.KEYCLOAK_JWKS_URI;
if (!KEYCLOAK_JWKS_URI) {
  throw new Error('KEYCLOAK_JWKS_URI não configurado no .env');
}

const PORT = Number(process.env.PORT ?? 3333);

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
});

await app.register(generationRoute);
await app.register(healthRoute);
await app.register(meRoute);
await app.register(installationsRoute);
await app.register(currentAcPowerRoute);
await app.register(currentTemperatureRoute);
await app.register(totalGenerationRoute);
await app.register(dcAcEfficiencyRoute);
await app.register(devicesLastReadRoute);

const start = async () => {
  try {
    await app.listen({
      port: PORT,
      host: '0.0.0.0',
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

await start();
