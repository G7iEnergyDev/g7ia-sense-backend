import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export async function registerSwagger(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: { title: 'G7I Sense Read API', version: '1.0.0', description: 'API de consulta de instalações e telemetria de sistemas solares.' },
      tags: [
        { name: 'Sistema', description: 'Disponibilidade da API' },
        { name: 'Usuário', description: 'Dados do usuário e instalações' },
        { name: 'Telemetria', description: 'Medições e indicadores dos dispositivos' },
      ],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token emitido pelo Keycloak.' } },
        schemas: {
          Error: { type: 'object', required: ['error'], properties: { error: { type: 'string' } } },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });
}
