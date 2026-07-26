import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export function generateSystemdServiceContent(binaryOrScriptPath: string): string {
  return `[Unit]
Description=bathist Battery Monitoring Daemon
Documentation=https://github.com/neon/bathist
After=default.target

[Service]
Type=simple
ExecStart=${binaryOrScriptPath} daemon
Restart=always
RestartSec=5
Nice=19
CPUSchedulingPolicy=idle
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
`;
}

export function installSystemdService(binaryOrScriptPath: string): void {
  const serviceDir = join(homedir(), ".config", "systemd", "user");
  if (!existsSync(serviceDir)) {
    mkdirSync(serviceDir, { recursive: true });
  }

  const servicePath = join(serviceDir, "bathist.service");
  const content = generateSystemdServiceContent(binaryOrScriptPath);
  writeFileSync(servicePath, content, "utf-8");

  console.log(`\n✅ Systemd user service installed to: ${servicePath}`);
  console.log(`\nTo enable and start bathist service immediately at boot:`);
  console.log(`  systemctl --user daemon-reload`);
  console.log(`  systemctl --user enable --now bathist.service`);
  console.log(`\nTo check service status:`);
  console.log(`  systemctl --user status bathist.service`);
  console.log(`  journalctl --user -u bathist.service -f\n`);
}

export function printHyprlandInstruction(binaryOrScriptPath: string): void {
  console.log(`\n🧊 Hyprland Autostart Integration:`);
  console.log(`Add the following line to your Hyprland configuration file (~/.config/hypr/hyprland.conf):\n`);
  console.log(`  exec-once = ${binaryOrScriptPath} daemon`);
  console.log(`\nThis will launch the bathist daemon silently in the background when Hyprland starts.\n`);
}
