import { App, Notice, requestUrl } from "obsidian";
import * as fs from "fs";
import { OmniPluginSettings } from "../models/OmniSettings";
import { KeychainService } from "./KeychainService";

export class ConnectionHealthService {
    private app: App;
    private settings: OmniPluginSettings;
    private keychain: KeychainService;
    private statusBarEl: HTMLElement | null = null;
    private checkInterval: any = null;

    constructor(app: App, settings: OmniPluginSettings, keychain: KeychainService) {
        this.app = app;
        this.settings = settings;
        this.keychain = keychain;
    }

    public start(addStatusBarItem: () => HTMLElement): void {
        this.statusBarEl = addStatusBarItem();
        setTimeout(() => this.checkAllConnections(), 2000);
        this.checkInterval = setInterval(() => this.checkAllConnections(), 15 * 60 * 1000);
    }

    public stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        if (this.statusBarEl) {
            this.statusBarEl.remove();
            this.statusBarEl = null;
        }
    }

    public async checkAllConnections(): Promise<void> {
        const statuses: Record<string, { name: string; ok: boolean; msg: string }> = {
            gemini: { name: 'Gemini API', ok: true, msg: 'Not Active' },
            ollama: { name: 'Ollama Server', ok: true, msg: 'Not Active' },
            openai: { name: 'OpenAI API', ok: true, msg: 'Not Active' },
            googleHealth: { name: 'Google Health API', ok: true, msg: 'Not Enabled' }
        };

        const requestWithTimeout = async (params: any, timeoutMs = 2500) => {
            return Promise.race([
                requestUrl(params),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
            ]);
        };
        
        // 1. Gemini
        const isGeminiActive = (this.settings.templateProvider === 'gemini' || this.settings.executorProvider === 'gemini');
        let geminiKey = await this.keychain.getSecret(this.settings.geminiApiKeyId || 'omni-logger-gemini-api-key', 'geminiApiKey');
        if (!geminiKey) {
            geminiKey = await this.keychain.getSecret('timeblocker-gemini-api-key', 'geminiApiKey');
        }
        if (!geminiKey && !isGeminiActive) {
            statuses.gemini = { name: 'Gemini API', ok: true, msg: 'Ollama Active / Optional' };
        } else if (!geminiKey && isGeminiActive) {
            statuses.gemini = { name: 'Gemini API', ok: false, msg: 'Missing Key in Keychain' };
        } else if (geminiKey) {
            try {
                const res: any = await requestWithTimeout({
                    url: `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
                    method: 'GET'
                });
                if (res.status === 200) {
                    statuses.gemini = { name: 'Gemini API', ok: true, msg: 'Connected' };
                } else {
                    statuses.gemini = { name: 'Gemini API', ok: false, msg: 'Invalid Key' };
                }
            } catch(e) {
                statuses.gemini = { name: 'Gemini API', ok: isGeminiActive ? false : true, msg: 'Connection Error' };
            }
        }
        
        // 2. Ollama
        const useOllama = (this.settings.templateProvider === 'ollama' || this.settings.executorProvider === 'ollama');
        const ollamaUrl = this.settings.ollamaUrl || 'http://localhost:11434';
        try {
            const res: any = await requestWithTimeout({
                url: `${ollamaUrl}/api/tags`,
                method: 'GET'
            });
            if (res.status === 200) {
                statuses.ollama = { name: 'Ollama Server', ok: true, msg: 'Connected' };
            } else {
                statuses.ollama = { name: 'Ollama Server', ok: useOllama ? false : true, msg: 'Unavailable' };
            }
        } catch(e) {
            statuses.ollama = { name: 'Ollama Server', ok: useOllama ? false : true, msg: 'Offline / Optional' };
        }
        
        // 3. OpenAI
        const isOpenAIActive = (this.settings.templateProvider === 'openai' || this.settings.executorProvider === 'openai');
        let openaiKey = await this.keychain.getSecret(this.settings.openaiApiKeyId || 'omni-logger-openai-api-key', 'openaiApiKey');
        if (!openaiKey && !isOpenAIActive) {
            statuses.openai = { name: 'OpenAI API', ok: true, msg: 'Not Active / Optional' };
        } else if (!openaiKey && isOpenAIActive) {
            statuses.openai = { name: 'OpenAI API', ok: false, msg: 'Missing Key in Keychain' };
        } else if (openaiKey) {
            try {
                const res: any = await requestWithTimeout({
                    url: `https://api.openai.com/v1/models`,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${openaiKey}` }
                });
                if (res.status === 200) {
                    statuses.openai = { name: 'OpenAI API', ok: true, msg: 'Connected' };
                } else {
                    statuses.openai = { name: 'OpenAI API', ok: false, msg: 'Invalid Key' };
                }
            } catch(e) {
                statuses.openai = { name: 'OpenAI API', ok: isOpenAIActive ? false : true, msg: 'Connection Error' };
            }
        }
        
        // 4. Google Health
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const healthTokenPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}token.json`;
        const standaloneHealthTokenPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}health-connect-readiness${sep}token.json`;
        
        if (fs.existsSync(healthTokenPath) || fs.existsSync(standaloneHealthTokenPath)) {
            statuses.googleHealth = { name: 'Google Health API', ok: true, msg: 'Connected' };
        } else if (this.settings.dataSourceApi === 'google-health') {
            statuses.googleHealth = { name: 'Google Health API', ok: false, msg: 'Disconnected' };
        } else {
            statuses.googleHealth = { name: 'Google Health API', ok: true, msg: 'Not Enabled' };
        }
        
        const alerts: string[] = [];
        for (const key of Object.keys(statuses)) {
            if (!statuses[key].ok) {
                alerts.push(`${statuses[key].name}: ${statuses[key].msg}`);
            }
        }
        
        this.updateStatusBarUI(alerts, statuses);
    }

    public updateStatusBarUI(alerts: string[], statuses: Record<string, { name: string; ok: boolean; msg: string }>): void {
        if (!this.statusBarEl) return;
        
        this.statusBarEl.empty();
        const container = this.statusBarEl.createDiv({ cls: 'omni-status-bar-item' });
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.cursor = 'pointer';
        
        if (alerts.length > 0) {
            container.innerHTML = `<span style="color:#ff453a; margin-right:4px;">⚠️</span> <span style="font-weight:500; color:#ff453a;">${alerts.length} API Alert${alerts.length > 1 ? 's' : ''}</span>`;
            this.statusBarEl.setAttribute('title', `API Errors:\n- ${alerts.join('\n- ')}\n\nClick to show details.`);
        } else {
            container.innerHTML = `<span style="color:#30d158; margin-right:4px;">✓</span> <span style="color:var(--text-muted); font-size: 0.9em; font-weight: 500;">API Online</span>`;
            this.statusBarEl.setAttribute('title', 'All APIs Connected:\n' + Object.keys(statuses).map(k => `- ${statuses[k].name}: ${statuses[k].msg}`).join('\n'));
        }
        
        container.onclick = () => {
            if (alerts.length > 0) {
                new Notice(`API Connection Alert Details:\n\n${alerts.join('\n')}\n\nPlease open settings to re-authenticate.`, 6000);
            } else {
                new Notice("All API connections are healthy!", 3000);
            }
        };
    }
}
