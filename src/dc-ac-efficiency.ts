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

type DcAcEfficiencyQuery = {
  acDeviceId?: string;
  dcDeviceId?: string;
  period?: Period;
};

type DeviceValidationRow = {
  ac_found: string;
  dc_found: string;
  same_installation: boolean;
};

type EfficiencyRow = {
  ac_kwh: string | null;
  dc_kwh: string | null;
  efficiency_percent: string | null;
  ac_sample_count: string | null;
  dc_sample_count: string | null;
  period_start: Date;
  period_end: Date;
};

function isValidPeriod(period: unknown): period is Period {
  return (
    period === "24h" || period === "7d" || period === "30d" || period === "year"
  );
}

export async function dcAcEfficiencyRoute(app: FastifyInstance) {
  app.get(
    "/dc-ac-efficiency",
    async (
      request: FastifyRequest<{
        Querystring: DcAcEfficiencyQuery;
      }>,
      reply,
    ) => {
      const auth = await validateJwtToken(request, reply);

      if (!auth) {
        return;
      }

      const { acDeviceId, dcDeviceId, period } = request.query;

      if (!acDeviceId) {
        return reply.status(400).send({
          error: "acDeviceId é obrigatório.",
        });
      }

      if (!dcDeviceId) {
        return reply.status(400).send({
          error: "dcDeviceId é obrigatório.",
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
        const validationResult = await db.query<DeviceValidationRow>(
          `
          SELECT
            COUNT(*) FILTER (
              WHERE d.id = $1::uuid
                AND d.device_type = 'AC'
            ) AS ac_found,

            COUNT(*) FILTER (
              WHERE d.id = $2::uuid
                AND d.device_type = 'DC'
            ) AS dc_found,

            COUNT(DISTINCT d.installation_id) = 1 AS same_installation

          FROM devices d
          INNER JOIN installations i
            ON i.id = d.installation_id
          WHERE i.owner_id = $3::uuid
            AND d.id IN ($1::uuid, $2::uuid);
          `,
          [acDeviceId, dcDeviceId, userId],
        );

        const validation = validationResult.rows[0];

        const acFound = Number(validation.ac_found);
        const dcFound = Number(validation.dc_found);

        if (acFound !== 1) {
          return reply.status(403).send({
            error: "Dispositivo AC não encontrado ou acesso não autorizado.",
          });
        }

        if (dcFound !== 1) {
          return reply.status(403).send({
            error: "Dispositivo DC não encontrado ou acesso não autorizado.",
          });
        }

        if (!validation.same_installation) {
          return reply.status(400).send({
            error:
              "Os dispositivos AC e DC precisam pertencer à mesma instalação.",
          });
        }

        const result = await db.query<EfficiencyRow>(
          `
          WITH bounds AS (
            SELECT
              CASE
                WHEN $3::text = '24h' THEN
                  date_trunc('hour', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '23 hours'

                WHEN $3::text = '7d' THEN
                  date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '6 days'

                WHEN $3::text = '30d' THEN
                  date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '29 days'

                WHEN $3::text = 'year' THEN
                  date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '11 months'
              END AS local_start,

              CASE
                WHEN $3::text = '24h' THEN
                  date_trunc('hour', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 hour'

                WHEN $3::text IN ('7d', '30d') THEN
                  date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 day'

                WHEN $3::text = 'year' THEN
                  date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '1 month'
              END AS local_end
          ),
          utc_bounds AS (
            SELECT
              local_start AT TIME ZONE 'America/Sao_Paulo' AS period_start,
              local_end AT TIME ZONE 'America/Sao_Paulo' AS period_end
            FROM bounds
          ),
          ac_total AS (
            SELECT
              COALESCE(SUM(ac.generation_kwh), 0::numeric) AS ac_kwh,
              COALESCE(SUM(ac.sample_count), 0::bigint) AS ac_sample_count
            FROM utc_bounds
            LEFT JOIN public.telemetry_ac_hourly ac
              ON ac.device_id = $1::uuid
             AND ac.bucket >= utc_bounds.period_start
             AND ac.bucket < utc_bounds.period_end
          ),
          dc_total AS (
            SELECT
              COALESCE(SUM(dc.generation_kwh), 0::numeric) AS dc_kwh,
              COALESCE(SUM(dc.sample_count), 0::bigint) AS dc_sample_count
            FROM utc_bounds
            LEFT JOIN public.telemetry_dc_hourly dc
              ON dc.device_id = $2::uuid
             AND dc.bucket >= utc_bounds.period_start
             AND dc.bucket < utc_bounds.period_end
          )
          SELECT
            ac_total.ac_kwh,
            dc_total.dc_kwh,

            CASE
              WHEN dc_total.dc_kwh <= 0 THEN NULL
              ELSE (ac_total.ac_kwh / dc_total.dc_kwh) * 100.0
            END AS efficiency_percent,

            ac_total.ac_sample_count,
            dc_total.dc_sample_count,
            utc_bounds.period_start,
            utc_bounds.period_end

          FROM utc_bounds, ac_total, dc_total;
          `,
          [acDeviceId, dcDeviceId, period],
        );

        const row = result.rows[0];

        const acKwh = Number(row.ac_kwh ?? 0);
        const dcKwh = Number(row.dc_kwh ?? 0);

        const efficiencyPercent =
          row.efficiency_percent !== null
            ? Number(Number(row.efficiency_percent).toFixed(2))
            : null;

        return {
          period,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          ac: {
            deviceId: acDeviceId,
            totalKwh: Number(acKwh.toFixed(2)),
            sampleCount: Number(row.ac_sample_count ?? 0),
          },
          dc: {
            deviceId: dcDeviceId,
            totalKwh: Number(dcKwh.toFixed(2)),
            sampleCount: Number(row.dc_sample_count ?? 0),
          },
          efficiencyPercent,
        };
      } catch (error) {
        console.error("Erro em /dc-ac-efficiency:", error);

        return reply.status(500).send({
          error: "Erro ao buscar eficiência DC/AC.",
        });
      }
    },
  );
}
