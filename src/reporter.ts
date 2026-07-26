import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import Handlebars from "handlebars";
import rawTemplate from "./templates/report.hbs" with { type: "text" };
import { BatteryDatabase } from "./db.js";
import { discoverBatteries, getBatteryStaticInfo } from "./sysfs.js";
import type { ReportOptions, BatteryReading, BatterySummary } from "./types.js";

const template = Handlebars.compile(rawTemplate);

function parseTimeRangeToSeconds(range: string): number | null {
  const r = range.toLowerCase();
  if (r === "all") return null;
  if (r.endsWith("h")) {
    const hours = parseFloat(r.slice(0, -1));
    return hours * 3600;
  }
  if (r.endsWith("d")) {
    const days = parseFloat(r.slice(0, -1));
    return days * 86400;
  }
  if (r.endsWith("m")) {
    const mins = parseFloat(r.slice(0, -1));
    return mins * 60;
  }
  return 86400;
}

export function generateHtmlReport(options: ReportOptions): string {
  const db = new BatteryDatabase(options.dbPath);
  const now = Math.floor(Date.now() / 1000);
  const secondsAgo = parseTimeRangeToSeconds(options.timeRange);
  const sinceTimestamp = secondsAgo ? now - secondsAgo : undefined;

  const rawBatteries = db.getDistinctBatteries();
  const sysfsBatteries = discoverBatteries();
  const allBatNames = Array.from(new Set([...rawBatteries, ...sysfsBatteries]));

  const readingsMap: Record<string, BatteryReading[]> = {};
  for (const bat of allBatNames) {
    readingsMap[bat] = db.getReadings(bat, sinceTimestamp);
  }

  const summaries = db.getSummary(options.batteryName, sinceTimestamp);
  const staticInfoMap: Record<string, any> = {};
  for (const bat of allBatNames) {
    staticInfoMap[bat] = getBatteryStaticInfo(bat);
  }

  db.close();

  const payload = {
    allBatNames,
    readingsMap,
    summaries,
    staticInfoMap,
    timeRange: options.timeRange,
    generatedAt: new Date().toISOString(),
  };

  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadJson, "utf-8").toString("base64");

  const htmlContent = template({ payloadBase64 });

  const outPath = options.outputPath || "battery_report.html";
  const dir = dirname(outPath);
  if (dir && dir !== "." && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outPath, htmlContent, "utf-8");
  return outPath;
}
