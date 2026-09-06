import { requestUrl, RequestUrlParam } from "obsidian";

export async function requestWithTimeout(options: RequestUrlParam, timeoutMs: number = 15000): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await requestUrl(options);
        clearTimeout(timer);
        return response;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}
