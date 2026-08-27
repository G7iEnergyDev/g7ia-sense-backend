import { db } from '../database/pool.js';
import type { DeviceType } from '../models/device.js';

type InstallationRow = { id: string; name: string; created_at: Date; devices: { id: string; type: DeviceType }[] };

export class InstallationRepository {
  async findAllByOwner(ownerId: string) {
    const result = await db.query<InstallationRow>(`
      SELECT i.id, i.name, i.created_at,
        COALESCE(json_agg(json_build_object('id', d.id, 'type', d.device_type) ORDER BY d.device_type)
          FILTER (WHERE d.id IS NOT NULL), '[]'::json) AS devices
      FROM installations i LEFT JOIN devices d ON d.installation_id = i.id
      WHERE i.owner_id = $1
      GROUP BY i.id, i.name, i.created_at ORDER BY i.created_at ASC`, [ownerId]);
    return result.rows;
  }

  async belongsToOwner(installationId: string, ownerId: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM installations WHERE id = $1::uuid AND owner_id = $2::uuid LIMIT 1',
      [installationId, ownerId],
    );
    return result.rowCount === 1;
  }
}
