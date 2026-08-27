import { db } from '../database/pool.js';

export class UserRepository {
  async findIdByKeycloakSub(keycloakSub: string): Promise<string | null> {
    const result = await db.query<{ id: string }>(
      'SELECT id FROM users WHERE keycloak_user_id = $1 LIMIT 1',
      [keycloakSub],
    );
    return result.rows[0]?.id ?? null;
  }
}
