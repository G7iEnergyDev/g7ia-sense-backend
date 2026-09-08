export type DevicesLastRead = {
  installationId: string;
  ac: AcLastFeed[];
  dc: DcLastFeed[];
  env: EnvLastFeed[];
};

export type Device = {
  id: string;
  name: string;
  site: string;
};

export type AcLastFeed = {
  device: Device;
  feed: {
    time: Date;
    device_id: string;
    v1: number;
    c1: number;
    fp1: number;
    rssi: number;
  };
  isOnline: boolean;
};

export type DcLastFeed = {
  device: Device;
  feed: {
    time: Date;
    device_id: string;
    vdc1: number;
    cc1: number;
    vdc2: number;
    cc2: number;
    vdc3: number;
    cc3: number;
    rssi: number;
  };
  isOnline: boolean;
};

export type EnvLastFeed = {
  device: Device;
  feed: {
    time: Date;
    device_id: string;
    temp: number;
    humidity: number;
    solar: number;
    light: number;
    wind: number;
    h2: number;
    rssi: number;
  };
  isOnline: boolean;
};
