# bathist ⚡

> High-performance Linux battery monitor & Vercel-inspired visual telemetry generator built with **Bun**, **TypeScript**, and **Commander**.

`bathist` is an ultra-lightweight, high-resolution battery monitoring daemon and interactive visual analytics generator designed for Linux laptops (Systemd & Hyprland autostart compatible).

It captures battery level (%), charge/discharge rate (Watts), voltage, capacity (Wh), State of Health (SoH %), cycle counts, and remaining runtime with **near-zero CPU and memory usage (~15MB RAM)**. It stores logs in an optimized SQLite database (`bun:sqlite` with WAL mode) and exports standalone HTML reports designed according to **Vercel's UI design system**.

---

## Key Features

- 🔋 **Multi-Battery Telemetry**: Automatically discovers and monitors multiple laptop batteries (`BAT0`, `BAT1`, etc.).
- ⚡ **Real-Time Wattage & Health Tracking**: Captures instant power draw in Watts, voltage dynamics, cycle count, and State of Health (SoH %).
- 🎨 **Vercel UI Design System**: HTML dashboards crafted with Vercel's design language:
  - Deep dark background (`#000000`) & `#0a0a0a` surface cards with 1px borders (`#222222`).
  - Google Fonts (`Geist` / `Geist Mono`) typography.
  - Vercel tabbed layout: **Overview**, **Power & Voltage**, **Snapshot Logs**, and **Hardware Specs**.
  - Live status dot badges (discharging green, charging blue, full cyan).
  - Interactive Chart.js graphs with dark glass tooltips.
  - One-click **CSV** and **JSON** raw data export directly inside the report.
- 📦 **Single-Binary Release**: Compiles into a single zero-dependency executable (`dist/bathist`).
- 🛠️ **Commander CLI**: Industry-standard CLI argument parsing and auto-generated help.
- 🪶 **Ultra-Low Overhead**: Fast single-pass sysfs reader (`/sys/class/power_supply`) with ~0% CPU usage.

---

## Quick Start

### 1. Installation

```bash
# Clone repository
git clone git@github.com:henilmalaviya/bathist.git
cd bathist

# Install dependencies
bun install
```

### 2. Check Battery Status

```bash
bun run src/cli.ts status
```

Output:
```
⚡ ====================================================== ⚡
                BATHIST BATTERY MONITOR STATUS
⚡ ====================================================== ⚡

Device: BAT0 (HP Primary)
  State          : 🪫 Discharging (Normal)
  Capacity       : 81% (32.478 Wh / 40.205 Wh)
  Power Draw     : 16.56 W
  Voltage        : 11.942 V
  Health (SoH)   : 99.46% (Design: 40.425 Wh)
  Cycle Count    : 2
```

---

## Standalone Single-Binary Compilation

`bathist` can be bundled into a single standalone binary executable without sharing source files or requiring Bun/Node pre-installed:

```bash
bun run build

# Run the single binary executable anywhere:
./dist/bathist status
./dist/bathist report --range 24h --output vercel_report.html
```

---

## Background Autostart Setup

### Systemd User Service

Generate and install the user service:

```bash
bun run src/cli.ts service install

# Enable and start immediately:
systemctl --user daemon-reload
systemctl --user enable --now bathist.service
```

### Hyprland Integration

Add to your `~/.config/hypr/hyprland.conf`:

```ini
exec-once = /path/to/bathist/dist/bathist daemon
```

---

## Generating Vercel UI HTML Reports

```bash
# Generate report for last 24 hours
bathist report --range 24h --output report.html

# Generate report for last 7 days
bathist report --range 7d --output report_7d.html

# Generate all-time report
bathist report --range all --output report_all.html
```

---

## CLI Reference

```
Usage: bathist [options] [command]

High Performance Linux Battery Monitor & Visual Analytics Generator

Options:
  -V, --version     output the version number
  -h, --help        display help for command

Commands:
  daemon [options]  Run background battery monitoring daemon
  status [options]  Print current live battery status and health summary to CLI
  report [options]  Generate a standalone interactive Vercel UI HTML dashboard
  export [options]  Export raw recorded battery metrics to JSON or CSV
  service [action]  Install systemd user service or print Hyprland config snippet
  prune [options]   Prune database logs older than specified days
  help [command]    display help for command
```

---

## Testing

Run unit test suite:

```bash
bun test
```

---

## License

MIT
