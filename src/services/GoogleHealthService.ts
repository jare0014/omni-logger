import { Notice } from "obsidian";
import { OmniPluginSettings } from "../models/OmniSettings";
import { GoogleOAuthService } from "./GoogleOAuthService";
import { requestWithTimeout } from "../utils/HttpUtils";

export class GoogleHealthService {
    private settings: OmniPluginSettings;
    private oauth: GoogleOAuthService;

    constructor(settings: OmniPluginSettings, oauth: GoogleOAuthService) {
        this.settings = settings;
        this.oauth = oauth;
    }

    public async pullGoogleHealthData(): Promise<any> {
        const token = await this.oauth.getGoogleAccessToken();
        if (!token) {
            new Notice("Not authenticated with Google Health API.");
            return null;
        }

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const startIso = (new Date(startOfDay.getTime() - 43200000)).toISOString(); // 12h lookback for sleep
        const endIso = endOfDay.toISOString();

        const results: Record<string, any> = {};

        try {
            // Sleep Sessions
            const sleepUrl = `https://health.googleapis.com/v4/users/me/dataTypes/sleep-session/dataPoints?startTime=${startIso}&endTime=${endIso}`;
            const sleepRes = await requestWithTimeout({
                url: sleepUrl,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (sleepRes.status === 200) {
                results.sleep = this.parseGoogleHealthPayloadLocally('google-health-sleep', JSON.stringify(sleepRes.json));
            }
        } catch (e) {
            console.error("Google Health Sleep pull error:", e);
        }

        try {
            // Vitals (HRV & RMSSD)
            const vitalsUrl = `https://health.googleapis.com/v4/users/me/dataTypes/health-metrics-and-measurements/dataPoints?startTime=${startIso}&endTime=${endIso}`;
            const vitalsRes = await requestWithTimeout({
                url: vitalsUrl,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (vitalsRes.status === 200) {
                results.vitals = this.parseGoogleHealthPayloadLocally('google-health-vitals', JSON.stringify(vitalsRes.json));
            }
        } catch (e) {
            console.error("Google Health Vitals pull error:", e);
        }

        return results;
    }

    public parseGoogleHealthPayloadLocally(templateId: string, payloadText: string): any {
        try {
            const data = JSON.parse(payloadText);
            const points = data.dataPoint || data.dataPoints || data.points || [];

            if (templateId === 'google-health-sleep') {
                let maxDurationMinutes = 0;
                let longestSession: any = null;

                for (const p of points) {
                    const start = new Date(p.interval?.startTime || p.startTime).getTime();
                    const end = new Date(p.interval?.endTime || p.endTime).getTime();
                    const diffMins = (end - start) / 60000;
                    if (diffMins > maxDurationMinutes) {
                        maxDurationMinutes = diffMins;
                        longestSession = p;
                    }
                }

                if (longestSession) {
                    const hours = Math.floor(maxDurationMinutes / 60);
                    const mins = Math.round(maxDurationMinutes % 60);
                    const sleepStr = `${hours}:${String(mins).padStart(2, '0')}`;
                    const endDate = new Date(longestSession.interval?.endTime || longestSession.endTime);
                    const wakeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
                    return { Sleep_hours: sleepStr, wake_up: wakeStr };
                }
            } else if (templateId === 'google-health-vitals') {
                let hrvSum = 0;
                let hrvCount = 0;

                for (const p of points) {
                    const hrv = p.heartRateVariabilityRmssd || p.rmssd || p.heartRateVariability?.rmssd;
                    if (typeof hrv === 'number' && hrv > 0) {
                        hrvSum += hrv;
                        hrvCount++;
                    }
                }

                if (hrvCount > 0) {
                    const avgHrv = Math.round(hrvSum / hrvCount);
                    const readiness = Math.min(100, Math.max(40, Math.round((avgHrv / 65) * 85)));
                    return { HRV: avgHrv, Readiness: readiness };
                }
            }
        } catch (e) {
            console.error("Local payload parse error:", e);
        }
        return {};
    }
}
