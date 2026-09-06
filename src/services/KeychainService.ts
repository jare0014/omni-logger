import { App } from "obsidian";
import { OmniPluginSettings } from "../models/OmniSettings";

export class KeychainService {
    private app: App;
    private settings: OmniPluginSettings;

    constructor(app: App, settings: OmniPluginSettings) {
        this.app = app;
        this.settings = settings;
    }

    public async getSecret(secretId: string, fallbackKey?: string): Promise<string> {
        const anyApp = this.app as any;
        if (anyApp.secretStorage && typeof anyApp.secretStorage.getSecret === 'function') {
            try {
                const val = await anyApp.secretStorage.getSecret(secretId);
                if (val) return val;
            } catch (e) {
                console.error(`Keychain getSecret failed for ${secretId}:`, e);
            }
        }

        if (fallbackKey && (this.settings as any)[fallbackKey]) {
            return (this.settings as any)[fallbackKey];
        }
        return "";
    }

    public async setSecret(secretId: string, fallbackKey: string | undefined, value: string): Promise<void> {
        const anyApp = this.app as any;
        if (anyApp.secretStorage && typeof anyApp.secretStorage.setSecret === 'function') {
            try {
                await anyApp.secretStorage.setSecret(secretId, value);
                return;
            } catch (e) {
                console.error(`Keychain setSecret failed for ${secretId}:`, e);
            }
        }

        if (fallbackKey) {
            (this.settings as any)[fallbackKey] = value;
        }
    }
}
