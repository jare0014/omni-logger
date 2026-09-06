import * as obsidian from "obsidian";
import * as fs from "fs";
import * as path from "path";
import { OmniPluginSettings, DEFAULT_SETTINGS } from "./models/OmniSettings";
import { OmniLoggerSettingTab } from "./settings/OmniSettingsTab";
import { KeychainService } from "./services/KeychainService";
import { GoogleOAuthService } from "./services/GoogleOAuthService";
import { GoogleHealthService } from "./services/GoogleHealthService";
import { GitLoggerService } from "./services/GitLoggerService";
import { VenvManager } from "./services/VenvManager";
import { DailyNoteWriter } from "./services/DailyNoteWriter";
import { PythonRunnerService } from "./services/PythonRunnerService";
import { BleService } from "./services/BleService";
import { AiLlmService } from "./services/AiLlmService";
import { CustomTemplateService } from "./services/CustomTemplateService";
import { ConnectionHealthService } from "./services/ConnectionHealthService";
import { ApiSyncService } from "./services/ApiSyncService";
import { OmniCommandRegistry } from "./commands/OmniCommandRegistry";
import { registerDashboardCodeBlock, archiveWeeklyReport } from "./views/DashboardProcessor";
import { organizeCustomPluginsSidebar, hookSettingsSidebar } from "./views/SidebarOrganizer";

export default class OmniLoggerPlugin extends obsidian.Plugin {
    public settings!: OmniPluginSettings;
    public localSettings: any = {};
    public settingsTab!: OmniLoggerSettingTab;

    // Modular Services
    public keychainService!: KeychainService;
    public googleOAuthService!: GoogleOAuthService;
    public googleHealthService!: GoogleHealthService;
    public gitLoggerService!: GitLoggerService;
    public venvManager!: VenvManager;
    public dailyWriter!: DailyNoteWriter;
    public pythonRunner!: PythonRunnerService;
    public bleService!: BleService;
    public aiLlmService!: AiLlmService;
    public customTemplateService!: CustomTemplateService;
    public connectionHealthService!: ConnectionHealthService;
    public apiSyncService!: ApiSyncService;
    public commandRegistry!: OmniCommandRegistry;

