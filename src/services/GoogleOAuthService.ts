import { App, Notice } from "obsidian";
import * as http from "http";
import * as url from "url";
import { OmniPluginSettings } from "../models/OmniSettings";
import { KeychainService } from "./KeychainService";

export class GoogleOAuthService {
    private app: App;
    private settings: OmniPluginSettings;
    private keychain: KeychainService;
    private saveSettings: () => Promise<void>;

    constructor(app: App, settings: OmniPluginSettings, keychain: KeychainService, saveSettings: () => Promise<void>) {
        this.app = app;
        this.settings = settings;
        this.keychain = keychain;
        this.saveSettings = saveSettings;
    }

    public async getGoogleAccessToken(): Promise<string> {
        let token = await this.keychain.getSecret("omni-logger-google-access-token");
        const tokenExpiryStr = await this.keychain.getSecret("omni-logger-google-token-expiry");
        const tokenExpiry = tokenExpiryStr ? parseInt(tokenExpiryStr, 10) : 0;

        if (token && tokenExpiry && Date.now() < tokenExpiry - 60000) {
            return token;
        }

        const refreshToken = await this.keychain.getSecret("omni-logger-google-refresh-token");
        if (!refreshToken) return "";

        let clientId = "";
        let clientSecret = "";

        const credsJson = await this.keychain.getSecret("omni-logger-google-credentials");
        if (credsJson) {
            try {
                const parsed = JSON.parse(credsJson);
                const client = parsed.web || parsed.installed || parsed;
                clientId = client.client_id || "";
                clientSecret = client.client_secret || "";
            } catch (e) {}
        }

        if (!clientId || !clientSecret) {
            const conn = this.settings.apiConnections?.find(c => c.id === 'google-health');
            clientId = conn?.clientId || "";
            clientSecret = conn?.clientSecret || "";
        }

        if (!clientId || !clientSecret) return "";

        try {
            const body = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: "refresh_token"
            });

            const res = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: body.toString()
            });

            if (!res.ok) return "";

            const data = await res.json();
            token = data.access_token;
            const expiresIn = data.expires_in || 3600;
            const expiry = Date.now() + expiresIn * 1000;

            await this.keychain.setSecret("omni-logger-google-access-token", undefined, token);
            await this.keychain.setSecret("omni-logger-google-token-expiry", undefined, expiry.toString());

            return token;
        } catch (e) {
            console.error("Failed to refresh Google token:", e);
            return "";
        }
    }

    public async startGoogleOAuthFlow(connectionId: string = "google-health"): Promise<void> {
        let clientId = "";
        let clientSecret = "";

        const credsJson = await this.keychain.getSecret("omni-logger-google-credentials");
        if (credsJson) {
            try {
                const parsed = JSON.parse(credsJson);
                const client = parsed.web || parsed.installed || parsed;
                clientId = client.client_id || "";
                clientSecret = client.client_secret || "";
            } catch (e) {}
        }

        if (!clientId || !clientSecret) {
            const conn = this.settings.apiConnections?.find(c => c.id === connectionId);
            clientId = conn?.clientId || "";
            clientSecret = conn?.clientSecret || "";
        }

        if (!clientId || !clientSecret) {
            new Notice("Please enter Google Client ID and Secret in settings first.");
            return;
        }

        const scopes = this.settings.requestedScopes || [
            "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
            "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
            "https://www.googleapis.com/auth/googlehealth.nutrition.readonly",
            "https://www.googleapis.com/auth/googlehealth.nutrition.writeonly"
        ];

        const redirectUri = "http://localhost:8092";

        const server = http.createServer(async (req, res) => {
            const reqUrl = url.parse(req.url || "", true);
            const authCode = reqUrl.query.code as string;

            if (authCode) {
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end("<h1>Authentication Successful!</h1><p>You can close this tab and return to Obsidian.</p>");
                server.close();

                try {
                    const body = new URLSearchParams({
                        code: authCode,
                        client_id: clientId,
                        client_secret: clientSecret,
                        redirect_uri: redirectUri,
                        grant_type: "authorization_code"
                    });

                    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: body.toString()
                    });

                    if (!tokenRes.ok) {
                        const err = await tokenRes.text();
                        new Notice("Failed to exchange auth code: " + err);
                        return;
                    }

                    const tokenData = await tokenRes.json();
                    await this.keychain.setSecret("omni-logger-google-access-token", undefined, tokenData.access_token);
                    if (tokenData.refresh_token) {
                        await this.keychain.setSecret("omni-logger-google-refresh-token", undefined, tokenData.refresh_token);
                    }
                    const expiresIn = tokenData.expires_in || 3600;
                    await this.keychain.setSecret("omni-logger-google-token-expiry", undefined, (Date.now() + expiresIn * 1000).toString());

                    new Notice("Google Health Connected Successfully! 🟢");
                } catch (e) {
                    console.error("Token exchange failed:", e);
                    new Notice("Token exchange failed: " + e.message);
                }
            } else {
                res.writeHead(400, { "Content-Type": "text/html" });
                res.end("<h1>Authentication Failed</h1><p>No authorization code received.</p>");
                server.close();
            }
        });

        server.listen(8092, () => {
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes.join(" "))}&access_type=offline&prompt=consent`;
            window.open(authUrl, "_blank");
            new Notice("Opening browser for Google Authentication...");
        });

        setTimeout(() => {
            try { server.close(); } catch (e) {}
        }, 120000);
    }
}
