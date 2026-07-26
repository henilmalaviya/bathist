#!/usr/bin/env bun
import { discoverBatteries, readBatterySnapshot, getBatteryStaticInfo } from "./sysfs.js";
import { runDaemon } from "./daemon.js";
import { BatteryDatabase } from "./db.js";
import { generateHtmlReport } from "./reporter.ts";
import { installSystemdService, printHyprlandInstruction, generateSystemdServiceContent } from "./service.js";
import { writeFileSync } from "fs";
import type { BatteryReading } from "./types.js";

const args = process.argv.slice(2);
const command = args[0] || "status";

function parseFlag(flagName: string, defaultValue?: string): string | undefined {
  const idx = args.indexOf(flagName);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return defaultValue;
}

function hasFlag(flagName: string): boolean {
  return args.includes(flagName);
}

function getExecutablePath(): string {
  if (process.argv[1]?.endsWith(".ts")) {
    return `bun run ${process.argv[1]}`;
  }
  return process.argv[1] || "bathist";
}

async function main() {
  switch (command.toLowerCase()) {
    case "daemon":
    case "start": {
      const intervalMs = parseInt(parseFlag("--interval", "5000")!, 10);
      const dbPath = parseFlag("--db");
      const verbose = hasFlag("--verbose");

      await runDaemon({ intervalMs, dbPath, verbose });
      break;
    }

    case "status": {
      const dbPath = parseFlag("--db");
      const db = new BatteryDatabase(dbPath);
      const batteries = discoverBatteries();

      console.log("\n⚡ ====================================================== ⚡");
      console.log("                BATHIST BATTERY MONITOR STATUS");
      console.log("⚡ ====================================================== ⚡\n");

      if (batteries.length === 0) {
        console.log("❌ No active battery devices detected in /sys/class/power_supply/");
      } else {
        for (const b of batteries) {
          const info = getBatteryStaticInfo(b);
          const snap = readBatterySnapshot(b);
          const dbLatest = db.getLatestReading(b);

          let statusIcon = "🔋";
          if (snap.status.toLowerCase() === "charging") statusIcon = "⚡";
          else if (snap.status.toLowerCase() === "full") statusIcon = "🟢";
          else if (snap.status.toLowerCase() === "discharging") statusIcon = "🪫";

          console.log(`Device: ${b} (${info.manufacturer} ${info.modelName})`);
          console.log(`  State          : ${statusIcon} ${snap.status} (${snap.capacityLevel})`);
          console.log(`  Capacity       : ${snap.capacityPercent}% (${snap.energyNowWh} Wh / ${snap.energyFullWh} Wh)`);
          console.log(`  Power Draw     : ${snap.powerW} W`);
          console.log(`  Voltage        : ${snap.voltageV} V`);
          console.log(`  Health (SoH)   : ${snap.sohPercent}% (Design: ${info.energyFullDesignWh} Wh)`);
          console.log(`  Cycle Count    : ${snap.cycleCount}`);

          if (snap.status.toLowerCase() === "discharging" && snap.timeToEmptyMin) {
            const h = Math.floor(snap.timeToEmptyMin / 60);
            const m = snap.timeToEmptyMin % 60;
            console.log(`  Time Remaining : ~${h > 0 ? `${h}h ` : ""}${m}m to empty`);
          } else if (snap.status.toLowerCase() === "charging" && snap.timeToFullMin) {
            const h = Math.floor(snap.timeToFullMin / 60);
            const m = snap.timeToFullMin % 60;
            console.log(`  Time Remaining : ~${h > 0 ? `${h}h ` : ""}${m}m to full charge`);
          }

          if (dbLatest) {
            console.log(`  DB Log Status  : Last recorded ${new Date(dbLatest.timestamp * 1000).toLocaleTimeString()}`);
          }
          console.log("----------------------------------------------------------");
        }
      }
      db.close();
      console.log();
      break;
    }

    case "report":
    case "html": {
      const timeRange = parseFlag("--range", "24h")!;
      const outputPath = parseFlag("--output", "battery_report.html")!;
      const dbPath = parseFlag("--db");
      const batteryName = parseFlag("--battery");

      console.log(`[bathist] Generating interactive HTML battery report...`);
      const generatedFile = generateHtmlReport({
        timeRange,
        outputPath,
        dbPath,
        batteryName,
      });
      console.log(`✅ Interactive HTML report generated successfully at: ${generatedFile}`);
      console.log(`👉 Open it in your web browser: file://${process.cwd()}/${generatedFile}`);
      break;
    }

    case "export": {
      const timeRange = parseFlag("--range", "24h")!;
      const format = (parseFlag("--format", "json")!).toLowerCase();
      const outputPath = parseFlag("--output");
      const dbPath = parseFlag("--db");
      const batteryName = parseFlag("--battery");

      const db = new BatteryDatabase(dbPath);
      const now = Math.floor(Date.now() / 1000);
      let secondsAgo = 86400;
      if (timeRange === "1h") secondsAgo = 3600;
      else if (timeRange === "6h") secondsAgo = 21600;
      else if (timeRange === "7d") secondsAgo = 7 * 86400;
      else if (timeRange === "30d") secondsAgo = 30 * 86400;

      const since = timeRange === "all" ? undefined : now - secondsAgo;
      const readings = db.getReadings(batteryName, since);
      db.close();

      let content = "";
      if (format === "csv") {
        if (readings.length > 0) {
          const keys = Object.keys(readings[0]);
          const csvRows = [keys.join(",")];
          readings.forEach((r: any) => {
            csvRows.push(keys.map((k) => JSON.stringify(r[k] ?? "")).join(","));
          });
          content = csvRows.join("\n");
        }
      } else {
        content = JSON.stringify(readings, null, 2);
      }

      if (outputPath) {
        writeFileSync(outputPath, content, "utf-8");
        console.log(`✅ Exported ${readings.length} records to ${outputPath}`);
      } else {
        console.log(content);
      }
      break;
    }

    case "service": {
      const sub = args[1] || "install";
      const execPath = getExecutablePath();

      if (sub === "install") {
        installSystemdService(execPath);
        printHyprlandInstruction(execPath);
      } else if (sub === "systemd") {
        console.log(generateSystemdServiceContent(execPath));
      } else if (sub === "hyprland") {
        printHyprlandInstruction(execPath);
      }
      break;
    }

    case "prune": {
      const days = parseInt(parseFlag("--days", "90")!, 10);
      const dbPath = parseFlag("--db");
      const db = new BatteryDatabase(dbPath);
      const deleted = db.pruneOldReadings(days);
      db.close();
      console.log(`✅ Pruned ${deleted} records older than ${days} days.`);
      break;
    }

    case "help":
    case "-h":
    case "--help":
    default: {
      console.log(`
bathist - High Performance Linux Battery Monitor & Interactive Reporter

USAGE:
  bathist <command> [options]

COMMANDS:
  daemon               Run background battery monitoring daemon (systemd/hyprland friendly)
  status               Print current live battery status and health summary to CLI
  report               Generate a standalone interactive HTML dashboard
  export               Export raw recorded battery metrics to JSON or CSV
  service              Install systemd user service & print Hyprland autostart snippet
  prune                Prune database logs older than specified days (default 90)

OPTIONS:
  --interval <ms>      Daemon polling interval in ms (default: 5000)
  --range <range>      Report/Export time range: 1h, 6h, 24h, 7d, 30d, all (default: 24h)
  --output <path>      Output file path for report/export (default: battery_report.html)
  --format <json|csv>  Export format (default: json)
  --db <path>          Custom SQLite database file path
  --verbose            Enable verbose logging in daemon mode
`);
      break;
    }
  }
}

main().catch((err) => {
  console.error("[bathist] Fatal error:", err);
  process.exit(1);
});
