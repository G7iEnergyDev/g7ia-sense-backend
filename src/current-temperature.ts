import type { FastifyInstance, FastifyRequest } from "fastify";
import { Pool } from "pg";

import { validateJwtToken } from "./utils/validateJwtToken.js";
import { getUserIdByKeycloakSub } from "./utils/getUserIdByKeycloakSub.js";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL não definido no .env");
}

const db = new Pool({
  connectionString: DATABASE_URL,
});

type CurrentTemperatureQuery = {
  deviceId?: string;
};

type DeviceRow = {
  id: string;
  device_type: string;
};

type CurrentTemperatureRow = {
  time: Date;
  temp: string;
  humidity: string | null;
  solar: string | null;
  light: string | null;
  wind: string | null;
  h2: string | null;
  rssi: string | null;
};

export async function currentTemperatureRoute(app: FastifyInstance) {
  app.get(
    "/current-temperature",
    async (
      request: FastifyRequest<{
        Querystring: CurrentTemperatureQuery;
      }>,
      reply,
    ) => {
      const auth = await validateJwtToken(request, reply);

      if (!auth) {
        return;
      }

      const { deviceId } = request.query;

      if (!deviceId) {
        return reply.status(400).send({
          error: "deviceId é obrigatório.",
        });
      }

      const userId = await getUserIdByKeycloakSub(auth.sub);

      if (!userId) {
        return reply.status(404).send({
          error: "Usuário não encontrado no banco de dados.",
        });
      }

      try {
        const deviceResult = await db.query<DeviceRow>(
          `
          SELECT
            d.id,
            d.device_type
          FROM devices d
          INNER JOIN installations i
            ON i.id = d.installation_id
          WHERE d.id = $1::uuid
            AND i.owner_id = $2::uuid
          LIMIT 1;
          `,
          [deviceId, userId],
        );

        const device = deviceResult.rows[0];

        if (!device) {
          return reply.status(403).send({
            error: "Dispositivo não encontrado ou acesso não autorizado.",
          });
        }

        if (device.device_type !== "ENV") {
          return reply.status(400).send({
            error: "Esta rota aceita apenas dispositivos do tipo ENV.",
          });
        }

        const result = await db.query<CurrentTemperatureRow>(
          `
          SELECT
            time,
            temp,
            humidity,
            solar,
            light,
            wind,
            h2,
            rssi
          FROM telemetry_env
          WHERE device_id = $1::uuid
          ORDER BY time DESC
          LIMIT 1;
          `,
          [deviceId],
        );

        const row = result.rows[0];

        if (!row) {
          return reply.status(404).send({
            error: "Nenhuma telemetria ENV encontrada para este dispositivo.",
          });
        }

        return {
          deviceId,
          deviceType: "ENV",
          time: row.time,
          temperatureCelsius: Number(Number(row.temp).toFixed(1)),
          raw: {
            temp: Number(row.temp),
            humidity: row.humidity !== null ? Number(row.humidity) : null,
            solar: row.solar !== null ? Number(row.solar) : null,
            light: row.light !== null ? Number(row.light) : null,
            wind: row.wind !== null ? Number(row.wind) : null,
            h2: row.h2 !== null ? Number(row.h2) : null,
            rssi: row.rssi !== null ? Number(row.rssi) : null,
          },
        };
      } catch (error) {
        console.error("Erro em /current-temperature:", error);

        return reply.status(500).send({
          error: "Erro ao buscar temperatura atual.",
        });
      }
    },
  );
}
