import type { FastifyInstance } from "fastify";
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

type DeviceRow = {
  id: string;
  type: "AC" | "DC" | "ENV" | string;
};

type InstallationRow = {
  id: string;
  name: string;
  created_at: Date;
  devices: DeviceRow[];
};

export async function installationsRoute(app: FastifyInstance) {
  app.get("/my-installations", async (request, reply) => {
    const auth = await validateJwtToken(request, reply);

    if (!auth) {
      return;
    }

    const userId = await getUserIdByKeycloakSub(auth.sub);

    if (!userId) {
      return reply.status(404).send({
        error: "Usuário não encontrado no banco de dados.",
      });
    }

    try {
      const result = await db.query<InstallationRow>(
        `
        SELECT
          i.id,
          i.name,
          i.created_at,

          COALESCE(
            json_agg(
              json_build_object(
                'id', d.id,
                'type', d.device_type
              )
              ORDER BY d.device_type
            ) FILTER (WHERE d.id IS NOT NULL),
            '[]'::json
          ) AS devices

        FROM installations i

        LEFT JOIN devices d
          ON d.installation_id = i.id

        WHERE i.owner_id = $1

        GROUP BY
          i.id,
          i.name,
          i.created_at

        ORDER BY
          i.created_at ASC;
        `,
        [userId],
      );

      return result.rows.map((installation) => ({
        id: installation.id,
        name: installation.name,
        createdAt: installation.created_at,
        devices: installation.devices,
      }));
    } catch (error) {
      console.error("Erro em /my-installations:", error);

      return reply.status(500).send({
        error: "Erro ao buscar instalações.",
      });
    }
  });
}
