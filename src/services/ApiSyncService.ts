import { App, Notice, requestUrl } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { OmniPluginSettings, DEFAULT_SETTINGS } from "../models/OmniSettings";
import { KeychainService } from "./KeychainService";
import { GoogleOAuthService } from "./GoogleOAuthService";
import { GoogleHealthService } from "./GoogleHealthService";
import { PythonRunnerService } from "./PythonRunnerService";
import { DailyNoteWriter } from "./DailyNoteWriter";
import { AiLlmService } from "./AiLlmService";
import { ConnectionHealthService } from "./ConnectionHealthService";

export class ApiSyncService {
    private app: App;
    private settings: OmniPluginSettings;
    private keychain: KeychainService;
    private googleOAuth: GoogleOAuthService;
    private googleHealth: GoogleHealthService;
    private pythonRunner: PythonRunnerService;
    private dailyWriter: DailyNoteWriter;
    private aiLlm: AiLlmService;
    private gitLogger: GitLoggerService;
    private connectionHealth?: ConnectionHealthService;
    private lastSyncTimes: Record<string, number> = {};
    private tempOAuthServer: any = null;
    private backgroundSyncInterval: any = null;

    constructor(
        app: App,
        settings: OmniPluginSettings,
        keychain: KeychainService,
        googleOAuth: GoogleOAuthService,
        googleHealth: GoogleHealthService,
        pythonRunner: PythonRunnerService,
        dailyWriter: DailyNoteWriter,
        aiLlm: AiLlmService,
        gitLogger: GitLoggerService,
        connectionHealth?: ConnectionHealthService
    ) {
        this.app = app;
        this.settings = settings;
        this.keychain = keychain;
        this.googleOAuth = googleOAuth;
        this.googleHealth = googleHealth;
        this.pythonRunner = pythonRunner;
        this.dailyWriter = dailyWriter;
        this.aiLlm = aiLlm;
        this.gitLogger = gitLogger;
        this.connectionHealth = connectionHealth;
    }

    public startIntervals(addStatusBarItem: () => HTMLElement): void {
        if (this.connectionHealth) {
            this.connectionHealth.start(addStatusBarItem);
        }
        this.backgroundSyncInterval = setInterval(() => this.runBackgroundSyncs(), 60 * 1000);
    }

    public stopIntervals(): void {
        if (this.connectionHealth) {
            this.connectionHealth.stop();
        }
        if (this.backgroundSyncInterval) {
            clearInterval(this.backgroundSyncInterval);
            this.backgroundSyncInterval = null;
        }
        if (this.tempOAuthServer) {
            try { this.tempOAuthServer.close(); } catch(e) {}
            this.tempOAuthServer = null;
        }
    }

    public getBuiltInGoogleTemplate(templateId: string): any {
        const syncConfig = this.settings.healthSyncConfig || {};
        if (templateId === 'google-sleep') {
            const sleepCfg = syncConfig.sleep || { enabled: true, destination: "frontmatter", key: "Sleep_hours" };
            return {
                id: 'google-sleep',
                name: 'Google Sleep',
                mode: 'api',
                connectionId: 'google-health',
                destination: sleepCfg.destination || 'frontmatter',
                key: sleepCfg.key || 'Sleep_hours',
                prompt: this.settings.googleHealthSleepPrompt || DEFAULT_SETTINGS.googleHealthSleepPrompt
            };
        }
        if (templateId === 'google-hrv') {
            const hrvCfg = syncConfig.hrv || { enabled: true, destination: "frontmatter", key: "HRV" };
            return {
                id: 'google-hrv',
                name: 'Google HRV',
                mode: 'api',
                connectionId: 'google-health',
                destination: hrvCfg.destination || 'frontmatter',
                key: hrvCfg.key || 'HRV',
                prompt: this.settings.googleHealthVitalsPrompt || DEFAULT_SETTINGS.googleHealthVitalsPrompt
            };
        }
        if (templateId === 'google-hydration') {
            const hydCfg = syncConfig.hydration || { enabled: true, destination: "frontmatter", key: "hydration" };
            return {
                id: 'google-hydration',
                name: 'Google Hydration',
                mode: 'api',
                connectionId: 'google-health',
                destination: hydCfg.destination || 'frontmatter',
                key: hydCfg.key || 'hydration',
                prompt: this.settings.googleHealthHydrationPrompt || DEFAULT_SETTINGS.googleHealthHydrationPrompt
            };
        }
        if (templateId === 'google-nutrition') {
            const calCfg = syncConfig.calories || { enabled: false, destination: "frontmatter", key: "calories" };
            return {
                id: 'google-nutrition',
                name: 'Google Nutrition',
                mode: 'api',
                connectionId: 'google-health',
                destination: calCfg.destination || 'frontmatter',
                key: calCfg.key || 'calories',
                prompt: this.settings.googleHealthNutritionPrompt || DEFAULT_SETTINGS.googleHealthNutritionPrompt
            };
        }
        return null;
    }

