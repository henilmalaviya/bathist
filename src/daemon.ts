import { discoverBatteries, readBatterySnapshot, getBatteryStaticInfo } from "./sysfs.js";
import { BatteryDatabase } from "./db.js";
import type { BatteryReading, DaemonOptions } from "./types.js";

export async function runDaemon(options: DaemonOptions): Promise<void> {
  const intervalMs = options.intervalMs || 5000;
  const db = new BatteryDatabase(options.dbPath);

  const batteries = discoverBatteries();
  if (batteries.length === 0) {
    console.warn("[bathist] Warning: No batteries found in /sys/class/power_supply/");
  } else {
    console.log(`[bathist] Daemon starting... Found ${batteries.length} battery device(s): ${batteries.join(", ")}`);
    for (const b of batteries) {
      const info = getBatteryStaticInfo(b);
      console.log(
        `[bathist] [${b}] ${info.manufacturer} ${info.modelName} (Design: ${info.energyFullDesignWh} Wh)`
      );
    }
  }

  console.log(`[bathist] Logging battery state every ${intervalMs / 1000}s. Press Ctrl+C to exit.`);

  const previousReadings = new Map<string, BatteryReading>();

  const tick = () => {
    try {
      const currentBats = discoverBatteries();
      for (const batName of currentBats) {
        const prev = previousReadings.get(batName);
        const snapshot = readBatterySnapshot(batName, prev);
        db.insertReading(snapshot);
        previousReadings.set(batName, snapshot);

        if (options.verbose) {
          console.log(
            `[${new Date().toLocaleTimeString()}] [${batName}] ${snapshot.capacityPercent}% | ${snapshot.status} | ${snapshot.powerW}W | ${snapshot.voltageV}V | SoH: ${snapshot.sohPercent}%`
          );
        }
      }
    } catch (err) {
      console.error("[bathist] Error during battery collection tick:", err);
    }
  };

  // Run initial tick immediately
  tick();

  const timer = setInterval(tick, intervalMs);

  // Clean shutdown handlers
  const shutdown = () => {
    console.log("\n[bathist] Shutdown signal received. Stopping daemon...");
    clearInterval(timer);
    db.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
