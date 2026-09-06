import { App } from "obsidian";
import * as fs from "fs";
import * as path from "path";

export class BleService {
    private app: App;

    constructor(app: App) {
        this.app = app;
    }

    public getBLEDevicesDir(): string {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        return path.join(vaultPath, '.obsidian', 'plugins', 'omni-logger', 'bluetooth_devices');
    }

    public listPairedDevices(): any[] {
        const devDir = this.getBLEDevicesDir();
        if (!fs.existsSync(devDir)) return [];
        try {
            return fs.readdirSync(devDir)
                .filter(f => f.endsWith('.json'))
                .map(f => {
                    try {
                        const data = JSON.parse(fs.readFileSync(path.join(devDir, f), 'utf8'));
                        return data;
                    } catch (e) { return null; }
                })
                .filter(Boolean);
        } catch (e) {
            console.error("[Omni-Logger] Failed to list bluetooth_devices/:", e);
            return [];
        }
    }

    public savePairedDevice(deviceObj: { name: string; [key: string]: any }): void {
        const devDir = this.getBLEDevicesDir();
        fs.mkdirSync(devDir, { recursive: true });
        const fileName = `${deviceObj.name}.json`;
        fs.writeFileSync(path.join(devDir, fileName), JSON.stringify(deviceObj, null, 2), 'utf8');
    }

    public removePairedDevice(deviceName: string): void {
        const filePath = path.join(this.getBLEDevicesDir(), `${deviceName}.json`);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (e) {
                console.error(`[Omni-Logger] Failed to remove device ${deviceName}:`, e);
            }
        }
    }
}
