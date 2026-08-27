import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL não definido no .env");
}

const db = new Pool({
  connectionString: DATABASE_URL,
});

export async function getUserIdByKeycloakSub(keycloakSub: string) {
  const result = await db.query<{ id: string }>(
    `
    SELECT id
    FROM users
    WHERE keycloak_user_id = $1
    LIMIT 1
    `,
    [keycloakSub],
  );

  return result.rows[0]?.id ?? null;
}
