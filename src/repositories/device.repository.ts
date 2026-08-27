import { db } from '../database/pool.js';
import type { DeviceType } from '../models/device.js';

export class DeviceRepository {
  async findOwned(deviceId: string, ownerId: string): Promise<{ id: string; type: DeviceType } | null> {
    const result = await db.query<{ id: string; device_type: DeviceType }>(`
      SELECT d.id, d.device_type FROM devices d
      INNER JOIN installations i ON i.id = d.installation_id
      WHERE d.id = $1::uuid AND i.owner_id = $2::uuid LIMIT 1`, [deviceId, ownerId]);
    const row = result.rows[0];
    return row ? { id: row.id, type: row.device_type } : null;
  }

  async validateAcDcPair(acDeviceId: string, dcDeviceId: string, ownerId: string) {
    const result = await db.query<{ ac_found: string; dc_found: string; same_installation: boolean }>(`
      SELECT COUNT(*) FILTER (WHERE d.id = $1::uuid AND d.device_type = 'AC') AS ac_found,
        COUNT(*) FILTER (WHERE d.id = $2::uuid AND d.device_type = 'DC') AS dc_found,
        COUNT(DISTINCT d.installation_id) = 1 AS same_installation
      FROM devices d INNER JOIN installations i ON i.id = d.installation_id
      WHERE i.owner_id = $3::uuid AND d.id IN ($1::uuid, $2::uuid)`, [acDeviceId, dcDeviceId, ownerId]);
    const row = result.rows[0];
    return { acFound: Number(row.ac_found) === 1, dcFound: Number(row.dc_found) === 1, sameInstallation: row.same_installation };
  }
}
