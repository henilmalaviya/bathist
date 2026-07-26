import { readdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import type { BatteryReading, BatteryStaticInfo } from "./types.js";

const SYSFS_POWER_SUPPLY = "/sys/class/power_supply";

/**
 * Discovers all battery devices present in /sys/class/power_supply/
 */
export function discoverBatteries(sysfsPath = SYSFS_POWER_SUPPLY): string[] {
  if (!existsSync(sysfsPath)) {
    return [];
  }

  try {
    const entries = readdirSync(sysfsPath);
    return entries.filter((entry) => {
      const entryPath = join(sysfsPath, entry);
      const typePath = join(entryPath, "type");

      // Check if entry starts with BAT or type file says Battery
      if (entry.startsWith("BAT")) return true;

      if (existsSync(typePath)) {
        try {
          const typeStr = readFileSync(typePath, "utf-8").trim();
          return typeStr.toLowerCase() === "battery";
        } catch {
          return false;
        }
      }
      return false;
    });
  } catch (err) {
    console.error(`[sysfs] Failed to list ${sysfsPath}:`, err);
    return [];
  }
}

/**
 * Safely reads a single file node in sysfs or returns fallback
 */
function readSysfsNode(batteryPath: string, filename: string): string | null {
  const nodePath = join(batteryPath, filename);
  if (!existsSync(nodePath)) return null;
  try {
    return readFileSync(nodePath, "utf-8").trim();
  } catch {
    return null;
  }
}

/**
 * Parses uevent key=value file from sysfs into a Map
 */
function readUevent(batteryPath: string): Map<string, string> {
  const map = new Map<string, string>();
  const ueventStr = readSysfsNode(batteryPath, "uevent");
  if (!ueventStr) return map;

  for (const line of ueventStr.split("\n")) {
    const eqIdx = line.indexOf("=");
    if (eqIdx > 0) {
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();
      map.set(key, val);
    }
  }
  return map;
}

/**
 * Fetches static battery information (model, serial, design capacity)
 */
export function getBatteryStaticInfo(
  batteryName: string,
  sysfsPath = SYSFS_POWER_SUPPLY
): BatteryStaticInfo {
  const batteryPath = join(sysfsPath, batteryName);
  const uevent = readUevent(batteryPath);

  const modelName =
    uevent.get("POWER_SUPPLY_MODEL_NAME") ||
    readSysfsNode(batteryPath, "model_name") ||
    "Unknown";

  const manufacturer =
    uevent.get("POWER_SUPPLY_MANUFACTURER") ||
    readSysfsNode(batteryPath, "manufacturer") ||
    "Unknown";

  const serialNumber =
    uevent.get("POWER_SUPPLY_SERIAL_NUMBER") ||
    readSysfsNode(batteryPath, "serial_number") ||
    "Unknown";

  const technology =
    uevent.get("POWER_SUPPLY_TECHNOLOGY") ||
    readSysfsNode(batteryPath, "technology") ||
    "Unknown";

  // Design energy in uWh or design charge in uAh
  const energyDesignRaw =
    uevent.get("POWER_SUPPLY_ENERGY_FULL_DESIGN") ||
    readSysfsNode(batteryPath, "energy_full_design");
  const voltageMinDesignRaw =
    uevent.get("POWER_SUPPLY_VOLTAGE_MIN_DESIGN") ||
    readSysfsNode(batteryPath, "voltage_min_design");

  let energyFullDesignWh = 0;
  if (energyDesignRaw) {
    energyFullDesignWh = parseFloat(energyDesignRaw) / 1_000_000;
  }

  let voltageMinDesignV = 0;
  if (voltageMinDesignRaw) {
    voltageMinDesignV = parseFloat(voltageMinDesignRaw) / 1_000_000;
  }

  return {
    name: batteryName,
    path: batteryPath,
    modelName,
    manufacturer,
    serialNumber,
    technology,
    energyFullDesignWh,
    voltageMinDesignV,
  };
}

/**
 * Captures instantaneous reading for a battery
 */
export function readBatterySnapshot(
  batteryName: string,
  prevReading?: BatteryReading,
  sysfsPath = SYSFS_POWER_SUPPLY
): BatteryReading {
  const batteryPath = join(sysfsPath, batteryName);
  const uevent = readUevent(batteryPath);
  const timestamp = Math.floor(Date.now() / 1000);

  // Status
  const status =
    uevent.get("POWER_SUPPLY_STATUS") ||
    readSysfsNode(batteryPath, "status") ||
    "Unknown";

  // Capacity %
  const capStr =
    uevent.get("POWER_SUPPLY_CAPACITY") ||
    readSysfsNode(batteryPath, "capacity");
  const capacityPercent = capStr ? Math.min(100, Math.max(0, parseInt(capStr, 10))) : 0;

  // Capacity Level
  const capacityLevel =
    uevent.get("POWER_SUPPLY_CAPACITY_LEVEL") ||
    readSysfsNode(batteryPath, "capacity_level") ||
    "Normal";

  // Voltage in V
  const voltStr =
    uevent.get("POWER_SUPPLY_VOLTAGE_NOW") ||
    readSysfsNode(batteryPath, "voltage_now");
  let voltageV = voltStr ? parseFloat(voltStr) / 1_000_000 : 0;

  // Energy Now in Wh (or calculate from charge_now * voltage)
  let energyNowWh = 0;
  const energyNowStr =
    uevent.get("POWER_SUPPLY_ENERGY_NOW") ||
    readSysfsNode(batteryPath, "energy_now");
  if (energyNowStr) {
    energyNowWh = parseFloat(energyNowStr) / 1_000_000;
  } else {
    const chargeNowStr =
      uevent.get("POWER_SUPPLY_CHARGE_NOW") ||
      readSysfsNode(batteryPath, "charge_now");
    if (chargeNowStr && voltageV > 0) {
      const chargeNowAh = parseFloat(chargeNowStr) / 1_000_000;
      energyNowWh = chargeNowAh * voltageV;
    }
  }

  // Energy Full in Wh
  let energyFullWh = 0;
  const energyFullStr =
    uevent.get("POWER_SUPPLY_ENERGY_FULL") ||
    readSysfsNode(batteryPath, "energy_full");
  if (energyFullStr) {
    energyFullWh = parseFloat(energyFullStr) / 1_000_000;
  } else {
    const chargeFullStr =
      uevent.get("POWER_SUPPLY_CHARGE_FULL") ||
      readSysfsNode(batteryPath, "charge_full");
    if (chargeFullStr && voltageV > 0) {
      const chargeFullAh = parseFloat(chargeFullStr) / 1_000_000;
      energyFullWh = chargeFullAh * voltageV;
    }
  }

  // Energy Full Design in Wh
  let energyFullDesignWh = 0;
  const energyFullDesignStr =
    uevent.get("POWER_SUPPLY_ENERGY_FULL_DESIGN") ||
    readSysfsNode(batteryPath, "energy_full_design");
  if (energyFullDesignStr) {
    energyFullDesignWh = parseFloat(energyFullDesignStr) / 1_000_000;
  } else {
    const chargeFullDesignStr =
      uevent.get("POWER_SUPPLY_CHARGE_FULL_DESIGN") ||
      readSysfsNode(batteryPath, "charge_full_design");
    if (chargeFullDesignStr && voltageV > 0) {
      energyFullDesignWh = (parseFloat(chargeFullDesignStr) / 1_000_000) * voltageV;
    }
  }

  // Cycle Count
  const cycleCountStr =
    uevent.get("POWER_SUPPLY_CYCLE_COUNT") ||
    readSysfsNode(batteryPath, "cycle_count");
  const cycleCount = cycleCountStr ? parseInt(cycleCountStr, 10) : 0;

  // Power in Watts
  let powerW = 0;
  const powerNowStr =
    uevent.get("POWER_SUPPLY_POWER_NOW") ||
    readSysfsNode(batteryPath, "power_now");
  if (powerNowStr) {
    powerW = Math.abs(parseFloat(powerNowStr) / 1_000_000);
  } else {
    const currentNowStr =
      uevent.get("POWER_SUPPLY_CURRENT_NOW") ||
      readSysfsNode(batteryPath, "current_now");
    if (currentNowStr && voltageV > 0) {
      const currentA = Math.abs(parseFloat(currentNowStr) / 1_000_000);
      powerW = currentA * voltageV;
    } else if (prevReading && prevReading.timestamp < timestamp) {
      // Fallback: estimate power draw from delta energy over delta time
      const dtHours = (timestamp - prevReading.timestamp) / 3600;
      if (dtHours > 0) {
        const dWh = Math.abs(energyNowWh - prevReading.energyNowWh);
        powerW = dWh / dtHours;
      }
    }
  }

  // Round values cleanly
  energyNowWh = Math.round(energyNowWh * 1000) / 1000;
  energyFullWh = Math.round(energyFullWh * 1000) / 1000;
  energyFullDesignWh = Math.round(energyFullDesignWh * 1000) / 1000;
  powerW = Math.round(powerW * 100) / 100;
  voltageV = Math.round(voltageV * 1000) / 1000;

  // State of Health %
  let sohPercent = 100;
  if (energyFullDesignWh > 0) {
    sohPercent = Math.min(100, Math.round((energyFullWh / energyFullDesignWh) * 10000) / 100);
  }

  // Remaining time estimation
  let timeToEmptyMin: number | null = null;
  let timeToFullMin: number | null = null;

  if (status.toLowerCase() === "discharging" && powerW > 0.1) {
    timeToEmptyMin = Math.round((energyNowWh / powerW) * 60);
  } else if (status.toLowerCase() === "charging" && powerW > 0.1 && energyFullWh > energyNowWh) {
    timeToFullMin = Math.round(((energyFullWh - energyNowWh) / powerW) * 60);
  }

  return {
    batteryName,
    timestamp,
    capacityPercent,
    capacityLevel,
    status,
    energyNowWh,
    energyFullWh,
    energyFullDesignWh,
    powerW,
    voltageV,
    cycleCount,
    sohPercent,
    timeToEmptyMin,
    timeToFullMin,
  };
}
