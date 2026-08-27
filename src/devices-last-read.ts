import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Pool } from 'pg';

import { validateJwtToken } from './utils/validateJwtToken.js';
import { getUserIdByKeycloakSub } from './utils/getUserIdByKeycloakSub.js';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL não definido no .env');
}

const db = new Pool({
  connectionString: DATABASE_URL,
});

type DevicesLastReadQuery = {
  installationId?: string;
};

type InstallationRow = {
  id: string;
};

type AcLastReadRow = {
  time: Date;
  device_id: string;
  v1: string;
  a1: string;
  fp1: string;
  rssi: string;
};

type DcLastReadRow = {
  time: Date;
  device_id: string;
  vdc1: string;
  cc1: string;
  vdc2: string;
  cc2: string;
  vdc3: string;
  cc3: string;
  rssi: string;
};

type EnvLastReadRow = {
  time: Date;
  device_id: string;
  temp: string;
  humidity: string;
  solar: string;
  light: string;
  wind: string;
  h2: string;
  rssi: string;
};

export async function devicesLastReadRoute(app: FastifyInstance) {
  app.get(
    '/devices-last-read',
    async (
      request: FastifyRequest<{
        Querystring: DevicesLastReadQuery;
      }>,
      reply,
    ) => {
      const auth = await validateJwtToken(request, reply);

      if (!auth) {
        return;
      }

      const { installationId } = request.query;

      if (!installationId) {
        return reply.status(400).send({
          error: 'deviceId é obrigatório.',
        });
      }

      const userId = await getUserIdByKeycloakSub(auth.sub);

      if (!userId) {
        return reply.status(404).send({
          error: 'Usuário não encontrado no banco de dados.',
        });
      }

      try {
        const installationResult = await db.query<InstallationRow>(
          `
          SELECT
            i.id,
            i.owner_id
          FROM installations i
          WHERE i.id = $1::uuid
            AND i.owner_id = $2::uuid
          LIMIT 1;
          `,
          [installationId, userId],
        );

        const installation = installationResult.rows[0];

        if (!installation) {
          return reply.status(403).send({
            error: 'Instalação não encontrada ou acesso não autorizado.',
          });
        }

        const [acResult, dcResult, envResult] = await Promise.all([
          db.query<AcLastReadRow>(
            `
            SELECT
                t.*
            FROM devices d
            CROSS JOIN LATERAL (
                SELECT *
                FROM telemetry_ac t
                WHERE t.device_id = d.id
                ORDER BY t.time DESC
                LIMIT 1
            ) t
            WHERE d.installation_id = $1::uuid
              AND d.device_type = 'AC';
            `,
            [installationId],
          ),

          db.query<DcLastReadRow>(
            `
            SELECT
                t.*
            FROM devices d
            CROSS JOIN LATERAL (
                SELECT *
                FROM telemetry_dc t
                WHERE t.device_id = d.id
                ORDER BY t.time DESC
                LIMIT 1
            ) t
            WHERE d.installation_id = $1::uuid
              AND d.device_type = 'DC';
            `,
            [installationId],
          ),

          db.query<EnvLastReadRow>(
            `
            SELECT
                t.*
            FROM devices d
            CROSS JOIN LATERAL (
                SELECT *
                FROM telemetry_env t
                WHERE t.device_id = d.id
                ORDER BY t.time DESC
                LIMIT 1
            ) t
            WHERE d.installation_id = $1::uuid
              AND d.device_type = 'ENV';
            `,
            [installationId],
          ),
        ]);

        const ac = acResult.rows.map((row) => ({
          deviceId: row.device_id,
          deviceType: 'AC',
          time: row.time,
          v1: Number(row.v1),
          a1: Number(row.a1),
          fp1: Number(row.fp1),
          rssi: Number(row.rssi),
        }));

        const dc = dcResult.rows.map((row) => ({
          deviceId: row.device_id,
          deviceType: 'DC',
          time: row.time,
          vdc1: Number(row.vdc1),
          cc1: Number(row.cc1),
          vdc2: Number(row.vdc2),
          cc2: Number(row.cc2),
          vdc3: Number(row.vdc3),
          cc3: Number(row.cc3),
          rssi: Number(row.rssi),
        }));

        const env = envResult.rows.map((row) => ({
          deviceId: row.device_id,
          deviceType: 'ENV',
          time: row.time,
          temp: Number(row.temp),
          humidity: Number(row.humidity),
          solar: Number(row.solar),
          light: Number(row.light),
          wind: Number(row.wind),
          h2: Number(row.h2),
          rssi: Number(row.rssi),
        }));

        return {
          installationId: installationId,
          ac,
          dc,
          env,
        };
      } catch (error) {
        console.error('Erro em /devices-last-read:', error);

        return reply.status(500).send({
          error: 'Erro ao buscar últimas leituras dos dispositivos.',
        });
      }
    },
  );
}
