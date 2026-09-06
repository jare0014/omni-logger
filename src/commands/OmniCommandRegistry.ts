import { Notice } from "obsidian";
import * as path from "path";
import type OmniLoggerPlugin from "../main";
import { OmniLoggerModal } from "../views/modals/OmniLoggerModal";
import { OmniFoodLoggerModal } from "../views/modals/OmniFoodLoggerModal";
import { OmniHealthHistoryModal } from "../views/modals/OmniHealthHistoryModal";

export class OmniCommandRegistry {
    private plugin: OmniLoggerPlugin;

    constructor(plugin: OmniLoggerPlugin) {
        this.plugin = plugin;
    }

    public registerAllCommands(): void {
        const p = this.plugin;

        // Archive Weekly Report
        p.addCommand({
            id: 'archive-weekly-report',
            name: 'Archive Weekly Health & Productivity Report',
            callback: () => p.archiveWeeklyReport()
        });

        // Open Modal
        p.addCommand({
            id: 'open-omni-logger',
            name: 'Open Omni-Logger Modal',
            callback: () => {
                new OmniLoggerModal(p.app, p).open();
            }
        });

        // Git Logging
        p.addCommand({
            id: 'log-today-git-history',
            name: 'Log Today\'s Git History',
            callback: () => p.logGitHistory(),
        });

        p.addRibbonIcon('git-branch', 'Log Git Activity', () => {
            p.logGitHistory();
        });

        // Sync Google Health
        p.addCommand({
            id: 'sync-google-health',
            name: 'Sync Google Health Data',
            callback: async () => {
                try {
                    new Notice("Starting Google Health sync...");
                    await p.pullGoogleHealthData();
                    new Notice("Successfully synced health stats from Google API!");
                } catch (e: any) {
                    new Notice("Google Health sync failed: " + e.message);
                }
            }
        });

        // Food Logger
        p.addCommand({
            id: 'open-food-logger',
            name: 'Open Food Ingestion & Registry',
            callback: () => {
                new OmniFoodLoggerModal(p.app, p).open();
            }
        });

        // Health History
        p.addCommand({
            id: 'open-health-history',
            name: 'Open Google Health History Manager',
            callback: () => {
                new OmniHealthHistoryModal(p.app, p).open();
            }
        });

        // HL7
        p.addCommand({
            id: 'hl7-nl-query',
            name: 'Run HL7 NL-to-SQL Query',
            callback: () => p.runHL7QueryScript()
        });

        p.addCommand({
            id: 'hl7-ingest-all',
            name: 'Ingest All HL7 Samples',
            callback: () => p.runHL7IngestScript()
        });

        // Register custom templates
        this.registerCustomTemplateCommands();
    }

    public registerSingleTemplateCommand(t: any): void {
        const p = this.plugin;
        const vaultPath = (p.app.vault.adapter as any).getBasePath ? (p.app.vault.adapter as any).getBasePath() : "";
        const folderName = p.settings.ingredientsFolder || 'Omni_Templates';
        
        const ids = new Set<string>([t.id]);
        if (t.id === 'custom-work-calls') {
            ids.add('work_logs');
            ids.add('work-calls');
            ids.add('work_calls');
        } else if (t.id === 'custom-lumosity') {
            ids.add('lumosity');
        }
        
        for (const cmdId of ids) {
            const fullId = `omni-logger:run-template-${cmdId}`;
            const anyApp = p.app as any;
            if (anyApp.commands && typeof anyApp.commands.removeCommand === 'function') {
                anyApp.commands.removeCommand(fullId);
            } else if (anyApp.commands?.commands?.[fullId]) {
                delete anyApp.commands.commands[fullId];
            }
            
            const isPrimary = (cmdId === t.id);
            const cmdName = isPrimary ? `Sync BLE/Metrics: ${t.name}` : `Sync BLE/Metrics: ${t.name} (Legacy: ${cmdId})`;
            
            p.addCommand({
                id: `run-template-${cmdId}`,
                name: cmdName,
                callback: () => {
                    if (t.mode === 'ble') {
                        const cleanDirName = t.name.replace(/[^a-zA-Z0-9 _-]/g, '');
                        const absoluteTemplatePath = path.join(vaultPath, folderName, cleanDirName);
                        
                        const dailyFile = p.getDailyNoteFile();
                        if (!dailyFile) {
                            new Notice("Daily note not found!");
                            return;
                        }
                        const absoluteDailyPath = path.join(vaultPath, dailyFile.path);
                        
                        new Notice(`Starting BLE sync for ${t.name}...`);
                        p.runPythonScript('log_ble.py', `--template-dir "${absoluteTemplatePath}" --file "${absoluteDailyPath}"`);
                    } else if (t.mode === 'connection') {
                        const cleanDirName = t.name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
                        const dirFolderName = cleanDirName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                        const connectionFolder = path.join(vaultPath, '99_System', 'Omni_Connections', dirFolderName);
                        
                        const dailyFile = p.getDailyNoteFile();
                        if (!dailyFile) {
                            new Notice("Daily note not found!");
                            return;
                        }
                        const absoluteDailyPath = path.join(vaultPath, dailyFile.path);
                        
                        new Notice(`Executing API caller for ${t.name}...`);
                        p.runPythonScript(path.join(connectionFolder, 'caller.py'), "", true).then(() => {
                            new Notice(`Mapping metrics for ${t.name}...`);
                            return p.runPythonScript(path.join(connectionFolder, 'sync.py'), `"${absoluteDailyPath}"`, true);
                        }).then(() => {
                            new Notice(`Sync complete for ${t.name}!`);
                        }).catch(err => {
                            new Notice(`Connection sync failed for ${t.name}: ${err.message}`);
                        });
                    } else if (t.mode === 'ocr') {
                        const cleanDirName = t.name.replace(/[^a-zA-Z0-9 _-]/g, '');
                        const absoluteTemplatePath = path.join(vaultPath, folderName, cleanDirName);
                        
                        const dailyFile = p.getDailyNoteFile();
                        if (!dailyFile) {
                            new Notice("Daily note not found!");
                            return;
                        }
                        const absoluteDailyPath = path.join(vaultPath, dailyFile.path);
                        
                        new Notice(`Starting OCR sync for ${t.name}...`);
                        p.runPythonScript('log_ocr.py', `--template-dir "${absoluteTemplatePath}" --file "${absoluteDailyPath}"`);
                    } else if (t.mode === 'api') {
                        new Notice(`Syncing API connection for ${t.name}...`);
                        p.syncApiTemplate(t.id);
                    } else {
                        const modal = new OmniLoggerModal(p.app, p);
                        modal.selectedType = t.id;
                        modal.selectedMode = t.mode;
                        modal.open();
                    }
                }
            });
        }
    }

    public registerCustomTemplateCommands(): void {
        for (const t of (this.plugin.settings.customTemplates || [])) {
            this.registerSingleTemplateCommand(t);
        }
    }
}
