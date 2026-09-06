import { App, Notice } from "obsidian";
import * as child_process from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { OmniPluginSettings } from "../models/OmniSettings";
import { KeychainService } from "./KeychainService";
import { DailyNoteWriter } from "./DailyNoteWriter";

export class PythonRunnerService {
    private app: App;
    private settings: OmniPluginSettings;
    private keychain: KeychainService;
    private dailyWriter: DailyNoteWriter;

    constructor(app: App, settings: OmniPluginSettings, keychain: KeychainService, dailyWriter: DailyNoteWriter) {
        this.app = app;
        this.settings = settings;
        this.keychain = keychain;
        this.dailyWriter = dailyWriter;
    }

    public runPythonScript(scriptName: string, scriptArgs: string = "", isBackground: boolean = false): Promise<string> {
        return new Promise((resolve, reject) => {
            const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
            const sep = vaultPath.includes('/') ? '/' : '\\';
            
            let scriptPath: string;
            if (scriptName.startsWith('/') || scriptName.startsWith('\\') || scriptName.includes(':') || scriptName.startsWith('99_System')) {
                if (scriptName.startsWith('99_System')) {
                    scriptPath = path.join(vaultPath, scriptName);
                } else {
                    scriptPath = scriptName;
                }
            } else {
                scriptPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}${scriptName}`;
            }
            
            const dailyFile = this.dailyWriter.getDailyNoteFile();
            if (!dailyFile) {
                if (!isBackground) {
                    new Notice("Daily note not found!");
                }
                resolve("");
                return;
            }
            const absoluteDailyPath = path.join(vaultPath, dailyFile.path);
            
            this.keychain.getSecret(this.settings.geminiApiKeyId || 'omni-logger-gemini-api-key', 'geminiApiKey').then(async (geminiKey) => {
                if (!geminiKey) {
                    geminiKey = await this.keychain.getSecret('timeblocker-gemini-api-key', 'geminiApiKey');
                }
                const env = Object.assign({}, process.env, {
                    GEMINI_API_KEY: geminiKey
                });
                
                const pluginDir = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger`;
                const venvPython = os.platform() === 'win32'
                    ? path.join(pluginDir, '.venv', 'Scripts', 'python.exe')
                    : path.join(pluginDir, '.venv', 'bin', 'python');
                const pythonCmd = fs.existsSync(venvPython) ? `"${venvPython}"` : 'python';
                
                const argsStr = scriptArgs ? " " + scriptArgs : ` "${absoluteDailyPath}"`;
                const cmd = `${pythonCmd} -u "${scriptPath}"${argsStr}`;
                console.log(`Running Python script: ${cmd}`);
                
                child_process.exec(cmd, { env: env }, (err, stdout, stderr) => {
                    if (err) {
                        console.error(`Script error: ${stderr || err.message}`);
                        if (!isBackground) {
                            new Notice(`Error running ${scriptName}: ${stderr || err.message}`);
                        }
                        reject(err);
                    } else {
                        console.log(`Script output: ${stdout}`);
                        if (stdout.trim() && !isBackground) {
                            new Notice(stdout.trim());
                        }
                        resolve(stdout);
                    }
                });
            });
        });
    }

    public async runHL7QueryScript(): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const projectDir = `${vaultPath}${sep}04_Projects${sep}hl7-nl-to-sql`;
        const scriptPath = `${projectDir}${sep}query_lake_obsidian.py`;
        
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice("No active note found!");
            return;
        }
        const absoluteActivePath = path.join(vaultPath, activeFile.path);
        
        let geminiKey = await this.keychain.getSecret(this.settings.geminiApiKeyId || 'omni-logger-gemini-api-key', 'geminiApiKey');
        if (!geminiKey) {
            geminiKey = await this.keychain.getSecret('timeblocker-gemini-api-key', 'geminiApiKey');
        }
        const env = Object.assign({}, process.env, {
            GEMINI_API_KEY: geminiKey
        });
        
        const venvPython = process.platform === 'win32'
            ? path.join(projectDir, '.venv', 'Scripts', 'python.exe')
            : path.join(projectDir, '.venv', 'bin', 'python');
        const pythonCmd = fs.existsSync(venvPython) ? `"${venvPython}"` : 'python';
        
        const cmd = `${pythonCmd} -u "${scriptPath}" "${absoluteActivePath}"`;
        console.log(`Running Python script: ${cmd}`);
        
        new Notice("Running HL7 NL-to-SQL Query...");
        
        child_process.exec(cmd, { env: env }, (err, stdout, stderr) => {
            if (err) {
                console.error(`Script error: ${stderr || err.message}`);
                new Notice(`Error: ${stderr || err.message}`);
            } else {
                console.log(`Script output: ${stdout}`);
                if (stdout.trim()) {
                    new Notice(stdout.trim());
                }
            }
        });
    }

    public async runHL7IngestScript(): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const projectDir = `${vaultPath}${sep}04_Projects${sep}hl7-nl-to-sql`;
        const scriptPath = `${projectDir}${sep}ingest_all_samples.py`;
        
        let geminiKey = await this.keychain.getSecret(this.settings.geminiApiKeyId || 'omni-logger-gemini-api-key', 'geminiApiKey');
        if (!geminiKey) {
            geminiKey = await this.keychain.getSecret('timeblocker-gemini-api-key', 'geminiApiKey');
        }
        const env = Object.assign({}, process.env, {
            GEMINI_API_KEY: geminiKey
        });
        
        const venvPython = process.platform === 'win32'
            ? path.join(projectDir, '.venv', 'Scripts', 'python.exe')
            : path.join(projectDir, '.venv', 'bin', 'python');
        const pythonCmd = fs.existsSync(venvPython) ? `"${venvPython}"` : 'python';
        
        const cmd = `${pythonCmd} -u "${scriptPath}"`;
        console.log(`Running Ingest Script: ${cmd}`);
        
        new Notice("Starting HL7 Batch Ingestion...");
        
        child_process.exec(cmd, { env: env }, (err, stdout, stderr) => {
            if (err) {
                console.error(`Ingest error: ${stderr || err.message}`);
                new Notice(`Ingest Error: ${stderr || err.message}`);
            } else {
                console.log(`Ingest output: ${stdout}`);
                new Notice("HL7 Batch Ingestion Completed successfully!");
            }
        });
    }
}
