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

type Period = "24h" | "7d" | "30d" | "year";

type TotalGenerationQuery = {
  deviceId?: string;
  period?: Period;
};

type DeviceRow = {
  id: string;
  device_type: string;
};

type TotalGenerationRow = {
  total_kwh: string | null;
  sample_count: string | null;
  period_start: Date;
  period_end: Date;
};

function isValidPeriod(period: unknown): period is Period {
  return (
    period === "24h" || period === "7d" || period === "30d" || period === "year"
  );
}

export async function totalGenerationRoute(app: FastifyInstance) {
  app.get(
    "/total-generation",
    async (
      request: FastifyRequest<{
        Querystring: TotalGenerationQuery;
      }>,
      reply,
    ) => {
      const auth = await validateJwtToken(request, reply);

      if (!auth) {
        return;
      }

      const { deviceId, period } = request.query;

      if (!deviceId) {
        return reply.status(400).send({
          error: "deviceId é obrigatório.",
        });
      }

      if (!period) {
        return reply.status(400).send({
          error: "period é obrigatório.",
        });
      }

      if (!isValidPeriod(period)) {
        return reply.status(400).send({
          error: "Período inválido. Use: 24h, 7d, 30d ou year.",
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

        const result = await db.query<TotalGenerationRow>(
          `
          WITH bounds AS (
            SELECT
              CASE
                WHEN $2::text = '24h' THEN
                  date_trunc('hour', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '23 hours'

                WHEN $2::text = '7d' THEN
                  date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '6 days'

                WHEN $2::text = '30d' THEN
                  date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '29 days'

                WHEN $2::text = 'year' THEN
                  date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '11 months'
              END AS local_start,

              CASE
                WHEN $2::text = '24h' THEN
                  date_trunc('hour', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 hour'

                WHEN $2::text IN ('7d', '30d') THEN
                  date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 day'

                WHEN $2::text = 'year' THEN
                  date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 month'
              END AS local_end
          ),
          utc_bounds AS (
            SELECT
              local_start AT TIME ZONE 'America/Sao_Paulo' AS period_start,
              local_end AT TIME ZONE 'America/Sao_Paulo' AS period_end
            FROM bounds
          )
          SELECT
            COALESCE(SUM(ac.generation_kwh), 0::numeric) AS total_kwh,
            COALESCE(SUM(ac.sample_count), 0::bigint) AS sample_count,
            utc_bounds.period_start,
            utc_bounds.period_end
          FROM utc_bounds
          LEFT JOIN public.telemetry_ac_hourly ac
            ON ac.device_id = $1::uuid
           AND ac.bucket >= utc_bounds.period_start
           AND ac.bucket < utc_bounds.period_end
          GROUP BY
            utc_bounds.period_start,
            utc_bounds.period_end;
          `,
          [deviceId, period],
        );

        const row = result.rows[0];

        const totalKwh = Number(row.total_kwh ?? 0);

        return {
          deviceId,
          deviceType: "AC",
          period,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          totalKwh: Number(totalKwh.toFixed(2)),
          sampleCount: Number(row.sample_count ?? 0),
        };
      } catch (error) {
        console.error("Erro em /total-generation:", error);

        return reply.status(500).send({
          error: "Erro ao buscar geração total.",
        });
      }
    },
  );
}
