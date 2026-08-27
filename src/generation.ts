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

type GenerationPeriod = "24h" | "7d" | "30d" | "year";
type GenerationQuery = {
  deviceId?: string;
  period?: GenerationPeriod;
};

function isValidPeriod(period: unknown): period is GenerationPeriod {
  return (
    period === "24h" || period === "7d" || period === "30d" || period === "year"
  );
}

export async function generationRoute(app: FastifyInstance) {
  app.get(
    "/generation",
    async (
      request: FastifyRequest<{
        Querystring: GenerationQuery;
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
        const result = await db.query<{
          label: string;
          value: string;
        }>(
          `
  SELECT *
  FROM public.get_generation_v2($1::uuid, $2::text, $3::uuid)
  `,
          [deviceId, period, userId],
        );

        return {
          deviceId,
          period,
          data: result.rows.map((row) => ({
            label: row.label,
            value: Number(row.value),
          })),
        };
      } catch (error) {
        console.error("Erro em /generation:", {
          message: error instanceof Error ? error.message : String(error),
          error,
        });

        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "42501"
        ) {
          return reply.status(403).send({
            error: "Você não tem permissão para acessar este dispositivo.",
          });
        }

        return reply.status(500).send({
          error: "Erro ao buscar dados de geração.",
        });
      }
    },
  );
}
