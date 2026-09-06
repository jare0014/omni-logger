import { App, Notice } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";

export class VenvManager {
    private app: App;
    private pluginId: string;

    constructor(app: App, pluginId: string = "omni-logger") {
        this.app = app;
        this.pluginId = pluginId;
    }

    public async ensureVenv(): Promise<void> {
        const anyAdapter = this.app.vault.adapter as any;
        const vaultPath = anyAdapter.getBasePath ? anyAdapter.getBasePath() : "";
        if (!vaultPath) return;

        const pluginDir = path.join(vaultPath, ".obsidian", "plugins", this.pluginId);
        const venvDir = path.join(pluginDir, ".venv");

        if (fs.existsSync(venvDir)) {
            return;
        }

        new Notice("Omni-Logger: Setting up Python virtual environment (this may take a minute)...");

        const checkPython = (cmd: string, cb: (ok: boolean) => void) => {
            exec(`${cmd} --version`, (err) => cb(!err));
        };

        checkPython("python", (hasPython) => {
            const pyCmd = hasPython ? "python" : "python3";
            exec(`${pyCmd} -m venv .venv`, { cwd: pluginDir }, (err) => {
                if (err) {
                    console.error("Failed to create venv:", err);
                    new Notice("Failed to create Python virtual environment. Please install python.");
                    return;
                }
                const isWin = os.platform() === "win32";
                const pipCmd = isWin
                    ? `"${path.join(venvDir, "Scripts", "pip.exe")}" install requests pillow`
                    : `"${path.join(venvDir, "bin", "pip")}" install requests pillow`;

                exec(pipCmd, (pipErr) => {
                    if (pipErr) {
                        console.error("Failed to install dependencies:", pipErr);
                        new Notice("Failed to install python dependencies.");
                    } else {
                        new Notice("Omni-Logger: Python environment ready!");
                    }
                });
            });
        });
    }
}