    async onload(): Promise<void> {
        await this.loadSettings();
        await this.swallowGoogleCredentials();

        // Initialize default local-parser.js if missing
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const localParserPath = path.join(vaultPath, '.obsidian', 'plugins', 'omni-logger', 'local-parser.js');
        if (!fs.existsSync(localParserPath)) {
            const defaultTemplate = `module.exports = {
    extraCards: [
        { key: "Sleep_score", label: "Sleep Score", unit: "", agg: "average", chartType: "line", color: "#6366f1", showTile: true },
        { key: "Sleep_hours", label: "Sleep Hours", unit: "hrs", agg: "average", chartType: "line", color: "#10b981", showTile: true },
        { key: "Readiness", label: "Readiness", unit: "", agg: "average", chartType: "line", color: "#ec4899", showTile: true },
        { key: "HRV", label: "HRV", unit: "ms", agg: "average", chartType: "line", color: "#f59e0b", showTile: true }
    ],
    parseMetrics: function(frontmatter, inlineData, parsedRow, state, getVal, content) {
        const parseFloatSafe = (value) => {
            if (typeof value === 'string') {
                value = value.replace(/,/g, '');
            }
            const num = parseFloat(value);
            return isNaN(num) ? undefined : num;
        };

        parsedRow['Sleep_score'] = parseFloatSafe(getVal('Sleep_score'));
        parsedRow['Sleep_hours'] = parseFloatSafe(getVal('Sleep_hours'));
        parsedRow['Readiness'] = parseFloatSafe(getVal('Readiness'));
        parsedRow['HRV'] = parseFloatSafe(getVal('HRV'));
    }
};`;
            try {
                fs.writeFileSync(localParserPath, defaultTemplate, 'utf8');
            } catch (e) {
                console.error("[Omni-Logger] Failed to initialize default local-parser.js:", e);
            }
        }

        await this.loadLocalSettings();
        this.initializeDefaultConnectionsAndTemplates();
        await this.saveSettings();

        // Instantiate Decoupled Service Layer
        this.keychainService = new KeychainService(this.app, this.settings);
        this.googleOAuthService = new GoogleOAuthService(this.app, this.settings, this.keychainService, () => this.saveSettings());
        this.googleHealthService = new GoogleHealthService(this.settings, this.googleOAuthService);
        this.gitLoggerService = new GitLoggerService(this.app, this.settings);
        this.venvManager = new VenvManager(this.app);
        this.dailyWriter = new DailyNoteWriter(this.app, this.settings);
        this.pythonRunner = new PythonRunnerService(this.app, this.settings, this.keychainService, this.dailyWriter);
        this.bleService = new BleService(this.app);
        this.aiLlmService = new AiLlmService(this.app, this.settings, this.keychainService, this.dailyWriter);
        this.connectionHealthService = new ConnectionHealthService(this.app, this.settings, this.keychainService);
        this.customTemplateService = new CustomTemplateService(
            this.app,
            this.settings,
            this.aiLlmService,
            (tmpl) => this.commandRegistry?.registerSingleTemplateCommand(tmpl)
        );
        this.apiSyncService = new ApiSyncService(
            this.app,
            this.settings,
            this.keychainService,
            this.googleOAuthService,
            this.googleHealthService,
            this.pythonRunner,
            this.dailyWriter,
            this.aiLlmService,
            this.gitLoggerService,
            this.connectionHealthService
        );
        this.commandRegistry = new OmniCommandRegistry(this);

        // Lifecycle executions
        this.venvManager.ensureVenv();
        await this.customTemplateService.loadCustomTemplatesFromVault();
        this.commandRegistry.registerAllCommands();
        registerDashboardCodeBlock(this);
        this.apiSyncService.startIntervals(() => this.addStatusBarItem());
        hookSettingsSidebar(this.app, this);

        // Settings Tab
        this.settingsTab = new OmniLoggerSettingTab(this.app, this);
        this.addSettingTab(this.settingsTab);

        // Auto-sync on startup if enabled
        if (this.settings.autoSyncOnStartup && this.settings.dataSourceApi === 'google-health') {
            this.app.workspace.onLayoutReady(async () => {
                try {
                    console.log("Omni-Logger: Performing auto-sync on startup...");
                    await this.pullGoogleHealthData();
                    console.log("Omni-Logger: Auto-sync completed successfully.");
                } catch (e) {
                    console.warn("Omni-Logger: Startup auto-sync failed:", e);
                }
            });
        }
    }

    onunload(): void {
        this.apiSyncService?.stopIntervals();
    }

