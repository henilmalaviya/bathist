import { BatteryDatabase } from "../src/db.js";
import type { BatteryReading } from "../src/types.js";
import { join } from "path";

const DEMO_DB = join(process.cwd(), "demo_battery.sqlite");
const db = new BatteryDatabase(DEMO_DB);

console.log("[Seeder] Generating realistic 7-day battery telemetry data...");

const now = Math.floor(Date.now() / 1000);
const SEVEN_DAYS_SEC = 7 * 86400;
const startTimestamp = now - SEVEN_DAYS_SEC;
const sampleIntervalSec = 30; // 30s interval = 20,160 data points

const energyFullDesignWh = 52.0;
let energyFullWh = 50.0; // Current max capacity
let energyNowWh = 45.0; // Start at 90%
let cycleCount = 42;
let status = "Discharging";
let phaseTimer = 0; // seconds spent in current phase
let phaseDuration = 14400; // 4 hours discharging phase

const readings: BatteryReading[] = [];

for (let t = startTimestamp; t <= now; t += sampleIntervalSec) {
  phaseTimer += sampleIntervalSec;

  let powerW = 0;
  let voltageV = 12.0;

  if (status === "Discharging") {
    // Fluctuating power draw between 9W and 26W
    const basePower = 14 + Math.sin(t / 1800) * 6;
    const jitter = (Math.random() - 0.5) * 4;
    powerW = Math.max(8, Math.min(32, basePower + jitter));

    // Energy drained in Wh = (powerW * sampleIntervalSec) / 3600
    const energyDrained = (powerW * sampleIntervalSec) / 3600;
    energyNowWh = Math.max(5.0, energyNowWh - energyDrained);

    // Voltage drops from ~12.5V down to ~11.1V
    const ratio = energyNowWh / energyFullWh;
    voltageV = 11.1 + ratio * 1.4 + (Math.random() - 0.5) * 0.05;

    // Transition to charging when low (~12% or after phase duration)
    if (energyNowWh <= 6.0 || phaseTimer >= phaseDuration) {
      status = "Charging";
      phaseTimer = 0;
      phaseDuration = 5400; // 1.5 hours charge phase
    }
  } else if (status === "Charging") {
    // Fast charging between 30W and 45W
    const ratio = energyNowWh / energyFullWh;
    if (ratio < 0.8) {
      powerW = 35 + (Math.random() - 0.5) * 6;
    } else {
      // Taper off power near full charge
      powerW = Math.max(5, 35 * (1 - ratio) * 4);
    }

    const energyAdded = (powerW * sampleIntervalSec) / 3600;
    energyNowWh = Math.min(energyFullWh, energyNowWh + energyAdded);

    // Voltage rises from ~11.4V to ~12.6V
    voltageV = 11.4 + ratio * 1.2 + (Math.random() - 0.5) * 0.04;

    if (energyNowWh >= energyFullWh * 0.99) {
      status = "Full";
      phaseTimer = 0;
      phaseDuration = 7200; // 2 hours full phase
      cycleCount += 1;
      // Slight battery degradation over time
      energyFullWh = Math.max(45.0, energyFullWh - 0.01);
    }
  } else if (status === "Full") {
    powerW = 0.5 + Math.random() * 0.5; // Idle maintenance power
    energyNowWh = energyFullWh;
    voltageV = 12.55 + (Math.random() - 0.5) * 0.02;

    if (phaseTimer >= phaseDuration) {
      status = "Discharging";
      phaseTimer = 0;
      // Randomize discharge duration between 3.5h and 5h
      phaseDuration = Math.floor(12600 + Math.random() * 5400);
    }
  }

  const capacityPercent = Math.min(100, Math.max(0, Math.round((energyNowWh / energyFullWh) * 100)));
  const sohPercent = Math.min(100, Math.round((energyFullWh / energyFullDesignWh) * 10000) / 100);

  let capacityLevel = "Normal";
  if (capacityPercent < 15) capacityLevel = "Low";
  else if (capacityPercent > 95) capacityLevel = "Full";

  let timeToEmptyMin: number | null = null;
  let timeToFullMin: number | null = null;

  if (status === "Discharging" && powerW > 0.1) {
    timeToEmptyMin = Math.round((energyNowWh / powerW) * 60);
  } else if (status === "Charging" && powerW > 0.1) {
    timeToFullMin = Math.round(((energyFullWh - energyNowWh) / powerW) * 60);
  }

  readings.push({
    batteryName: "BAT0",
    timestamp: t,
    capacityPercent,
    capacityLevel,
    status,
    energyNowWh: Math.round(energyNowWh * 1000) / 1000,
    energyFullWh: Math.round(energyFullWh * 1000) / 1000,
    energyFullDesignWh,
    powerW: Math.round(powerW * 100) / 100,
    voltageV: Math.round(voltageV * 1000) / 1000,
    cycleCount,
    sohPercent,
    timeToEmptyMin,
    timeToFullMin,
  });
}

console.log(`[Seeder] Inserting ${readings.length} realistic readings into ${DEMO_DB}...`);

// Insert in transaction batches for speed
for (const r of readings) {
  db.insertReading(r);
}

db.close();
console.log(`✅ Database successfully populated with 7 days of realistic telemetry data!`);
