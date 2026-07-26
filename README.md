# bathist ⚡

> Ultra-lightweight, high-resolution Linux battery monitoring daemon & interactive visual report generator built with **Bun** & **TypeScript** (Systemd & Hyprland ready).

`bathist` monitors battery state, health (SoH), charging/discharging power draw (Watts), voltage dynamics, and cycle counts on Linux machines with **near-zero CPU and memory usage (~15MB RAM)**. It stores logs locally in an optimized SQLite database using Bun's native `bun:sqlite` C bindings, and can generate standalone, interactive HTML analytics reports with interactive charts, time range filtering, CSV/JSON export, and multi-battery support.

---

## Features

- 🔋 **Multi-Battery Support**: Automatically discovers and tracks multiple laptop batteries (`BAT0`, `BAT1`, etc.).
- ⚡ **Accurate Real-Time Metrics**: Measures battery level (%), status, power draw (Watts), voltage (V), capacity (Wh), State of Health (SoH %), cycle counts, and remaining time.
- 🪶 **Ultra-Low Resource Impact**: Uses Linux sysfs (`/sys/class/power_supply`) fast single-pass uevent reading and SQLite WAL mode. Virtually 0% CPU consumption during continuous background polling.
- 📊 **Interactive HTML Reports**: Generates standalone, self-contained single-file HTML dashboards with Chart.js time series, time-range selectors (1h, 6h, 24h, 7d, 30d, All), metrics cards, recent log tables, and instant CSV/JSON data export.
- ⚙️ **Boot Integration**: Includes easy setup commands for **systemd** user services and **Hyprland** (`exec-once`).
- 📁 **SQLite Storage**: Efficient indexed storage using Bun's native SQLite engine (`~/.config/bathist/bathist.sqlite`).

---

## Quick Start

### 1. Requirements & Installation

Ensure [Bun](https://bun.sh) is installed on your Linux system.

```bash
# Clone repository
git clone https://github.com/neon/bathist.git
cd bathist

# Install dependencies
bun install
```

### 2. Check Battery Status in Terminal

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

## Running in Background

### Option A: Systemd User Service (Recommended for most Linux distros)

Install and enable the user service:

```bash
bun run src/cli.ts service install

# Enable and start at boot:
systemctl --user daemon-reload
systemctl --user enable --now bathist.service

# Check service status & logs:
systemctl --user status bathist.service
journalctl --user -u bathist.service -f
```

### Option B: Hyprland Autostart

Add the following line to your `~/.config/hypr/hyprland.conf`:

```ini
exec-once = /path/to/bathist/dist/bathist daemon
```
*(Or `exec-once = bun run /path/to/bathist/src/cli.ts daemon`)*

---

## Generating Interactive HTML Reports

Generate an interactive HTML report for any time period:

```bash
# Generate report for last 24 hours (default)
bun run src/cli.ts report --range 24h --output report.html

# Generate report for last 7 days
bun run src/cli.ts report --range 7d --output report_7d.html

# Generate all-time battery report
bun run src/cli.ts report --range all --output full_report.html
```

Open `report.html` in any browser to interact with charts, filter time ranges, and download raw data.

---

## CLI Reference

```
USAGE:
  bathist <command> [options]

COMMANDS:
  daemon               Run background battery monitoring daemon
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
```

---

## Building Standalone Binary

Compile `bathist` into a single self-contained binary executable:

```bash
bun run build
./dist/bathist status
```

---

## Testing

Run unit test suite:

```bash
bun test
```

---

## License

MIT License
