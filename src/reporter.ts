import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import { BatteryDatabase } from "./db.js";
import { discoverBatteries, getBatteryStaticInfo } from "./sysfs.js";
import type { ReportOptions, BatteryReading, BatterySummary } from "./types.js";

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
  return 86400; // default 24h
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

  const htmlContent = buildHtmlDocument({
    allBatNames,
    readingsMap,
    summaries,
    staticInfoMap,
    timeRange: options.timeRange,
    generatedAt: new Date().toISOString(),
  });

  const outPath = options.outputPath || "battery_report.html";
  const dir = dirname(outPath);
  if (dir && dir !== "." && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(outPath, htmlContent, "utf-8");
  return outPath;
}

interface HtmlPayload {
  allBatNames: string[];
  readingsMap: Record<string, BatteryReading[]>;
  summaries: BatterySummary[];
  staticInfoMap: Record<string, any>;
  timeRange: string;
  generatedAt: string;
}

function buildHtmlDocument(payload: HtmlPayload): string {
  const jsonPayload = JSON.stringify(payload);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>bathist - Battery Analytics Report</title>
  <!-- Modern Font & Chart.js -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg-dark: #090d16;
      --bg-card: #111827;
      --bg-card-hover: #1f2937;
      --border-color: #1f2937;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --accent-green: #10b981;
      --accent-cyan: #06b6d4;
      --accent-amber: #f59e0b;
      --accent-purple: #8b5cf6;
      --accent-rose: #f43f5e;
      --font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: var(--font-family);
      line-height: 1.5;
      padding: 24px;
      min-height: 100vh;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Header */
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
      gap: 16px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, var(--accent-green), var(--accent-cyan));
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
    }

    .brand-title h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      background: linear-gradient(90deg, #ffffff, #9ca3af);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .brand-title p {
      font-size: 13px;
      color: var(--text-muted);
    }

    /* Controls Bar */
    .controls-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .btn, select {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn:hover, select:hover {
      background: var(--bg-card-hover);
      border-color: #374151;
      transform: translateY(-1px);
    }

    .btn-active {
      background: linear-gradient(135deg, #059669, #0891b2) !important;
      border-color: transparent !important;
      color: #ffffff !important;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }

    /* Metric Cards Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 20px;
      transition: transform 0.2s ease, border-color 0.2s ease;
      position: relative;
      overflow: hidden;
    }

    .card:hover {
      border-color: #374151;
      transform: translateY(-2px);
    }

    .card-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .card-value {
      font-size: 28px;
      font-weight: 800;
      line-height: 1.2;
    }

    .card-subtext {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 6px;
    }

    /* Charts Section */
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }

    @media (max-width: 768px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
    }

    .chart-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 20px;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .chart-title {
      font-size: 16px;
      font-weight: 700;
    }

    .chart-container {
      position: relative;
      height: 320px;
      width: 100%;
    }

    /* Table Section */
    .table-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
      overflow: hidden;
    }

    .table-wrapper {
      overflow-x: auto;
      max-height: 400px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }

    th {
      background: #1f2937;
      color: var(--text-muted);
      font-weight: 600;
      padding: 12px 16px;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .badge-charging { background: rgba(16, 185, 129, 0.15); color: var(--accent-green); }
    .badge-discharging { background: rgba(244, 63, 94, 0.15); color: var(--accent-rose); }
    .badge-full { background: rgba(6, 182, 212, 0.15); color: var(--accent-cyan); }
    .badge-unknown { background: rgba(156, 163, 175, 0.15); color: var(--text-muted); }

    footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="brand-icon">⚡</div>
        <div class="brand-title">
          <h1>bathist Analytics</h1>
          <p>Battery Health & System Power Monitor</p>
        </div>
      </div>

      <div class="controls-bar">
        <!-- Battery Selector -->
        <select id="batterySelect" onchange="updateDashboard()">
        </select>

        <!-- Time Range Selector Buttons -->
        <div id="rangeGroup">
          <button class="btn" onclick="setTimeRange('1h')">1h</button>
          <button class="btn" onclick="setTimeRange('6h')">6h</button>
          <button class="btn" onclick="setTimeRange('24h')">24h</button>
          <button class="btn" onclick="setTimeRange('7d')">7d</button>
          <button class="btn" onclick="setTimeRange('30d')">30d</button>
          <button class="btn" onclick="setTimeRange('all')">All</button>
        </div>

        <!-- Export Buttons -->
        <button class="btn" onclick="exportData('json')">📥 JSON</button>
        <button class="btn" onclick="exportData('csv')">📊 CSV</button>
      </div>
    </header>

    <!-- Key Metrics Grid -->
    <div class="metrics-grid">
      <div class="card">
        <div class="card-label">Current Battery <span>🔋</span></div>
        <div class="card-value" id="valCapacity">--%</div>
        <div class="card-subtext" id="valStatus">--</div>
      </div>

      <div class="card">
        <div class="card-label">State of Health (SoH) <span>🩺</span></div>
        <div class="card-value" id="valSoh">--%</div>
        <div class="card-subtext" id="valHealthDegradation">Design vs Full Capacity</div>
      </div>

      <div class="card">
        <div class="card-label">Power Draw <span>⚡</span></div>
        <div class="card-value" id="valPower">-- W</div>
        <div class="card-subtext" id="valPowerStats">Avg: -- W | Peak: -- W</div>
      </div>

      <div class="card">
        <div class="card-label">Voltage & Energy <span>⚡</span></div>
        <div class="card-value" id="valVoltage">-- V</div>
        <div class="card-subtext" id="valEnergyNow">-- Wh / -- Wh</div>
      </div>

      <div class="card">
        <div class="card-label">Est. Time Remaining <span>⏳</span></div>
        <div class="card-value" id="valTimeRemaining">--</div>
        <div class="card-subtext" id="valCycleCount">Cycles: --</div>
      </div>
    </div>

    <!-- Charts Grid -->
    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title">Battery Level (%) & Status Timeline</div>
        </div>
        <div class="chart-container">
          <canvas id="chartCapacity"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title">Power Consumption (Watts) & Voltage (V)</div>
        </div>
        <div class="chart-container">
          <canvas id="chartPower"></canvas>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="table-card">
      <div class="chart-header">
        <div class="chart-title">Recent Battery Snapshot Log</div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Battery</th>
              <th>Capacity</th>
              <th>Status</th>
              <th>Power (W)</th>
              <th>Voltage (V)</th>
              <th>Energy (Wh)</th>
              <th>SoH %</th>
            </tr>
          </thead>
          <tbody id="tableBody">
          </tbody>
        </table>
      </div>
    </div>

    <footer>
      Report generated by <strong>bathist</strong> on <span id="genDate"></span> • High Performance Linux Battery Monitor
    </footer>
  </div>

  <script>
    const DATA = ${jsonPayload};
    let currentBattery = DATA.allBatNames[0] || "BAT0";
    let currentTimeRange = DATA.timeRange || "24h";

    let chartCapInstance = null;
    let chartPowerInstance = null;

    document.getElementById("genDate").textContent = new Date(DATA.generatedAt).toLocaleString();

    // Populate battery select dropdown
    const batSelect = document.getElementById("batterySelect");
    batSelect.innerHTML = DATA.allBatNames.map(b => \`<option value="\${b}">Battery \${b}</option>\`).join("");
    if (DATA.allBatNames.length > 1) {
      batSelect.innerHTML += \`<option value="ALL">All Batteries</option>\`;
    }

    function setTimeRange(range) {
      currentTimeRange = range;
      updateRangeButtons();
      updateDashboard();
    }

    function updateRangeButtons() {
      const btns = document.querySelectorAll("#rangeGroup .btn");
      btns.forEach(btn => {
        if (btn.textContent.toLowerCase() === currentTimeRange.toLowerCase()) {
          btn.classList.add("btn-active");
        } else {
          btn.classList.remove("btn-active");
        }
      });
    }

    function filterReadings() {
      let readings = [];
      if (currentBattery === "ALL") {
        Object.values(DATA.readingsMap).forEach(arr => readings.push(...arr));
        readings.sort((a, b) => a.timestamp - b.timestamp);
      } else {
        readings = DATA.readingsMap[currentBattery] || [];
      }

      if (currentTimeRange === "all") return readings;

      const nowSec = Math.floor(Date.now() / 1000);
      let secondsAgo = 86400;
      if (currentTimeRange === "1h") secondsAgo = 3600;
      else if (currentTimeRange === "6h") secondsAgo = 21600;
      else if (currentTimeRange === "24h") secondsAgo = 86400;
      else if (currentTimeRange === "7d") secondsAgo = 7 * 86400;
      else if (currentTimeRange === "30d") secondsAgo = 30 * 86400;

      const cutoff = nowSec - secondsAgo;
      return readings.filter(r => r.timestamp >= cutoff);
    }

    function updateDashboard() {
      currentBattery = batSelect.value;
      const readings = filterReadings();

      updateKPIs(readings);
      renderCharts(readings);
      renderTable(readings);
    }

    function updateKPIs(readings) {
      if (!readings || readings.length === 0) {
        document.getElementById("valCapacity").textContent = "--%";
        document.getElementById("valStatus").textContent = "No data in range";
        return;
      }

      const latest = readings[readings.length - 1];
      document.getElementById("valCapacity").textContent = latest.capacityPercent + "%";
      document.getElementById("valStatus").textContent = latest.status + " (" + latest.capacityLevel + ")";

      document.getElementById("valSoh").textContent = latest.sohPercent.toFixed(1) + "%";
      document.getElementById("valHealthDegradation").textContent = 
        latest.energyFullWh + " Wh / " + latest.energyFullDesignWh + " Wh design";

      document.getElementById("valPower").textContent = latest.powerW.toFixed(2) + " W";

      const powers = readings.map(r => r.powerW);
      const avgP = (powers.reduce((a, b) => a + b, 0) / powers.length).toFixed(2);
      const maxP = Math.max(...powers).toFixed(2);
      document.getElementById("valPowerStats").textContent = "Avg: " + avgP + " W | Peak: " + maxP + " W";

      document.getElementById("valVoltage").textContent = latest.voltageV.toFixed(2) + " V";
      document.getElementById("valEnergyNow").textContent = latest.energyNowWh + " Wh / " + latest.energyFullWh + " Wh";

      if (latest.status.toLowerCase() === "discharging" && latest.timeToEmptyMin) {
        const h = Math.floor(latest.timeToEmptyMin / 60);
        const m = latest.timeToEmptyMin % 60;
        document.getElementById("valTimeRemaining").textContent = h > 0 ? h + "h " + m + "m" : m + " mins";
      } else if (latest.status.toLowerCase() === "charging" && latest.timeToFullMin) {
        const h = Math.floor(latest.timeToFullMin / 60);
        const m = latest.timeToFullMin % 60;
        document.getElementById("valTimeRemaining").textContent = h > 0 ? h + "h " + m + "m" : m + " mins";
      } else {
        document.getElementById("valTimeRemaining").textContent = latest.status === "Full" ? "Full Battery" : "--";
      }

      document.getElementById("valCycleCount").textContent = "Cycles: " + (latest.cycleCount || 0);
    }

    function renderCharts(readings) {
      const labels = readings.map(r => new Date(r.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const caps = readings.map(r => r.capacityPercent);
      const powers = readings.map(r => r.powerW);
      const voltages = readings.map(r => r.voltageV);

      // Capacity Chart
      if (chartCapInstance) chartCapInstance.destroy();
      const ctxCap = document.getElementById("chartCapacity").getContext("2d");
      chartCapInstance = new Chart(ctxCap, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Capacity (%)',
            data: caps,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: readings.length > 100 ? 0 : 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', maxTicksLimit: 10 } },
            y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
          }
        }
      });

      // Power & Voltage Chart
      if (chartPowerInstance) chartPowerInstance.destroy();
      const ctxPower = document.getElementById("chartPower").getContext("2d");
      chartPowerInstance = new Chart(ctxPower, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Power Draw (W)',
              data: powers,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              fill: true,
              tension: 0.3,
              borderWidth: 2,
              yAxisID: 'yPower',
              pointRadius: readings.length > 100 ? 0 : 2
            },
            {
              label: 'Voltage (V)',
              data: voltages,
              borderColor: '#06b6d4',
              borderWidth: 1.5,
              borderDash: [4, 4],
              tension: 0.3,
              yAxisID: 'yVolt',
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#9ca3af' } } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', maxTicksLimit: 10 } },
            yPower: { type: 'linear', position: 'left', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#f59e0b' } },
            yVolt: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#06b6d4' } }
          }
        }
      });
    }

    function renderTable(readings) {
      const tbody = document.getElementById("tableBody");
      const slice = readings.slice(-50).reverse(); // Show last 50 entries
      tbody.innerHTML = slice.map(r => {
        let badgeClass = "badge-unknown";
        const st = r.status.toLowerCase();
        if (st === "charging") badgeClass = "badge-charging";
        else if (st === "discharging") badgeClass = "badge-discharging";
        else if (st === "full") badgeClass = "badge-full";

        return \`
          <tr>
            <td>\${new Date(r.timestamp * 1000).toLocaleString()}</td>
            <td>\${r.batteryName}</td>
            <td><strong>\${r.capacityPercent}%</strong></td>
            <td><span class="badge \${badgeClass}">\${r.status}</span></td>
            <td>\${r.powerW.toFixed(2)} W</td>
            <td>\${r.voltageV.toFixed(2)} V</td>
            <td>\${r.energyNowWh.toFixed(1)} Wh</td>
            <td>\${r.sohPercent.toFixed(1)}%</td>
          </tr>
        \`;
      }).join("");
    }

    function exportData(format) {
      const readings = filterReadings();
      if (format === 'json') {
        const jsonStr = JSON.stringify(readings, null, 2);
        downloadFile(jsonStr, "bathist_export.json", "application/json");
      } else if (format === 'csv') {
        if (readings.length === 0) return;
        const keys = Object.keys(readings[0]);
        const csvRows = [keys.join(",")];
        readings.forEach(r => {
          csvRows.push(keys.map(k => JSON.stringify(r[k] ?? "")).join(","));
        });
        downloadFile(csvRows.join("\n"), "bathist_export.csv", "text/csv");
      }
    }

    function downloadFile(content, fileName, mimeType) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }

    // Initial render
    updateRangeButtons();
    updateDashboard();
  </script>
</body>
</html>`;
}
