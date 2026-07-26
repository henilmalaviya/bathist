import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import type { BatteryReading, BatterySummary } from "./types.js";

const DEFAULT_DB_DIR = join(homedir(), ".config", "bathist");
const DEFAULT_DB_PATH = join(DEFAULT_DB_DIR, "bathist.sqlite");

export function getResolvedDbPath(customPath?: string): string {
  if (customPath) return customPath;
  if (process.env.BATHIST_DB_PATH) return process.env.BATHIST_DB_PATH;
  return DEFAULT_DB_PATH;
}

export class BatteryDatabase {
  private db: Database;

  constructor(dbPath?: string) {
    const resolvedPath = getResolvedDbPath(dbPath);
    const dir = dirname(resolvedPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(resolvedPath);
    this.init();
  }

  private init() {
    // Enable Write-Ahead Logging for high efficiency & concurrency
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = NORMAL;");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS battery_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        battery_name TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        capacity_percent INTEGER NOT NULL,
        capacity_level TEXT NOT NULL,
        status TEXT NOT NULL,
        energy_now_wh REAL NOT NULL,
        energy_full_wh REAL NOT NULL,
        energy_full_design_wh REAL NOT NULL,
        power_w REAL NOT NULL,
        voltage_v REAL NOT NULL,
        cycle_count INTEGER NOT NULL,
        soh_percent REAL NOT NULL,
        time_to_empty_min INTEGER,
        time_to_full_min INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_battery_timestamp 
      ON battery_readings(battery_name, timestamp);

      CREATE INDEX IF NOT EXISTS idx_timestamp 
      ON battery_readings(timestamp);
    `);
  }

  public insertReading(r: BatteryReading): void {
    const stmt = this.db.prepare(`
      INSERT INTO battery_readings (
        battery_name, timestamp, capacity_percent, capacity_level, status,
        energy_now_wh, energy_full_wh, energy_full_design_wh, power_w,
        voltage_v, cycle_count, soh_percent, time_to_empty_min, time_to_full_min
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      r.batteryName,
      r.timestamp,
      r.capacityPercent,
      r.capacityLevel,
      r.status,
      r.energyNowWh,
      r.energyFullWh,
      r.energyFullDesignWh,
      r.powerW,
      r.voltageV,
      r.cycleCount,
      r.sohPercent,
      r.timeToEmptyMin,
      r.timeToFullMin
    );
  }

  public getLatestReading(batteryName: string): BatteryReading | null {
    const query = this.db.prepare(`
      SELECT * FROM battery_readings 
      WHERE battery_name = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
    const row = query.get(batteryName) as any;
    if (!row) return null;
    return this.rowToReading(row);
  }

  public getDistinctBatteries(): string[] {
    const query = this.db.prepare(`SELECT DISTINCT battery_name FROM battery_readings`);
    const rows = query.all() as { battery_name: string }[];
    return rows.map((r) => r.battery_name);
  }

  public getReadings(
    batteryName?: string,
    sinceTimestamp?: number,
    untilTimestamp?: number,
    maxPoints = 5000
  ): BatteryReading[] {
    let sql = `SELECT * FROM battery_readings WHERE 1=1`;
    const params: any[] = [];

    if (batteryName) {
      sql += ` AND battery_name = ?`;
      params.push(batteryName);
    }
    if (sinceTimestamp !== undefined) {
      sql += ` AND timestamp >= ?`;
      params.push(sinceTimestamp);
    }
    if (untilTimestamp !== undefined) {
      sql += ` AND timestamp <= ?`;
      params.push(untilTimestamp);
    }

    sql += ` ORDER BY timestamp ASC`;

    const query = this.db.prepare(sql);
    const rows = query.all(...params) as any[];

    if (rows.length <= maxPoints) {
      return rows.map((r) => this.rowToReading(r));
    }

    // Downsample intelligently if number of points is very large
    const step = Math.ceil(rows.length / maxPoints);
    const downsampled: BatteryReading[] = [];
    for (let i = 0; i < rows.length; i += step) {
      downsampled.push(this.rowToReading(rows[i]));
    }
    // Always include the absolute last point
    if (rows.length > 0 && downsampled[downsampled.length - 1].id !== rows[rows.length - 1].id) {
      downsampled.push(this.rowToReading(rows[rows.length - 1]));
    }

    return downsampled;
  }

  public getSummary(batteryName?: string, sinceTimestamp?: number): BatterySummary[] {
    const batteries = batteryName ? [batteryName] : this.getDistinctBatteries();
    const summaries: BatterySummary[] = [];

    for (const bat of batteries) {
      let sql = `
        SELECT 
          COUNT(*) as recordCount,
          MIN(timestamp) as firstTimestamp,
          MAX(timestamp) as lastTimestamp,
          MIN(capacity_percent) as minCapacityPercent,
          MAX(capacity_percent) as maxCapacityPercent,
          AVG(power_w) as avgPowerW,
          MAX(power_w) as maxPowerW
        FROM battery_readings
        WHERE battery_name = ?
      `;
      const params: any[] = [bat];
      if (sinceTimestamp !== undefined) {
        sql += ` AND timestamp >= ?`;
        params.push(sinceTimestamp);
      }

      const aggStmt = this.db.prepare(sql);
      const agg = aggStmt.get(...params) as any;

      if (!agg || agg.recordCount === 0) continue;

      const latest = this.getLatestReading(bat);
      if (!latest) continue;

      summaries.push({
        batteryName: bat,
        recordCount: agg.recordCount,
        firstTimestamp: agg.firstTimestamp,
        lastTimestamp: agg.lastTimestamp,
        minCapacityPercent: agg.minCapacityPercent,
        maxCapacityPercent: agg.maxCapacityPercent,
        avgPowerW: Math.round((agg.avgPowerW || 0) * 100) / 100,
        maxPowerW: Math.round((agg.maxPowerW || 0) * 100) / 100,
        currentSohPercent: latest.sohPercent,
        latestStatus: latest.status,
        latestCapacityPercent: latest.capacityPercent,
        latestPowerW: latest.powerW,
        latestVoltageV: latest.voltageV,
        latestEnergyNowWh: latest.energyNowWh,
        latestEnergyFullWh: latest.energyFullWh,
        latestEnergyFullDesignWh: latest.energyFullDesignWh,
        cycleCount: latest.cycleCount,
      });
    }

    return summaries;
  }

  public pruneOldReadings(daysToKeep: number): number {
    const cutoff = Math.floor(Date.now() / 1000) - daysToKeep * 86400;
    const stmt = this.db.prepare(`DELETE FROM battery_readings WHERE timestamp < ?`);
    const res = stmt.run(cutoff);
    return res.changes;
  }

  private rowToReading(row: any): BatteryReading {
    return {
      id: row.id,
      batteryName: row.battery_name,
      timestamp: row.timestamp,
      capacityPercent: row.capacity_percent,
      capacityLevel: row.capacity_level,
      status: row.status,
      energyNowWh: row.energy_now_wh,
      energyFullWh: row.energy_full_wh,
      energyFullDesignWh: row.energy_full_design_wh,
      powerW: row.power_w,
      voltageV: row.voltage_v,
      cycleCount: row.cycle_count,
      sohPercent: row.soh_percent,
      timeToEmptyMin: row.time_to_empty_min,
      timeToFullMin: row.time_to_full_min,
    };
  }

  public close(): void {
    this.db.close();
  }
}
