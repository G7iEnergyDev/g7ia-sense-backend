import type { Period, DeviceType } from '../models/device.js';
import { DeviceRepository } from '../repositories/device.repository.js';
import { TelemetryRepository } from '../repositories/telemetry.repository.js';

export class TelemetryService {
  constructor(private readonly devices = new DeviceRepository(), private readonly telemetry = new TelemetryRepository()) {}

  async assertDevice(deviceId: string, userId: string, expected: DeviceType) {
    const device = await this.devices.findOwned(deviceId, userId);
    if (!device) return 'not-found' as const;
    return device.type === expected ? ('ok' as const) : ('wrong-type' as const);
  }

  async generation(deviceId: string, period: Period, userId: string) {
    const result = await this.telemetry.generation(deviceId, period, userId);
    return { deviceId, period, data: result.rows.map(({ label, value }) => ({ label, value: Number(value) })) };
  }

  async currentAcPower(deviceId: string) {
    const row = await this.telemetry.latestAc(deviceId);
    if (!row) return null;
    return { deviceId, deviceType: 'AC', time: row.time, powerKw: Number(Number(row.power_kw).toFixed(2)), powerW: Number(Number(row.power_w).toFixed(0)),
      raw: { v1: Number(row.v1), a1: Number(row.a1), fp1: Number(row.fp1), rssi: row.rssi === null ? null : Number(row.rssi) } };
  }

  async currentTemperature(deviceId: string) {
    const row = await this.telemetry.latestEnv(deviceId);
    if (!row) return null;
    const numberOrNull = (value: string | null) => value === null ? null : Number(value);
    return { deviceId, deviceType: 'ENV', time: row.time, temperatureCelsius: Number(Number(row.temp).toFixed(1)),
      raw: { temp: Number(row.temp), humidity: numberOrNull(row.humidity), solar: numberOrNull(row.solar), light: numberOrNull(row.light), wind: numberOrNull(row.wind), h2: numberOrNull(row.h2), rssi: numberOrNull(row.rssi) } };
  }

  async totalGeneration(deviceId: string, period: Period) {
    const row = (await this.telemetry.totalGeneration(deviceId, period)).rows[0]!;
    return { deviceId, deviceType: 'AC', period, periodStart: row.period_start as Date, periodEnd: row.period_end as Date,
      totalKwh: Number(Number(row.total_kwh ?? 0).toFixed(2)), sampleCount: Number(row.sample_count ?? 0) };
  }

  async dcAcEfficiency(acDeviceId: string, dcDeviceId: string, period: Period) {
    const row = (await this.telemetry.efficiency(acDeviceId, dcDeviceId, period)).rows[0]!;
    const percent = row.efficiency_percent === null ? null : Number(Number(row.efficiency_percent).toFixed(2));
    return { period, periodStart: row.period_start as Date, periodEnd: row.period_end as Date,
      ac: { deviceId: acDeviceId, totalKwh: Number(Number(row.ac_kwh ?? 0).toFixed(2)), sampleCount: Number(row.ac_sample_count ?? 0) },
      dc: { deviceId: dcDeviceId, totalKwh: Number(Number(row.dc_kwh ?? 0).toFixed(2)), sampleCount: Number(row.dc_sample_count ?? 0) }, efficiencyPercent: percent };
  }

  async validateAcDcPair(acDeviceId: string, dcDeviceId: string, userId: string) { return this.devices.validateAcDcPair(acDeviceId, dcDeviceId, userId); }

  async lastReads(installationId: string) {
    const { ac, dc, env } = await this.telemetry.lastReads(installationId);
    const map = (rows: Record<string, unknown>[], deviceType: DeviceType, fields: string[]) => rows.map((row) => {
      const output: Record<string, unknown> = { deviceId: row.device_id, deviceType, time: row.time };
      for (const field of fields) output[field] = Number(row[field]);
      return output;
    });
    return { installationId, ac: map(ac, 'AC', ['v1', 'a1', 'fp1', 'rssi']), dc: map(dc, 'DC', ['vdc1', 'cc1', 'vdc2', 'cc2', 'vdc3', 'cc3', 'rssi']), env: map(env, 'ENV', ['temp', 'humidity', 'solar', 'light', 'wind', 'h2', 'rssi']) };
  }
}
