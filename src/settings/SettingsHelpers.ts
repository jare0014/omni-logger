import * as obsidian from "obsidian";

export async function requestWithTimeout(params: any, timeoutMs: number = 2500): Promise<any> {
    return Promise.race([
        obsidian.requestUrl(params),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
    ]);
}

export function createStatusBadge(parentEl: HTMLElement): HTMLSpanElement {
    const badge = parentEl.createEl('span');
    badge.style.display = 'inline-block';
    badge.style.width = '10px';
    badge.style.height = '10px';
    badge.style.borderRadius = '50%';
    badge.style.marginLeft = '8px';
    badge.style.verticalAlign = 'middle';
    badge.style.backgroundColor = '#8e8e93';
    badge.setAttribute('title', 'Checking...');
    return badge;
}

export function updateBadge(badge: HTMLElement, ok: boolean, tooltip: string): void {
    badge.style.backgroundColor = ok ? '#30d158' : '#ff453a';
    badge.setAttribute('title', tooltip);
}
