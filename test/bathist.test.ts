import { describe, expect, test, afterAll } from "bun:test";
import { discoverBatteries, getBatteryStaticInfo, readBatterySnapshot } from "../src/sysfs.js";
import { BatteryDatabase } from "../src/db.js";
import { generateHtmlReport } from "../src/reporter.js";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";

const TEST_DB = join(process.cwd(), "test_battery.sqlite");
const TEST_REPORT = join(process.cwd(), "test_report.html");

describe("bathist sysfs reader", () => {
  test("discovers batteries or returns array", () => {
    const bats = discoverBatteries();
    expect(Array.isArray(bats)).toBe(true);
  });

  test("reads static info for discovered battery", () => {
    const bats = discoverBatteries();
    if (bats.length > 0) {
      const info = getBatteryStaticInfo(bats[0]);
      expect(info.name).toBe(bats[0]);
      expect(typeof info.energyFullDesignWh).toBe("number");
    }
  });

  test("reads battery snapshot without throwing", () => {
    const bats = discoverBatteries();
    if (bats.length > 0) {
      const snap = readBatterySnapshot(bats[0]);
      expect(snap.batteryName).toBe(bats[0]);
      expect(snap.capacityPercent).toBeGreaterThanOrEqual(0);
      expect(snap.capacityPercent).toBeLessThanOrEqual(100);
      expect(typeof snap.voltageV).toBe("number");
    }
  });
});

describe("bathist database", () => {
  afterAll(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  test("creates SQLite database and performs CRUD operations", () => {
    const db = new BatteryDatabase(TEST_DB);
    db.insertReading({
      batteryName: "BAT0",
      timestamp: Math.floor(Date.now() / 1000),
      capacityPercent: 85,
      capacityLevel: "Normal",
      status: "Discharging",
      energyNowWh: 34.0,
      energyFullWh: 40.0,
      energyFullDesignWh: 40.0,
      powerW: 12.5,
      voltageV: 11.8,
      cycleCount: 5,
      sohPercent: 100.0,
      timeToEmptyMin: 163,
      timeToFullMin: null,
    });

    const readings = db.getReadings("BAT0");
    expect(readings.length).toBeGreaterThan(0);
    expect(readings[0].capacityPercent).toBe(85);

    const summaries = db.getSummary("BAT0");
    expect(summaries.length).toBe(1);
    expect(summaries[0].batteryName).toBe("BAT0");

    db.close();
  });
});

describe("bathist HTML report generator", () => {
  afterAll(() => {
    if (existsSync(TEST_REPORT)) unlinkSync(TEST_REPORT);
  });

  test("generates valid standalone HTML report", () => {
    const outFile = generateHtmlReport({
      timeRange: "24h",
      outputPath: TEST_REPORT,
      dbPath: TEST_DB,
    });

    expect(existsSync(outFile)).toBe(true);
  });
});
