export type DeviceType = 'AC' | 'DC' | 'ENV';
export type Period = '24h' | '7d' | '30d' | 'year';

export function isPeriod(value: unknown): value is Period {
  return value === '24h' || value === '7d' || value === '30d' || value === 'year';
}
