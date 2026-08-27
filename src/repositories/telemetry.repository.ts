import { db } from '../database/pool.js';
import type { Period } from '../models/device.js';

export class TelemetryRepository {
  async latestAc(deviceId: string) {
    const result = await db.query<{ time: Date; power_kw: string; power_w: string; v1: string; a1: string; fp1: string; rssi: string | null }>(`
      SELECT time, ((v1::numeric * a1::numeric * fp1::numeric) / 1000) AS power_kw,
        (v1::numeric * a1::numeric * fp1::numeric) AS power_w, v1, a1, fp1, rssi
      FROM telemetry_ac WHERE device_id = $1::uuid ORDER BY time DESC LIMIT 1`, [deviceId]);
    return result.rows[0] ?? null;
  }

  async latestEnv(deviceId: string) {
    const result = await db.query<{ time: Date; temp: string; humidity: string | null; solar: string | null; light: string | null; wind: string | null; h2: string | null; rssi: string | null }>(`
      SELECT time, temp, humidity, solar, light, wind, h2, rssi FROM telemetry_env
      WHERE device_id = $1::uuid ORDER BY time DESC LIMIT 1`, [deviceId]);
    return result.rows[0] ?? null;
  }

  async generation(deviceId: string, period: Period, userId: string) {
    return db.query<{ label: string; value: string }>(
      'SELECT * FROM public.get_generation_v2($1::uuid, $2::text, $3::uuid)', [deviceId, period, userId]);
  }

  async totalGeneration(deviceId: string, period: Period) {
    return this.aggregate(`
      SELECT COALESCE(SUM(ac.generation_kwh), 0::numeric) AS total_kwh,
        COALESCE(SUM(ac.sample_count), 0::bigint) AS sample_count, b.period_start, b.period_end
      FROM bounds b LEFT JOIN telemetry_ac_hourly ac ON ac.device_id = $1::uuid
        AND ac.bucket >= b.period_start AND ac.bucket < b.period_end
      GROUP BY b.period_start, b.period_end`, [deviceId, period]);
  }

  async efficiency(acDeviceId: string, dcDeviceId: string, period: Period) {
    return this.aggregate(`
      SELECT ac.ac_kwh, dc.dc_kwh,
        CASE WHEN dc.dc_kwh <= 0 THEN NULL ELSE (ac.ac_kwh / dc.dc_kwh) * 100 END AS efficiency_percent,
        ac.sample_count AS ac_sample_count, dc.sample_count AS dc_sample_count, b.period_start, b.period_end
      FROM bounds b
      CROSS JOIN LATERAL (SELECT COALESCE(SUM(generation_kwh),0::numeric) ac_kwh, COALESCE(SUM(sample_count),0::bigint) sample_count FROM telemetry_ac_hourly WHERE device_id=$1::uuid AND bucket >= b.period_start AND bucket < b.period_end) ac
      CROSS JOIN LATERAL (SELECT COALESCE(SUM(generation_kwh),0::numeric) dc_kwh, COALESCE(SUM(sample_count),0::bigint) sample_count FROM telemetry_dc_hourly WHERE device_id=$2::uuid AND bucket >= b.period_start AND bucket < b.period_end) dc`, [acDeviceId, dcDeviceId, period]);
  }

  async lastReads(installationId: string) {
    const [ac, dc, env] = await Promise.all([
      db.query(`SELECT t.* FROM devices d CROSS JOIN LATERAL (SELECT * FROM telemetry_ac t WHERE t.device_id=d.id ORDER BY t.time DESC LIMIT 1) t WHERE d.installation_id=$1::uuid AND d.device_type='AC'`, [installationId]),
      db.query(`SELECT t.* FROM devices d CROSS JOIN LATERAL (SELECT * FROM telemetry_dc t WHERE t.device_id=d.id ORDER BY t.time DESC LIMIT 1) t WHERE d.installation_id=$1::uuid AND d.device_type='DC'`, [installationId]),
      db.query(`SELECT t.* FROM devices d CROSS JOIN LATERAL (SELECT * FROM telemetry_env t WHERE t.device_id=d.id ORDER BY t.time DESC LIMIT 1) t WHERE d.installation_id=$1::uuid AND d.device_type='ENV'`, [installationId]),
    ]);
    return { ac: ac.rows, dc: dc.rows, env: env.rows };
  }

  private async aggregate(sql: string, params: unknown[]) {
    return db.query<Record<string, string | Date | null>>(`
      WITH bounds AS (
        SELECT
          (CASE WHEN $${params.length}::text='24h' THEN date_trunc('hour', NOW() AT TIME ZONE 'America/Sao_Paulo') - interval '23 hours'
            WHEN $${params.length}::text='7d' THEN date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') - interval '6 days'
            WHEN $${params.length}::text='30d' THEN date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') - interval '29 days'
            WHEN $${params.length}::text='year' THEN date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') - interval '11 months' END AT TIME ZONE 'America/Sao_Paulo') period_start,
          (CASE WHEN $${params.length}::text='24h' THEN date_trunc('hour', NOW() AT TIME ZONE 'America/Sao_Paulo') + interval '1 hour'
            WHEN $${params.length}::text IN ('7d','30d') THEN date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day'
            WHEN $${params.length}::text='year' THEN date_trunc('month', NOW() AT TIME ZONE 'America/Sao_Paulo') + interval '1 month' END AT TIME ZONE 'America/Sao_Paulo') period_end
      ) ${sql}`, params);
  }
}
