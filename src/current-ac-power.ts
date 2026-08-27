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

type CurrentAcPowerQuery = {
  deviceId?: string;
};

type DeviceRow = {
  id: string;
  device_type: string;
};

type CurrentAcPowerRow = {
  time: Date;
  power_kw: string;
  power_w: string;
  v1: string;
  a1: string;
  fp1: string;
  rssi: string | null;
};

export async function currentAcPowerRoute(app: FastifyInstance) {
  app.get(
    "/current-ac-power",
    async (
      request: FastifyRequest<{
        Querystring: CurrentAcPowerQuery;
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

        if (device.device_type !== "AC") {
          return reply.status(400).send({
            error: "Esta rota aceita apenas dispositivos do tipo AC.",
          });
        }

        const result = await db.query<CurrentAcPowerRow>(
          `
          SELECT
            time,
            ((v1::NUMERIC * a1::NUMERIC * fp1::NUMERIC) / 1000.0) AS power_kw,
            (v1::NUMERIC * a1::NUMERIC * fp1::NUMERIC) AS power_w,
            v1,
            a1,
            fp1,
            rssi
          FROM telemetry_ac
          WHERE device_id = $1::uuid
          ORDER BY time DESC
          LIMIT 1;
          `,
          [deviceId],
        );

        const row = result.rows[0];

        if (!row) {
          return reply.status(404).send({
            error: "Nenhuma telemetria AC encontrada para este dispositivo.",
          });
        }

        const powerKw = Number(row.power_kw);
        const powerW = Number(row.power_w);

        return {
          deviceId,
          deviceType: "AC",
          time: row.time,
          powerKw: Number(powerKw.toFixed(2)),
          powerW: Number(powerW.toFixed(0)),
          raw: {
            v1: Number(row.v1),
            a1: Number(row.a1),
            fp1: Number(row.fp1),
            rssi: row.rssi !== null ? Number(row.rssi) : null,
          },
        };
      } catch (error) {
        console.error("Erro em /current-ac-power:", error);

        return reply.status(500).send({
          error: "Erro ao buscar potência AC atual.",
        });
      }
    },
  );
}
