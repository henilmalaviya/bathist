export function renderReportHtml(payloadBase64: string): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>bathist • Battery Analytics</title>
  <!-- Google Fonts & Chart.js -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg-canvas: #000000;
      --bg-card: #0a0a0a;
      --bg-card-hover: #121212;
      --border-main: #222222;
      --border-hover: #444444;
      --text-primary: #ededed;
      --text-secondary: #888888;
      --text-muted: #666666;
      --accent-blue: #0070f3;
      --accent-cyan: #06b6d4;
      --accent-green: #10b981;
      --accent-amber: #f59e0b;
      --font-sans: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-mono: 'Geist Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-canvas);
      color: var(--text-primary);
      font-family: var(--font-sans);
      letter-spacing: -0.02em;
      line-height: 1.5;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 32px 24px;
    }

    /* Header */
    .app-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-main);
      gap: 16px;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .app-logo-badge {
      width: 40px;
      height: 40px;
      background: var(--bg-card);
      border: 1px solid var(--border-main);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .brand-title h1 {
      font-size: 20px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.03em;
    }

    .brand-title p {
      font-size: 13px;
      color: var(--text-secondary);
    }

    /* Actions Toolbar */
    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .btn-primary {
      background: #ffffff;
      color: #000000;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary:hover {
      background: #ccc;
      transform: translateY(-1px);
    }

    .btn-secondary, select {
      background: var(--bg-card);
      color: var(--text-primary);
      border: 1px solid var(--border-main);
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-secondary:hover, select:hover {
      background: var(--bg-card-hover);
      border-color: var(--border-hover);
    }

    /* Range Pill Selector */
    .pill-group {
      background: var(--bg-card);
      border: 1px solid var(--border-main);
      border-radius: 8px;
      padding: 3px;
      display: inline-flex;
      gap: 2px;
    }

    .pill-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 5px 12px;
      border-radius: 5px;
      font-size: 12px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .pill-btn:hover {
      color: var(--text-primary);
    }

    .pill-btn.active {
      background: #222222;
      color: #ffffff;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    /* Tabs Navigation */
    .tabs-nav {
      display: flex;
      gap: 24px;
      margin-top: 24px;
      border-bottom: 1px solid var(--border-main);
    }

    .tab-item {
      padding: 10px 0;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-secondary);
      cursor: pointer;
      position: relative;
      transition: color 0.15s ease;
    }

    .tab-item:hover {
      color: var(--text-primary);
    }

    .tab-item.active {
      color: var(--text-primary);
      font-weight: 600;
    }

    .tab-item.active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: #ffffff;
    }

    /* Grid Layout */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 16px;
      margin-top: 24px;
    }

    .kpi-card {
      background: var(--bg-card);
      border: 1px solid var(--border-main);
      border-radius: 12px;
      padding: 20px;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .kpi-card:hover {
      border-color: var(--border-hover);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
    }

    .kpi-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      color: var(--text-secondary);
      font-weight: 500;
      margin-bottom: 12px;
    }

    .kpi-value {
      font-size: 30px;
      font-weight: 700;
      letter-spacing: -0.04em;
      color: var(--text-primary);
      line-height: 1;
    }

    .kpi-footer {
      margin-top: 10px;
      font-size: 12px;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }

    /* Status Badge */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-main);
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      display: inline-block;
    }

    .dot-discharging { background: var(--accent-green); box-shadow: 0 0 8px var(--accent-green); }
    .dot-charging { background: var(--accent-blue); box-shadow: 0 0 8px var(--accent-blue); }
    .dot-full { background: var(--accent-cyan); }
    .dot-warning { background: var(--accent-amber); }

    /* Section Cards */
    .section-card {
      background: var(--bg-card);
      border: 1px solid var(--border-main);
      border-radius: 12px;
      padding: 24px;
      margin-top: 24px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 20px;
      letter-spacing: -0.02em;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(560px, 1fr));
      gap: 20px;
    }

    @media (max-width: 768px) {
      .charts-grid { grid-template-columns: 1fr; }
    }

    .chart-box {
      height: 320px;
      position: relative;
    }

    /* Data Table */
    .table-container {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      text-align: left;
    }

    th {
      border-bottom: 1px solid var(--border-main);
      color: var(--text-secondary);
      font-weight: 500;
      padding: 12px 16px;
      font-family: var(--font-mono);
      font-size: 12px;
      text-transform: uppercase;
    }

    td {
      border-bottom: 1px solid #161616;
      padding: 12px 16px;
      color: var(--text-primary);
      font-family: var(--font-mono);
    }

    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }

    footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid var(--border-main);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="app-header">
      <div class="brand-group">
        <div class="app-logo-badge">⚡</div>
        <div class="brand-title">
          <h1>bathist</h1>
          <p>Battery Analytics & Power Telemetry</p>
        </div>
      </div>

      <div class="toolbar">
        <select id="batterySelect" onchange="updateDashboard()"></select>

        <div class="pill-group" id="rangeGroup">
          <button class="pill-btn" onclick="setTimeRange('1h')">1h</button>
          <button class="pill-btn" onclick="setTimeRange('6h')">6h</button>
          <button class="pill-btn" onclick="setTimeRange('24h')">24h</button>
          <button class="pill-btn" onclick="setTimeRange('7d')">7d</button>
          <button class="pill-btn" onclick="setTimeRange('30d')">30d</button>
          <button class="pill-btn" onclick="setTimeRange('all')">All</button>
        </div>

        <button class="btn-primary" onclick="exportData('csv')">Export CSV</button>
        <button class="btn-secondary" onclick="exportData('json')">Export JSON</button>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <nav class="tabs-nav">
      <div class="tab-item active" onclick="switchTab('overview')">Overview</div>
      <div class="tab-item" onclick="switchTab('analytics')">Power & Voltage</div>
      <div class="tab-item" onclick="switchTab('table')">Logs</div>
      <div class="tab-item" onclick="switchTab('specs')">Hardware Specs</div>
    </nav>

    <!-- Tab 1: Overview -->
    <div id="tab-overview">
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-header">
            <span>Battery Level</span>
            <span id="badgeState" class="status-badge"><span id="dotState" class="dot"></span> <span id="txtState">--</span></span>
          </div>
          <div class="kpi-value" id="valCapacity">--%</div>
          <div class="kpi-footer" id="valEnergy">-- Wh / -- Wh</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span>State of Health (SoH)</span>
            <span>🩺</span>
          </div>
          <div class="kpi-value" id="valSoh">--%</div>
          <div class="kpi-footer" id="valDesignCapacity">Design: -- Wh</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span>Current Power Draw</span>
            <span>⚡</span>
          </div>
          <div class="kpi-value" id="valPower">-- W</div>
          <div class="kpi-footer" id="valPowerStats">Avg: -- W | Peak: -- W</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-header">
            <span>Voltage & Cycles</span>
            <span>🔌</span>
          </div>
          <div class="kpi-value" id="valVoltage">-- V</div>
          <div class="kpi-footer" id="valCycles">Cycles: --</div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">Capacity (%) & Discharge Timeline</div>
        <div class="chart-box">
          <canvas id="chartCapacity"></canvas>
        </div>
      </div>
    </div>

    <!-- Tab 2: Power Analytics -->
    <div id="tab-analytics" style="display: none;">
      <div class="section-card">
        <div class="section-title">Power Consumption (Watts) vs Voltage (Volts)</div>
        <div class="chart-box" style="height: 400px;">
          <canvas id="chartPower"></canvas>
        </div>
      </div>
    </div>

    <!-- Tab 3: Table Logs -->
    <div id="tab-table" style="display: none;">
      <div class="section-card">
        <div class="section-title">Telemetry Snapshot Log</div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Device</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Power (W)</th>
                <th>Voltage (V)</th>
                <th>Energy (Wh)</th>
                <th>SoH %</th>
              </tr>
            </thead>
            <tbody id="tableBody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 4: Hardware Specs -->
    <div id="tab-specs" style="display: none;">
      <div class="section-card">
        <div class="section-title">Battery Hardware Diagnostics</div>
        <div id="specsContent" style="font-family: var(--font-mono); font-size: 13px; color: var(--text-secondary); line-height: 2;"></div>
      </div>
    </div>

    <!-- Footer -->
    <footer>
      <div>Generated by <strong>bathist</strong> • High Performance Linux Telemetry</div>
      <div id="genDate"></div>
    </footer>
  </div>

  <script>
    // Decode embedded Base64 payload cleanly
    const PAYLOAD_BASE64 = "${payloadBase64}";
    function decodePayload(b64) {
      try {
        const binStr = atob(b64);
        const bytes = Uint8Array.from(binStr, c => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
      } catch (e) {
        console.error("Failed to decode embedded report payload", e);
        return { allBatNames: [], readingsMap: {}, summaries: [], staticInfoMap: {}, timeRange: "24h", generatedAt: new Date().toISOString() };
      }
    }

    const DATA = decodePayload(PAYLOAD_BASE64);
    let currentBattery = DATA.allBatNames[0] || "BAT0";
    let currentTimeRange = DATA.timeRange || "24h";

    let chartCapInstance = null;
    let chartPowerInstance = null;

    document.getElementById("genDate").textContent = new Date(DATA.generatedAt).toLocaleString();

    const batSelect = document.getElementById("batterySelect");
    batSelect.innerHTML = DATA.allBatNames.map(b => \`<option value="\${b}">Battery \${b}</option>\`).join("");
    if (DATA.allBatNames.length > 1) {
      batSelect.innerHTML += \`<option value="ALL">All Batteries</option>\`;
    }

    function switchTab(tabName) {
      const tabs = ['overview', 'analytics', 'table', 'specs'];
      tabs.forEach(t => {
        const el = document.getElementById("tab-" + t);
        if (el) el.style.display = (t === tabName) ? "block" : "none";
      });

      document.querySelectorAll(".tab-item").forEach((el, idx) => {
        if (tabs[idx] === tabName) el.classList.add("active");
        else el.classList.remove("active");
      });

      if (tabName === 'analytics' || tabName === 'overview') {
        setTimeout(updateDashboard, 50);
      }
    }

    function setTimeRange(range) {
      currentTimeRange = range;
      updateRangeButtons();
      updateDashboard();
    }

    function updateRangeButtons() {
      document.querySelectorAll("#rangeGroup .pill-btn").forEach(btn => {
        if (btn.textContent.toLowerCase() === currentTimeRange.toLowerCase()) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
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
      renderSpecs();
    }

    function updateKPIs(readings) {
      if (!readings || readings.length === 0) {
        document.getElementById("valCapacity").textContent = "--%";
        document.getElementById("txtState").textContent = "No Data";
        return;
      }

      const latest = readings[readings.length - 1];
      document.getElementById("valCapacity").textContent = latest.capacityPercent + "%";
      document.getElementById("txtState").textContent = latest.status;

      const dot = document.getElementById("dotState");
      dot.className = "dot";
      const st = latest.status.toLowerCase();
      if (st === "discharging") dot.classList.add("dot-discharging");
      else if (st === "charging") dot.classList.add("dot-charging");
      else if (st === "full") dot.classList.add("dot-full");
      else dot.classList.add("dot-warning");

      document.getElementById("valEnergy").textContent = latest.energyNowWh + " Wh / " + latest.energyFullWh + " Wh";
      document.getElementById("valSoh").textContent = latest.sohPercent.toFixed(1) + "%";
      document.getElementById("valDesignCapacity").textContent = "Design: " + latest.energyFullDesignWh + " Wh";

      document.getElementById("valPower").textContent = latest.powerW.toFixed(2) + " W";

      const powers = readings.map(r => r.powerW);
      const avgP = (powers.reduce((a, b) => a + b, 0) / powers.length).toFixed(2);
      const maxP = Math.max(...powers).toFixed(2);
      document.getElementById("valPowerStats").textContent = "Avg: " + avgP + " W | Peak: " + maxP + " W";

      document.getElementById("valVoltage").textContent = latest.voltageV.toFixed(2) + " V";
      document.getElementById("valCycles").textContent = "Cycles: " + (latest.cycleCount || 0);
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
            borderColor: '#ffffff',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            fill: true,
            tension: 0.2,
            borderWidth: 2,
            pointRadius: readings.length > 100 ? 0 : 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: '#161616' }, ticks: { color: '#666666', maxTicksLimit: 10 } },
            y: { min: 0, max: 100, grid: { color: '#161616' }, ticks: { color: '#666666' } }
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
              borderColor: '#0070f3',
              backgroundColor: 'rgba(0, 112, 243, 0.08)',
              fill: true,
              tension: 0.2,
              borderWidth: 2,
              yAxisID: 'yPower',
              pointRadius: readings.length > 100 ? 0 : 2
            },
            {
              label: 'Voltage (V)',
              data: voltages,
              borderColor: '#10b981',
              borderWidth: 1.5,
              borderDash: [4, 4],
              tension: 0.2,
              yAxisID: 'yVolt',
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#888888' } } },
          scales: {
            x: { grid: { color: '#161616' }, ticks: { color: '#666666', maxTicksLimit: 10 } },
            yPower: { type: 'linear', position: 'left', grid: { color: '#161616' }, ticks: { color: '#0070f3' } },
            yVolt: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#10b981' } }
          }
        }
      });
    }

    function renderTable(readings) {
      const tbody = document.getElementById("tableBody");
      const slice = readings.slice(-50).reverse();
      tbody.innerHTML = slice.map(r => \`
        <tr>
          <td>\${new Date(r.timestamp * 1000).toLocaleString()}</td>
          <td>\${r.batteryName}</td>
          <td>\${r.capacityPercent}%</td>
          <td>\${r.status}</td>
          <td>\${r.powerW.toFixed(2)} W</td>
          <td>\${r.voltageV.toFixed(2)} V</td>
          <td>\${r.energyNowWh.toFixed(1)} Wh</td>
          <td>\${r.sohPercent.toFixed(1)}%</td>
        </tr>
      \`).join("");
    }

    function renderSpecs() {
      const info = DATA.staticInfoMap[currentBattery] || {};
      const container = document.getElementById("specsContent");
      container.innerHTML = \`
        <div><strong>Device Name:</strong> \${info.name || currentBattery}</div>
        <div><strong>Manufacturer:</strong> \${info.manufacturer || 'N/A'}</div>
        <div><strong>Model Name:</strong> \${info.modelName || 'N/A'}</div>
        <div><strong>Serial Number:</strong> \${info.serialNumber || 'N/A'}</div>
        <div><strong>Technology:</strong> \${info.technology || 'N/A'}</div>
        <div><strong>Design Capacity:</strong> \${info.energyFullDesignWh || 0} Wh</div>
        <div><strong>Min Voltage Design:</strong> \${info.voltageMinDesignV || 0} V</div>
      \`;
    }

    function exportData(format) {
      const readings = filterReadings();
      if (format === 'json') {
        downloadFile(JSON.stringify(readings, null, 2), "bathist_export.json", "application/json");
      } else if (format === 'csv') {
        if (readings.length === 0) return;
        const keys = Object.keys(readings[0]);
        const csvRows = [keys.join(",")];
        readings.forEach(r => csvRows.push(keys.map(k => JSON.stringify(r[k] ?? "")).join(",")));
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

    updateRangeButtons();
    updateDashboard();
  </script>
</body>
</html>`;
}
