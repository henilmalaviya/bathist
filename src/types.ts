export interface BatteryStaticInfo {
  name: string; // e.g. "BAT0"
  path: string; // e.g. "/sys/class/power_supply/BAT0"
  modelName: string;
  manufacturer: string;
  serialNumber: string;
  technology: string;
  energyFullDesignWh: number;
  voltageMinDesignV: number;
}

export interface BatteryReading {
  id?: number;
  batteryName: string;
  timestamp: number; // Unix timestamp in seconds
  capacityPercent: number; // 0-100
  capacityLevel: string; // "Normal", "Full", "Low", etc.
  status: string; // "Charging", "Discharging", "Full", "Not charging", "Unknown"
  energyNowWh: number; // Energy currently stored in Wh
  energyFullWh: number; // Max energy full capacity in Wh
  energyFullDesignWh: number; // Factory design capacity in Wh
  powerW: number; // Current power draw/charge rate in Watts (positive = discharging/charging, signed or status-differentiated)
  voltageV: number; // Current voltage in Volts
  cycleCount: number; // Charge cycles
  sohPercent: number; // State of Health: (energyFullWh / energyFullDesignWh) * 100
  timeToEmptyMin: number | null; // Estimated minutes remaining until empty
  timeToFullMin: number | null; // Estimated minutes remaining until full
}

export interface BatterySummary {
  batteryName: string;
  recordCount: number;
  firstTimestamp: number;
  lastTimestamp: number;
  minCapacityPercent: number;
  maxCapacityPercent: number;
  avgPowerW: number;
  maxPowerW: number;
  currentSohPercent: number;
  latestStatus: string;
  latestCapacityPercent: number;
  latestPowerW: number;
  latestVoltageV: number;
  latestEnergyNowWh: number;
  latestEnergyFullWh: number;
  latestEnergyFullDesignWh: number;
  cycleCount: number;
}

export interface DaemonOptions {
  intervalMs: number;
  dbPath?: string;
  verbose?: boolean;
}

export interface ReportOptions {
  timeRange: string; // '1h' | '6h' | '12h' | '24h' | '7d' | '30d' | 'all'
  outputPath: string;
  dbPath?: string;
  batteryName?: string;
}
