import { Command } from "commander";
import { discoverBatteries, readBatterySnapshot, getBatteryStaticInfo } from "./sysfs.js";
import { runDaemon } from "./daemon.js";
import { BatteryDatabase } from "./db.js";
import { generateHtmlReport } from "./reporter.js";
import { installSystemdService, printHyprlandInstruction, generateSystemdServiceContent } from "./service.js";
import { writeFileSync } from "fs";

const program = new Command();

program
  .name("bathist")
  .description("High Performance Linux Battery Monitor & Visual Analytics Generator")
  .version("1.0.0");

// Daemon Command
program
  .command("daemon")
  .description("Run background battery monitoring daemon")
  .option("-i, --interval <ms>", "Polling interval in milliseconds", "5000")
  .option("-d, --db <path>", "Custom SQLite database file path")
  .option("-v, --verbose", "Enable verbose console logging", false)
  .action(async (options) => {
    const intervalMs = parseInt(options.interval, 10);
    await runDaemon({
      intervalMs,
      dbPath: options.db,
      verbose: options.verbose,
    });
  });

// Status Command
program
  .command("status")
  .description("Print current live battery status and health summary to CLI")
  .option("-d, --db <path>", "Custom SQLite database file path")
  .action((options) => {
    const db = new BatteryDatabase(options.db);
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
  });

// Report Command
program
  .command("report")
  .description("Generate a standalone interactive HTML dashboard")
  .option("-r, --range <range>", "Time range: 1h, 6h, 24h, 7d, 30d, all", "24h")
  .option("-o, --output <path>", "Output HTML file path", "battery_report.html")
  .option("-d, --db <path>", "Custom SQLite database file path")
  .option("-b, --battery <name>", "Filter by battery name (e.g. BAT0)")
  .action((options) => {
    console.log(`[bathist] Generating interactive HTML battery report...`);
    const generatedFile = generateHtmlReport({
      timeRange: options.range,
      outputPath: options.output,
      dbPath: options.db,
      batteryName: options.battery,
    });
    console.log(`✅ Interactive HTML report generated successfully at: ${generatedFile}`);
  });

// Export Command
program
  .command("export")
  .description("Export raw recorded battery metrics to JSON or CSV")
  .option("-r, --range <range>", "Time range: 1h, 6h, 24h, 7d, 30d, all", "24h")
  .option("-f, --format <format>", "Export format: json or csv", "json")
  .option("-o, --output <path>", "Output file path (prints to stdout if omitted)")
  .option("-d, --db <path>", "Custom SQLite database file path")
  .option("-b, --battery <name>", "Filter by battery name")
  .action((options) => {
    const db = new BatteryDatabase(options.db);
    const now = Math.floor(Date.now() / 1000);
    let secondsAgo = 86400;
    const r = options.range.toLowerCase();
    if (r === "1h") secondsAgo = 3600;
    else if (r === "6h") secondsAgo = 21600;
    else if (r === "7d") secondsAgo = 7 * 86400;
    else if (r === "30d") secondsAgo = 30 * 86400;

    const since = r === "all" ? undefined : now - secondsAgo;
    const readings = db.getReadings(options.battery, since);
    db.close();

    let content = "";
    if (options.format.toLowerCase() === "csv") {
      if (readings.length > 0) {
        const keys = Object.keys(readings[0]);
        const csvRows = [keys.join(",")];
        readings.forEach((row: any) => {
          csvRows.push(keys.map((k) => JSON.stringify(row[k] ?? "")).join(","));
        });
        content = csvRows.join("\n");
      }
    } else {
      content = JSON.stringify(readings, null, 2);
    }

    if (options.output) {
      writeFileSync(options.output, content, "utf-8");
      console.log(`✅ Exported ${readings.length} records to ${options.output}`);
    } else {
      console.log(content);
    }
  });

// Service Command
program
  .command("service [action]")
  .description("Install systemd user service or print Hyprland config snippet (actions: install, systemd, hyprland)")
  .action((action = "install") => {
    const execPath = process.argv[1]?.endsWith(".ts")
      ? `bun run ${process.argv[1]}`
      : process.argv[1] || "bathist";

    if (action === "install") {
      installSystemdService(execPath);
      printHyprlandInstruction(execPath);
    } else if (action === "systemd") {
      console.log(generateSystemdServiceContent(execPath));
    } else if (action === "hyprland") {
      printHyprlandInstruction(execPath);
    }
  });

// Prune Command
program
  .command("prune")
  .description("Prune database logs older than specified days")
  .option("-n, --days <number>", "Days of logs to keep", "90")
  .option("-d, --db <path>", "Custom SQLite database file path")
  .action((options) => {
    const days = parseInt(options.days, 10);
    const db = new BatteryDatabase(options.db);
    const deleted = db.pruneOldReadings(days);
    db.close();
    console.log(`✅ Pruned ${deleted} records older than ${days} days.`);
  });

program.parse(process.argv);