    // ==========================================
    // Settings Persistence
    // ==========================================
    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    async loadLocalSettings(): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const localPath = path.join(vaultPath, '.obsidian', 'plugins', 'omni-logger', 'data.json');
        if (fs.existsSync(localPath)) {
            try {
                this.localSettings = JSON.parse(fs.readFileSync(localPath, 'utf8'));
            } catch (e) {
                console.error("[Omni-Logger] Failed to load local data.json:", e);
                this.localSettings = {};
            }
        } else {
            this.localSettings = {};
        }
    }

    async saveLocalSettings(): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const localPath = path.join(vaultPath, '.obsidian', 'plugins', 'omni-logger', 'data.json');
        try {
            fs.writeFileSync(localPath, JSON.stringify(this.localSettings, null, 2), 'utf8');
        } catch (e) {
            console.error("[Omni-Logger] Failed to save local data.json:", e);
        }
    }

    initializeDefaultConnectionsAndTemplates(): void {
        if (!this.settings.apiConnections || this.settings.apiConnections.length === 0) {
            this.settings.apiConnections = [
                {
                    id: 'google-health',
                    name: 'Google Health API',
                    url: 'https://health.googleapis.com/v4/users/me',
                    authType: 'oauth2',
                    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                    tokenUrl: 'https://oauth2.googleapis.com/token',
                    scopes: [
                        "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
                        "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
                        "https://www.googleapis.com/auth/googlehealth.nutrition.readonly",
                        "https://www.googleapis.com/auth/googlehealth.nutrition.writeonly"
                    ],
                    redirectUri: 'http://localhost:8092',
                    clientId: '',
                    clientSecret: ''
                }
            ];
        }

        if (!this.settings.customTemplates) {
            this.settings.customTemplates = [];
        }
    }

    async swallowGoogleCredentials(): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const credPath = path.join(vaultPath, '.obsidian', 'plugins', 'omni-logger', 'credentials.json');
        if (fs.existsSync(credPath)) {
            try {
                const creds = fs.readFileSync(credPath, 'utf8');
                await this.setSecret('omni-logger-google-credentials', 'googleClientJson', creds);
                fs.unlinkSync(credPath);
            } catch (e) {
                console.error("Failed to swallow credentials.json:", e);
            }
        }
    }

    // ==========================================
    // Backward-Compatible Facade Delegations
    // ==========================================
    getDailyNoteFile(): obsidian.TFile | null {
        return this.dailyWriter.getDailyNoteFile();
    }

    async writeDataToDailyNote(dateStr: string, data: Record<string, any>, destination: 'frontmatter' | 'heading' | 'file' = 'frontmatter'): Promise<boolean> {
        return this.dailyWriter.writeDataToDailyNote(dateStr, data, destination);
    }

    async writeCustomTemplateData(data: Record<string, any>, customTemplate: any): Promise<void> {
        return this.dailyWriter.writeCustomTemplateData(data, customTemplate);
    }

    updateInlineFieldsInContent(content: string, data: Record<string, any>): string {
        return this.dailyWriter.updateInlineFieldsInContent(content, data);
    }

    appendLogFieldsInContent(content: string, data: Record<string, any>): string {
        return this.dailyWriter.appendLogFieldsInContent(content, data);
    }

    updateCallsInContent(content: string, calls_dict: Record<string, any>): string {
        return this.dailyWriter.updateCallsInContent(content, calls_dict);
    }

    updateLumosityInContent(content: string, startTime: string, scores: any[]): string {
        return this.dailyWriter.updateLumosityInContent(content, startTime, scores);
    }

    updateFrontmatterProperties(content: string, updates: Record<string, any>): string {
        return this.dailyWriter.updateFrontmatterProperties(content, updates);
    }

    updateDataviewFields(content: string, updates: Record<string, any>): string {
        return this.dailyWriter.updateDataviewFields(content, updates);
    }

    appendToBottomLog(content: string, updates: Record<string, any>): string {
        return this.dailyWriter.appendToBottomLog(content, updates);
    }

    escapeRegex(str: string): string {
        return this.dailyWriter.escapeRegex(str);
    }

    async getSecret(secretId: string, fallbackKey?: string): Promise<string> {
        return this.keychainService.getSecret(secretId, fallbackKey);
    }

    async setSecret(secretId: string, fallbackKey: string | undefined, value: string): Promise<void> {
        return this.keychainService.setSecret(secretId, fallbackKey, value);
    }

    async storeSecret(secretId: string, value: string): Promise<void> {
        return this.keychainService.setSecret(secretId, undefined, value);
    }

    async getGoogleAccessToken(): Promise<string> {
        return this.googleOAuthService.getGoogleAccessToken();
    }

    async startGoogleOAuthFlow(connectionId: string = 'google-health'): Promise<void> {
        return this.googleOAuthService.startGoogleOAuthFlow(connectionId);
    }

    async pullGoogleHealthData(): Promise<any> {
        return this.googleHealthService.pullGoogleHealthData();
    }

    parseGoogleHealthPayloadLocally(templateId: string, payloadText: string): any {
        return this.apiSyncService.parseGoogleHealthPayloadLocally(templateId, payloadText);
    }

    getBuiltInGoogleTemplate(templateId: string): any {
        return this.apiSyncService.getBuiltInGoogleTemplate(templateId);
    }

    async fetchPayloadForTemplate(t: any): Promise<string> {
        return this.apiSyncService.fetchPayloadForTemplate(t);
    }

    async syncApiTemplate(templateId: string): Promise<void> {
        return this.apiSyncService.syncApiTemplate(templateId);
    }

    async fetchFromApiConnection(connectionId: string): Promise<string> {
        return this.apiSyncService.fetchFromApiConnection(connectionId);
    }

    async getAccessTokenForConnection(connectionId: string): Promise<string | null> {
        return this.apiSyncService.getAccessTokenForConnection(connectionId);
    }

    async startOAuth2Flow(connectionId: string): Promise<void> {
        return this.apiSyncService.startOAuth2Flow(connectionId);
    }

    async checkAllConnections(): Promise<void> {
        return this.apiSyncService.checkAllConnections();
    }

    async runBackgroundSyncs(): Promise<void> {
        return this.apiSyncService.runBackgroundSyncs();
    }

    async getRawScannedKeys(): Promise<string[]> {
        return this.apiSyncService.getRawScannedKeys();
    }

    async getAvailableKeys(): Promise<string[]> {
        return this.apiSyncService.getAvailableKeys();
    }

    async saveLocalParserCards(extraCards: any[]): Promise<void> {
        return this.apiSyncService.saveLocalParserCards(extraCards);
    }

    async callLLM(provider: string, model: string, systemPrompt: string, promptText: string, imageBase64: string | null = null, imageMimeType: string | null = null): Promise<string> {
        return this.aiLlmService.callLLM(provider, model, systemPrompt, promptText, imageBase64, imageMimeType);
    }

    async processOCR(base64Data: string, mimeType: string, type: string): Promise<void> {
        return this.aiLlmService.processOCR(base64Data, mimeType, type);
    }

    async processCustomAPI(inputText: string, templateId: string): Promise<void> {
        return this.aiLlmService.processCustomAPI(inputText, templateId);
    }

    async generateCustomTemplatePrompt(name: string, mode: string, exampleInput: string, targetAppearance: string, destination: string, customInstructions?: string): Promise<{ prompt: string; pythonCode: string }> {
        return this.customTemplateService.generateCustomTemplatePrompt(name, mode, exampleInput, targetAppearance, destination, customInstructions);
    }

    async loadCustomTemplatesFromVault(): Promise<void> {
        return this.customTemplateService.loadCustomTemplatesFromVault();
    }

    async saveCustomTemplateToVault(template: any, exampleInput: string, targetAppearance: string, instructions: string): Promise<void> {
        return this.customTemplateService.saveCustomTemplateToVault(template, exampleInput, targetAppearance, instructions);
    }

    async deleteCustomTemplateFromVault(templateName: string): Promise<void> {
        return this.customTemplateService.deleteCustomTemplateFromVault(templateName);
    }

    async updateMetaBindButton(t: any): Promise<void> {
        return this.customTemplateService.updateMetaBindButton(t);
    }

    async removeMetaBindButton(id: string): Promise<void> {
        return this.customTemplateService.removeMetaBindButton(id);
    }

    async loadGoToItems(): Promise<any[]> {
        return this.customTemplateService.loadGoToItems();
    }

    async saveGoToItems(items: any[]): Promise<void> {
        return this.customTemplateService.saveGoToItems(items);
    }

    runPythonScript(scriptName: string, scriptArgs: string = "", isBackground: boolean = false): Promise<string> {
        return this.pythonRunner.runPythonScript(scriptName, scriptArgs, isBackground);
    }

    async runHL7QueryScript(): Promise<void> {
        return this.pythonRunner.runHL7QueryScript();
    }

    async runHL7IngestScript(): Promise<void> {
        return this.pythonRunner.runHL7IngestScript();
    }

    getBLEDevicesDir(): string {
        return this.bleService.getBLEDevicesDir();
    }

    listPairedDevices(): any[] {
        return this.bleService.listPairedDevices();
    }

    savePairedDevice(deviceObj: any): void {
        return this.bleService.savePairedDevice(deviceObj);
    }

    removePairedDevice(deviceName: string): void {
        return this.bleService.removePairedDevice(deviceName);
    }

    async logGitHistory(): Promise<void> {
        return this.gitLoggerService.logGitHistory();
    }

    async archiveWeeklyReport(): Promise<void> {
        return archiveWeeklyReport(this);
    }

    registerSingleTemplateCommand(t: any): void {
        return this.commandRegistry.registerSingleTemplateCommand(t);
    }

    registerCustomTemplateCommands(): void {
        return this.commandRegistry.registerCustomTemplateCommands();
    }

    organizeCustomPluginsSidebar(): void {
        return organizeCustomPluginsSidebar(this.app);
    }
}