    public parseGoogleHealthPayloadLocally(templateId: string, payloadText: string): any {
        return this.googleHealth.parseGoogleHealthPayloadLocally(templateId, payloadText);
    }

    public async startOAuth2Flow(connectionId: string): Promise<void> {
        const conn = this.settings.apiConnections?.find(c => c.id === connectionId);
        if (!conn) {
            throw new Error("Connection not found.");
        }

        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const omniLoggerDir = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger`;

        let clientId = conn.clientId;
        let clientSecret = conn.clientSecret;

        if (!clientId) {
            const secretData = await this.keychain.getSecret(`omni-logger-api-client-${conn.id}`, '');
            if (secretData) {
                try {
                    const parsed = JSON.parse(secretData);
                    clientId = parsed.client_id;
                    clientSecret = parsed.client_secret;
                } catch(e) {}
            }
        }

        if (!clientId && conn.id === 'google-health') {
            const googleCreds = await this.keychain.getSecret('omni-logger-google-credentials', 'googleClientJson');
            if (googleCreds) {
                try {
                    const credsData = JSON.parse(googleCreds);
                    const web = credsData.installed || credsData.web || credsData;
                    if (web && web.client_id) {
                        clientId = web.client_id;
                        clientSecret = web.client_secret;
                    }
                } catch(e) {}
            }

            if (!clientId) {
                let credsPath = `${omniLoggerDir}${sep}credentials.json`;
                if (!fs.existsSync(credsPath)) {
                    credsPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}schedule-assistant-focus-timer${sep}credentials.json`;
                }
                if (fs.existsSync(credsPath)) {
                    try {
                        const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                        const web = credsData.installed || credsData.web;
                        if (web) {
                            clientId = web.client_id;
                            clientSecret = web.client_secret;
                        }
                    } catch(e) {}
                }
            }
        }

        if (!clientId) {
            throw new Error(`OAuth Client ID/Secret not configured for connection "${conn.name}". Please add them via OAuth Client Secrets JSON.`);
        }

        const redirectUri = conn.redirectUri || "http://localhost:8092";
        const scopes = (conn.scopes || []).join(" ");

        const authUrl = `${conn.authUrl}?` +
            `response_type=code` +
            `&client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&access_type=offline` +
            `&prompt=consent`;

        if (this.tempOAuthServer) {
            try {
                this.tempOAuthServer.close();
            } catch(e) {}
        }

        const anyApp = this.app as any;
        const schedulePlugin = anyApp.plugins?.getPlugin ? anyApp.plugins.getPlugin('schedule-assistant-focus-timer') : null;
        if (schedulePlugin && schedulePlugin.tempOAuthServer) {
            try {
                schedulePlugin.tempOAuthServer.close();
                schedulePlugin.tempOAuthServer = null;
            } catch(e) {}
        }

        const closeTimeout = setTimeout(() => {
            if (this.tempOAuthServer) {
                try {
                    this.tempOAuthServer.close();
                    this.tempOAuthServer = null;
                } catch(e) {}
            }
        }, 5 * 60 * 1000);

        this.tempOAuthServer = http.createServer(async (req, res) => {
            const reqUrl = new URL(req.url || "", `http://${req.headers.host || 'localhost'}`);
            const code = reqUrl.searchParams.get("code");

            if (code) {
                try {
                    const bodyDetails: Record<string, string> = {
                        code: code,
                        client_id: clientId,
                        client_secret: clientSecret || "",
                        redirect_uri: redirectUri,
                        grant_type: "authorization_code"
                    };
                    const body = Object.keys(bodyDetails)
                        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(bodyDetails[key]))
                        .join('&');

                    const response = await requestUrl({
                        url: conn.tokenUrl || "https://oauth2.googleapis.com/token",
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: body
                    });

                    if (response.status !== 200) {
                        throw new Error(`Token exchange failed: ${response.text}`);
                    }

                    const tokenResponse = response.json;
                    const expiryDate = new Date();
                    expiryDate.setSeconds(expiryDate.getSeconds() + (tokenResponse.expires_in || 3600));

                    const tokenData = {
                        token: tokenResponse.access_token,
                        expiry: expiryDate.toISOString(),
                        token_uri: conn.tokenUrl,
                        client_id: clientId,
                        client_secret: clientSecret,
                        refresh_token: tokenResponse.refresh_token
                    };

                    await this.keychain.setSecret(`omni-logger-oauth-token-${conn.id}`, undefined, JSON.stringify(tokenData));

                    if (conn.id === 'google-health') {
                        const tokenPath = `${omniLoggerDir}${sep}token.json`;
                        fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2), 'utf8');
                    }

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                        <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #1e1e1e; color: #fff;">
                            <h2 style="color: #00ffd0;">Authorization Successful!</h2>
                            <p>Connection "${conn.name}" is now connected to Omni-Logger.</p>
                            <p>You can close this tab and return to Obsidian.</p>
                        </body>
                        </html>
                    `);

                    new Notice(`Successfully authorized connection: ${conn.name}!`);
                } catch (err: any) {
                    console.error("OAuth token exchange failed:", err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end("Authentication failed: " + err.message);
                    new Notice(`Authorization failed for "${conn.name}": ` + err.message);
                } finally {
                    clearTimeout(closeTimeout);
                    setTimeout(() => {
                        if (this.tempOAuthServer) {
                            this.tempOAuthServer.close();
                            this.tempOAuthServer = null;
                        }
                    }, 1000);
                }
            } else {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end("Authorization code missing.");
                clearTimeout(closeTimeout);
                setTimeout(() => {
                    if (this.tempOAuthServer) {
                        this.tempOAuthServer.close();
                        this.tempOAuthServer = null;
                    }
                }, 1000);
            }
        });

        let port = 8092;
        try {
            const redirectUrlObj = new URL(redirectUri);
            port = parseInt(redirectUrlObj.port) || 80;
        } catch(e) {}

        this.tempOAuthServer.listen(port, () => {
            console.log(`Omni-Logger OAuth temp server listening on port ${port}`);
            window.open(authUrl);
        });

        new Notice(`Opening browser to authorize connection: ${conn.name}...`);
    }

    public async getAccessTokenForConnection(connectionId: string): Promise<string | null> {
        if (connectionId === 'google-health') {
            return await this.googleOAuth.getGoogleAccessToken();
        }

        const conn = this.settings.apiConnections?.find(c => c.id === connectionId);
        if (!conn) return null;

        let tokenStr = await this.keychain.getSecret(`omni-logger-oauth-token-${conn.id}`, '');
        if (!tokenStr) return null;

        let tokenData: any;
        try {
            tokenData = JSON.parse(tokenStr);
        } catch(e) {
            return null;
        }

        const expiryStr = tokenData.expiry;
        if (expiryStr) {
            let expiryDt: Date;
            try {
                expiryDt = new Date(expiryStr);
            } catch (e) {
                expiryDt = new Date(Date.now() - 3600 * 1000);
            }

            const nowDt = new Date();
            if (expiryDt.getTime() - nowDt.getTime() > 60 * 1000) {
                return tokenData.token;
            }
        }

        console.log(`OAuth access token expired for connection "${conn.name}". Refreshing token...`);
        const url = tokenData.token_uri || conn.tokenUrl || "https://oauth2.googleapis.com/token";

        const bodyDetails: Record<string, any> = {
            grant_type: "refresh_token",
            client_id: tokenData.client_id,
            client_secret: tokenData.client_secret,
            refresh_token: tokenData.refresh_token
        };
        const body = Object.keys(bodyDetails)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(bodyDetails[key]))
            .join('&');

        try {
            const response = await requestUrl({
                url: url,
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body
            });

            if (response.status === 200) {
                const resData = response.json;
                tokenData.token = resData.access_token;
                if (resData.expires_in) {
                    const newExpiry = new Date();
                    newExpiry.setSeconds(newExpiry.getSeconds() + resData.expires_in);
                    tokenData.expiry = newExpiry.toISOString();
                }
                
                await this.keychain.setSecret(`omni-logger-oauth-token-${conn.id}`, undefined, JSON.stringify(tokenData));
                return tokenData.token;
            }
        } catch(e) {
            console.error("Error refreshing token:", e);
        }

        return null;
    }

    public async fetchFromApiConnection(connectionId: string): Promise<string> {
        const conn = this.settings.apiConnections?.find(c => c.id === connectionId);
        if (!conn) throw new Error("API connection not found.");
        
        let headers: Record<string, string> = {};
        if (conn.customHeaders) {
            try { headers = JSON.parse(conn.customHeaders); } catch(e) {}
        }
        
        if (conn.authType !== 'none') {
            if (conn.authType === 'oauth2') {
                const token = await this.getAccessTokenForConnection(conn.id);
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            } else {
                const secretId = `omni-logger-api-${conn.id}`;
                const token = await this.keychain.getSecret(secretId, '');
                if (token) {
                    if (conn.authType === 'bearer') {
                        headers['Authorization'] = `Bearer ${token}`;
                    } else if (conn.authType === 'apikey') {
                        const headerName = conn.apiKeyHeaderName || 'X-API-Key';
                        headers[headerName] = token;
                    } else if (conn.authType === 'cookie') {
                        headers['Cookie'] = token;
                    }
                }
            }
        }
        
        const params: any = {
            url: conn.url,
            method: conn.method || 'GET',
            headers: headers
        };
        
        const response = await requestUrl(params);
        if (response.status !== 200) {
            throw new Error(`API returned status ${response.status}: ${response.text}`);
        }
        return response.text;
    }

    public async fetchPayloadForTemplate(t: any): Promise<string> {
        if (t.connectionId === 'google-health') {
            const token = await this.googleOAuth.getGoogleAccessToken();
            const now = new Date();
            const startTime = new Date();
            startTime.setDate(now.getDate() - 1);
            startTime.setHours(12, 0, 0, 0);
            const endTime = new Date();
            endTime.setHours(12, 0, 0, 0);
            
            const startIso = startTime.toISOString();
            const endIso = endTime.toISOString();
            
            const localTzOffset = -now.getTimezoneOffset();
            const localTzSign = localTzOffset >= 0 ? '+' : '-';
            const localTzHours = String(Math.floor(Math.abs(localTzOffset) / 60)).padStart(2, '0');
            const localTzMins = String(Math.abs(localTzOffset) % 60).padStart(2, '0');
            const localTz = `${localTzSign}${localTzHours}:${localTzMins}`;
            
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            const dayStartIso = `${dateStr}T00:00:00${localTz}`;
            const dayEndIso = `${dateStr}T23:59:59${localTz}`;
            const dayStartMs = new Date(dayStartIso).getTime();
            const dayEndMs = new Date(dayEndIso).getTime();
            const inDayRange = (timeStr: string) => {
                if (!timeStr) return false;
                const ms = new Date(timeStr).getTime();
                return !isNaN(ms) && ms >= dayStartMs && ms <= dayEndMs;
            };

            if (t.id === 'google-sleep') {
                const filter = `sleep.interval.end_time >= "${startIso}" AND sleep.interval.end_time < "${endIso}"`;
                const sleepUrl = `https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints?filter=${encodeURIComponent(filter)}`;
                const response = await requestUrl({ url: sleepUrl, headers: { 'Authorization': `Bearer ${token}` } });
                return JSON.stringify(response.json || response.text);
            } else if (t.id === 'google-hrv') {
                const hrvUrl = "https://health.googleapis.com/v4/users/me/dataTypes/daily-heart-rate-variability/dataPoints";
                let hrvPoints: any[] = [];
                try {
                    let url: string | null = hrvUrl + "?pageSize=1000";
                    while (url) {
                        const resHrv = await requestUrl({ url: url, headers: { 'Authorization': `Bearer ${token}` } });
                        const points = resHrv.json?.dataPoints || [];
                        hrvPoints.push(...points.filter((pt: any) => {
                            if (pt.dailyHeartRateVariability?.date) {
                                const dObj = pt.dailyHeartRateVariability.date;
                                const dateStr = `${dObj.year}-${String(dObj.month).padStart(2, '0')}-${String(dObj.day).padStart(2, '0')}`;
                                return dateStr === now.toISOString().split('T')[0];
                            }
                            const timeStr = pt.dailyHeartRateVariability?.interval?.startTime || pt.value?.interval?.startTime || pt.startTime || "";
                            return inDayRange(timeStr);
                        }));
                        if (resHrv.json?.nextPageToken) {
                            url = hrvUrl + "?pageSize=1000&pageToken=" + resHrv.json.nextPageToken;
                        } else {
                            url = null;
                        }
                    }
                } catch(e) {
                    console.warn("Failed to fetch HRV logs:", e);
                }
                return JSON.stringify({ hrvLogs: hrvPoints });
            } else if (t.id === 'google-hydration') {
                const hydUrl = "https://health.googleapis.com/v4/users/me/dataTypes/hydration-log/dataPoints";
                let hydPoints: any[] = [];
                try {
                    let url: string | null = hydUrl + "?pageSize=1000";
                    while (url) {
                        const response = await requestUrl({ url: url, headers: { 'Authorization': `Bearer ${token}` } });
                        const points = response.json?.dataPoints || [];
                        hydPoints.push(...points.filter((pt: any) => {
                            const timeStr = pt.hydrationLog?.interval?.startTime || pt.value?.interval?.startTime || "";
                            return inDayRange(timeStr);
                        }));
                        if (response.json?.nextPageToken) {
                            url = hydUrl + "?pageSize=1000&pageToken=" + response.json.nextPageToken;
                        } else {
                            url = null;
                        }
                    }
                } catch(e) {
                    console.warn("Failed to fetch Hydration logs:", e);
                }
                return JSON.stringify({ dataPoints: hydPoints });
            } else if (t.id === 'google-nutrition') {
                const nutritionUrl = "https://health.googleapis.com/v4/users/me/dataTypes/nutrition-log/dataPoints";
                const alcUrl = "https://health.googleapis.com/v4/users/me/dataTypes/alcohol-consumption/dataPoints";
                let nutPoints: any[] = [];
                let alcPoints: any[] = [];
                
                try {
                    let url: string | null = nutritionUrl + "?pageSize=1000";
                    while (url) {
                        const resNut = await requestUrl({ url: url, headers: { 'Authorization': `Bearer ${token}` } });
                        const points = resNut.json?.dataPoints || [];
                        nutPoints.push(...points.filter((pt: any) => {
                            const timeStr = pt.nutritionLog?.interval?.startTime || pt.value?.interval?.startTime || "";
                            return inDayRange(timeStr);
                        }));
                        if (resNut.json?.nextPageToken) {
                            url = nutritionUrl + "?pageSize=1000&pageToken=" + resNut.json.nextPageToken;
                        } else {
                            url = null;
                        }
                    }
                } catch(e) {
                    console.warn("Failed to fetch nutrition logs:", e);
                }
                
                try {
                    let url: string | null = alcUrl + "?pageSize=1000";
                    while (url) {
                        const resAlc = await requestUrl({ url: url, headers: { 'Authorization': `Bearer ${token}` } });
                        const points = resAlc.json?.dataPoints || [];
                        alcPoints.push(...points.filter((pt: any) => {
                            const timeStr = pt.alcoholConsumption?.interval?.startTime || pt.value?.interval?.startTime || "";
                            return inDayRange(timeStr);
                        }));
                        if (resAlc.json?.nextPageToken) {
                            url = alcUrl + "?pageSize=1000&pageToken=" + resAlc.json.nextPageToken;
                        } else {
                            url = null;
                        }
                    }
                } catch(e) {
                    console.warn("Failed to fetch alcohol logs:", e);
                }
                
                return JSON.stringify({ nutritionLogs: nutPoints, alcoholConsumptionLogs: alcPoints });
            }
        }

        return await this.fetchFromApiConnection(t.connectionId);
    }

    public async syncApiTemplate(templateId: string): Promise<void> {
        let t = this.settings.customTemplates?.find(temp => temp.id === templateId);
        if (!t) {
            t = this.getBuiltInGoogleTemplate(templateId);
        }
        if (!t || t.mode !== 'api') return;
        
        try {
            const payloadText = await this.fetchPayloadForTemplate(t);
            let extracted: Record<string, any> = {};
            if (['google-sleep', 'google-hrv', 'google-hydration', 'google-nutrition'].includes(t.id)) {
                extracted = this.parseGoogleHealthPayloadLocally(t.id, payloadText);
            } else {
                const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
                const folderName = this.settings.ingredientsFolder || 'Omni_Templates';
                const cleanDirName = t.name.replace(/[^a-zA-Z0-9 _-]/g, '');
                const parserPath = path.join(vaultPath, folderName, cleanDirName, 'parser.py');
                
                let parsedLocally = false;
                if (fs.existsSync(parserPath)) {
                    const tempInputPath = path.join(vaultPath, folderName, cleanDirName, 'temp_input.txt');
                    fs.writeFileSync(tempInputPath, payloadText, 'utf8');
                    
                    try {
                        const resultText = await this.pythonRunner.runPythonScript(parserPath, `"${tempInputPath}"`, true);
                        try { fs.unlinkSync(tempInputPath); } catch(e) {}
                        extracted = JSON.parse(resultText);
                        parsedLocally = true;
                    } catch(e) {
                        console.warn(`Local Python parser.py failed for ${t.name}, falling back to LLM:`, e);
                        try { fs.unlinkSync(tempInputPath); } catch(err) {}
                    }
                }
                
                if (!parsedLocally) {
                    const provider = this.settings.executorProvider || 'gemini';
                    const model = this.settings.executorModel || 'gemini-2.5-flash';
                    
                    const llmResponse = await this.aiLlm.callLLM(
                        provider,
                        model,
                        t.prompt,
                        `Here is the API response payload for today:\n${payloadText}`
                    );
                    
                    extracted = JSON.parse(llmResponse);
                }
            }
            
            const dataToWrite: Record<string, any> = {};
            const syncConfig = this.settings.healthSyncConfig || {};
            
            if (t.id === 'google-sleep') {
                const sleepCfg = syncConfig.sleep || { enabled: true, destination: "frontmatter", key: "Sleep_hours" };
                const sleepKey = sleepCfg.key || 'Sleep_hours';
                const sleepVal = extracted.Sleep || extracted.Sleep_hours || extracted.sleep || extracted.duration || "";
                const wakeupVal = extracted.Wakeup || extracted.wake_up || extracted.wakeup || "";
                if (sleepVal) dataToWrite[sleepKey] = sleepVal;
                if (wakeupVal) dataToWrite['wake_up'] = wakeupVal;
            } else if (t.id === 'google-hrv') {
                const hrvCfg = syncConfig.hrv || { enabled: true, destination: "frontmatter", key: "HRV" };
                const hrvKey = hrvCfg.key || 'HRV';
                const hrvVal = extracted.HRV || extracted.hrv || extracted.averageHeartRateVariabilityMilliseconds || extracted.rmssd || "";
                if (hrvVal) dataToWrite[hrvKey] = hrvVal;
            } else if (t.id === 'google-hydration') {
                const hydCfg = syncConfig.hydration || { enabled: true, destination: "frontmatter", key: "hydration" };
                const hydKey = hydCfg.key || 'hydration';
                const hydVal = extracted.hydration || extracted.volume || extracted.milliliters || extracted.amount || "";
                if (hydVal) dataToWrite[hydKey] = hydVal;
            } else if (t.id === 'google-nutrition') {
                const subMetrics = ['caffeine', 'alcohol', 'calories', 'protein'];
                subMetrics.forEach(sub => {
                    const cfg = syncConfig[sub] || { enabled: true, destination: "frontmatter", key: sub };
                    if (cfg.enabled) {
                        const key = cfg.key || sub;
                        let val = extracted[sub];
                        if (val === undefined) val = extracted[sub.toUpperCase()];
                        if (val === undefined) val = extracted[sub.charAt(0).toUpperCase() + sub.slice(1)];
                        
                        if (val !== undefined && val !== "") {
                            dataToWrite[key] = val;
                        }
                    }
                });
            } else {
                if (t.key) {
                    const keys = Object.keys(extracted);
                    if (keys.length === 1) {
                        dataToWrite[t.key] = extracted[keys[0]];
                    } else {
                        const match = keys.find(k => k.toLowerCase() === t.key.toLowerCase() || k.toLowerCase().includes(t.name.toLowerCase()));
                        if (match) {
                            dataToWrite[t.key] = extracted[match];
                            keys.forEach(k => {
                                if (k !== match) dataToWrite[k] = extracted[k];
                            });
                        } else {
                            Object.assign(dataToWrite, extracted);
                        }
                    }
                } else {
                    Object.assign(dataToWrite, extracted);
                }
            }
            
            await this.dailyWriter.writeCustomTemplateData(dataToWrite, t);
            new Notice(`Sync complete for template: ${t.name}`);
        } catch(e) {
            console.error(`Sync failed for template ${t.name}:`, e);
            new Notice(`Sync failed for ${t.name}: ${e.message}`);
            throw e;
        }
    }

    public async checkAllConnections(): Promise<void> {
        if (this.connectionHealth) {
            return this.connectionHealth.checkAllConnections();
        }
    }

    public async runBackgroundSyncs(): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const folderName = this.settings.ingredientsFolder || 'Omni_Templates';
        
        for (const t of (this.settings.customTemplates || [])) {
            if (t.mode === 'ble' && t.syncStyle === 'automatic') {
                const intervalMinutes = t.syncInterval || 15;
                const lastSync = this.lastSyncTimes[t.id] || 0;
                const now = Date.now();
                
                if (now - lastSync >= intervalMinutes * 60 * 1000) {
                    this.lastSyncTimes[t.id] = now;
                    const cleanDirName = t.name.replace(/[^a-zA-Z0-9 _-]/g, '');
                    const absoluteTemplatePath = path.join(vaultPath, folderName, cleanDirName);
                    
                    const dailyFile = this.dailyWriter.getDailyNoteFile();
                    if (!dailyFile) continue;
                    
                    const absoluteDailyPath = path.join(vaultPath, dailyFile.path);
                    console.log(`[Omni-Logger] Automatic background BLE sync triggered for template "${t.name}"`);
                    this.pythonRunner.runPythonScript('log_ble.py', `--template-dir "${absoluteTemplatePath}" --file "${absoluteDailyPath}"`, true);
                }
            } else if (t.mode === 'api' && t.syncStyle === 'automatic') {
                const intervalMinutes = t.syncInterval || 60;
                const lastSync = this.lastSyncTimes[t.id] || 0;
                const now = Date.now();
                
                if (now - lastSync >= intervalMinutes * 60 * 1000) {
                    this.lastSyncTimes[t.id] = now;
                    console.log(`[Omni-Logger] Automatic background API sync triggered for template "${t.name}"`);
                    try {
                        await this.syncApiTemplate(t.id);
                    } catch(e) {
                        console.error(`Automatic sync failed for template "${t.name}":`, e);
                    }
                }
            }
        }

        if (this.settings.gitSyncStyle === 'automatic') {
            const gitInterval = this.settings.gitSyncInterval || 60;
            const lastGitSync = this.lastSyncTimes['git'] || 0;
            const now = Date.now();
            if (now - lastGitSync >= gitInterval * 60 * 1000) {
                this.lastSyncTimes['git'] = now;
                console.log(`[Omni-Logger] Automatic background Git sync triggered`);
                this.gitLogger.logGitHistory();
            }
        }

        if (this.settings.googleHealthSyncStyle === 'automatic') {
            const healthInterval = this.settings.googleHealthSyncInterval || 60;
            const lastHealthSync = this.lastSyncTimes['google-health'] || 0;
            const now = Date.now();
            if (now - lastHealthSync >= healthInterval * 60 * 1000) {
                this.lastSyncTimes['google-health'] = now;
                console.log(`[Omni-Logger] Automatic background Google Health sync triggered`);
                try {
                    await this.googleHealth.pullGoogleHealthData();
                } catch(e) {
                    console.error("Automatic Google Health sync failed:", e);
                }
            }
        }
    }

    public async getRawScannedKeys(): Promise<string[]> {
        const keys = new Set<string>();
        const googleHealthKeys = ["Sleep_hours", "Sleep_score", "Readiness", "HRV", "caffeine", "alcohol", "hydration", "protein", "calories"];
        googleHealthKeys.forEach(k => keys.add(k));
        keys.add("git_commits");
        
        const customKeys = this.settings.customAvailableKeys || [];
        customKeys.forEach(k => keys.add(k));
        
        try {
            const dailyFiles = this.app.vault.getMarkdownFiles().filter(file => {
                const norm = file.path.replace(/\\/g, '/');
                return norm.includes('02_Journal/01_Daily') && file.name.match(/^\d{4}-\d{2}-\d{2}\.md$/);
            }).sort((a, b) => b.name.localeCompare(a.name));

            const filesToScan = dailyFiles.slice(0, 30);
            for (let file of filesToScan) {
                const cache = this.app.metadataCache.getFileCache(file);
                if (cache?.frontmatter) {
                    Object.keys(cache.frontmatter).forEach(k => {
                        if (k !== 'position' && k !== 'tags' && k !== 'cssclasses') {
                            keys.add(k);
                        }
                    });
                }
                
                const content = await this.app.vault.read(file);
                const inlineRegex = /^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?)?([a-zA-Z0-9_\-]+)(?:::|:)\s*(.+)$/gm;
                let match;
                while ((match = inlineRegex.exec(content)) !== null) {
                    keys.add(match[1].trim());
                }
            }
        } catch (e) {
            console.error("Error scanning daily notes for keys:", e);
        }
        
        try {
            const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
            const localParserPath = path.join(vaultPath, '.obsidian', 'plugins', 'omni-logger', 'local-parser.js');
            if (fs.existsSync(localParserPath)) {
                const localContent = fs.readFileSync(localParserPath, 'utf8');
                const moduleObj: any = { exports: {} };
                const fn = new Function('module', 'exports', 'require', localContent);
                fn(moduleObj, moduleObj.exports, require);
                const localParser = moduleObj.exports;
                if (localParser && Array.isArray(localParser.extraCards)) {
                    localParser.extraCards.forEach((card: any) => {
                        if (card.key) keys.add(card.key);
                    });
                }
            }
        } catch (e) {
            console.error("Error reading local-parser.js for keys:", e);
        }

        return Array.from(keys);
    }

    public async getAvailableKeys(): Promise<string[]> {
        const raw = await this.getRawScannedKeys();
        const blacklist = this.settings.blacklistedKeys || [];
        return raw.filter(k => !blacklist.includes(k));
    }

    public async saveLocalParserCards(extraCards: any[]): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const localParserPath = path.join(vaultPath, '.obsidian', 'plugins', 'omni-logger', 'local-parser.js');
        
        let parseMetricsStr = `function(frontmatter, inlineData, parsedRow, state, getVal, content) {}`;
        try {
            if (fs.existsSync(localParserPath)) {
                const localContent = fs.readFileSync(localParserPath, 'utf8');
                const moduleObj: any = { exports: {} };
                const fn = new Function('module', 'exports', 'require', localContent);
                fn(moduleObj, moduleObj.exports, require);
                if (moduleObj.exports && typeof moduleObj.exports.parseMetrics === 'function') {
                    parseMetricsStr = moduleObj.exports.parseMetrics.toString();
                }
            }
        } catch(e) {
            console.error("Error extracting parseMetrics function:", e);
        }

        const cardsJson = JSON.stringify(extraCards, null, 4);
        const newContent = `module.exports = {
    extraCards: ${cardsJson},
    parseMetrics: ${parseMetricsStr}
};`;

        fs.writeFileSync(localParserPath, newContent, 'utf8');
    }
}
