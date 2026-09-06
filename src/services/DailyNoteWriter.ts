import { App, TFile, Notice } from "obsidian";
import { OmniPluginSettings } from "../models/OmniSettings";

export class DailyNoteWriter {
    private app: App;
    private settings: OmniPluginSettings;

    constructor(app: App, settings: OmniPluginSettings) {
        this.app = app;
        this.settings = settings;
    }

    public getDailyNoteFile(): TFile | null {
        const moment = (window as any).moment;
        const todayStr = moment ? moment().format('YYYY-MM-DD') : new Date().toISOString().split('T')[0];
        const files = this.app.vault.getMarkdownFiles();
        
        let file = files.find(f => f.basename === todayStr && f.path.includes('02_Journal'));
        if (file) return file;
        
        file = files.find(f => f.basename === todayStr);
        if (file) return file;
        
        return files.find(f => f.name === `${todayStr}.md`) || null;
    }

    public async writeDataToDailyNote(dateStr: string, data: Record<string, any>, destination: 'frontmatter' | 'heading' | 'file' = 'frontmatter'): Promise<boolean> {
        const file = this.findDailyNoteFile(dateStr);
        if (!file) {
            new Notice(`Daily note for ${dateStr} not found.`);
            return false;
        }

        try {
            if (destination === 'frontmatter') {
                await this.app.fileManager.processFrontMatter(file, (fm) => {
                    for (const [k, v] of Object.entries(data)) {
                        if (v !== undefined && v !== null && v !== "") {
                            fm[k] = v;
                        }
                    }
                });
                new Notice(`Updated ${file.basename} frontmatter! 📝`);
                return true;
            }
        } catch (e) {
            console.error("Failed to write to daily note:", e);
        }
        return false;
    }

    public async writeCustomTemplateData(data: Record<string, any>, customTemplate: { destination?: string }): Promise<void> {
        const dailyFile = this.getDailyNoteFile();
        if (!dailyFile) {
            throw new Error("Daily note not found!");
        }
        
        let content = await this.app.vault.read(dailyFile);
        
        if (customTemplate.destination === 'frontmatter') {
            content = this.updateFrontmatterProperties(content, data);
        } else if (customTemplate.destination === 'dataview') {
            content = this.updateInlineFieldsInContent(content, data);
        } else if (customTemplate.destination === 'append-log') {
            content = this.appendLogFieldsInContent(content, data);
        }
        
        await this.app.vault.modify(dailyFile, content);
    }

    public updateInlineFieldsInContent(content: string, data: Record<string, any>): string {
        const lines = content.split(/\r?\n/);
        const keys = Object.keys(data);
        const updatedKeys = new Set<string>();
        
        for (let i = 0; i < lines.length; i++) {
            const lineTrim = lines[i].trim();
            const cleanLine = lineTrim.replace(/^[-*+]\s+(?:\[[ xX]\]\s+)?/, '').trim();
            for (const key of keys) {
                if (cleanLine.startsWith(`${key}::`) || lineTrim.startsWith(`${key}::`)) {
                    let val = data[key];
                    if (typeof val === 'object') val = JSON.stringify(val);
                    const bulletMatch = lineTrim.match(/^([-*+]\s+(?:\[[ xX]\]\s+)?)/);
                    const prefix = bulletMatch ? bulletMatch[1] : '';
                    lines[i] = `${prefix}${key}:: ${val}`;
                    updatedKeys.add(key);
                }
            }
        }
        
        const missingKeys = keys.filter(k => !updatedKeys.has(k));
        if (missingKeys.length > 0) {
            let logHeaderIndex = lines.findIndex(l => l.includes('### Work Logs'));
            if (logHeaderIndex === -1) {
                logHeaderIndex = lines.findIndex(l => l.includes('## 🪵 Log') || l.includes('## 🪵 Logs'));
            }
            const insertLines: string[] = [];
            for (const k of missingKeys) {
                let val = data[k];
                if (typeof val === 'object') val = JSON.stringify(val);
                insertLines.push(`${k}:: ${val}`);
            }
            
            if (logHeaderIndex !== -1) {
                lines.splice(logHeaderIndex + 1, 0, "", ...insertLines);
            } else {
                lines.push("", "### Work Logs", ...insertLines);
            }
        }
        
        return lines.join('\n');
    }

    public appendLogFieldsInContent(content: string, data: Record<string, any>): string {
        const lines = content.split(/\r?\n/);
        const keys = Object.keys(data);
        
        const insertLines: string[] = [];
        for (const k of keys) {
            let val = data[k];
            if (typeof val === 'object') val = JSON.stringify(val);
            insertLines.push(`- ${k}: ${val}`);
        }
        
        let logHeaderIndex = lines.findIndex(l => l.includes('## 🪵 Log'));
        if (logHeaderIndex !== -1) {
            lines.splice(logHeaderIndex + 1, 0, ...insertLines);
        } else {
            lines.push("", "## 🪵 Log", ...insertLines);
        }
        
        return lines.join('\n');
    }

    public updateCallsInContent(content: string, calls_dict: Record<string, any>): string {
        const keys = ["calls-08am", "calls-09am", "calls-10am", "calls-11am", "calls-12pm", "calls-01pm", "calls-02pm", "calls-03pm", "calls-04pm"];
        const lines = content.split(/\r?\n/);
        let updated = false;
        
        for (let i = 0; i < lines.length; i++) {
            const lineTrim = lines[i].trim();
            const cleanLine = lineTrim.replace(/^[-*+]\s+(?:\[[ xX]\]\s+)?/, '').trim();
            for (const k of keys) {
                if (cleanLine.startsWith(`${k}::`) || lineTrim.startsWith(`${k}::`)) {
                    const val = calls_dict[k] !== undefined ? calls_dict[k] : 0;
                    const bulletMatch = lineTrim.match(/^([-*+]\s+(?:\[[ xX]\]\s+)?)/);
                    const prefix = bulletMatch ? bulletMatch[1] : '';
                    lines[i] = `${prefix}${k}:: ${val}`;
                    updated = true;
                }
            }
        }
        
        if (updated) {
            return lines.join('\n');
        }
        
        let logHeaderIndex = lines.findIndex(l => l.includes('## 🪵 Log'));
        if (logHeaderIndex !== -1) {
            const insertLines: string[] = [""];
            for (const k of keys) {
                const val = calls_dict[k] !== undefined ? calls_dict[k] : 0;
                insertLines.push(`${k}:: ${val}`);
            }
            lines.splice(logHeaderIndex + 1, 0, ...insertLines);
            return lines.join('\n');
        }
        
        const insertLines: string[] = [""];
        for (const k of keys) {
            const val = calls_dict[k] !== undefined ? calls_dict[k] : 0;
            insertLines.push(`${k}:: ${val}`);
        }
        return content.trim() + "\n" + insertLines.join('\n') + "\n";
    }

    public updateLumosityInContent(content: string, startTime: string, scores: Array<{ game: string; category: string; score: any }>): string {
        const lines = content.split(/\r?\n/);
        const startFm = lines.indexOf('---');
        if (startFm !== 0) return content;
        const endFm = lines.indexOf('---', 1);
        if (endFm === -1) return content;
        
        const fmText = lines.slice(startFm + 1, endFm);
        const newFm: string[] = [];
        let inScoresBlock = false;
        let keysUpdated = new Set<string>();
        
        for (let i = 0; i < fmText.length; i++) {
            const line = fmText[i];
            if (inScoresBlock && line.trim() && !line.startsWith(' ') && !line.startsWith('-')) {
                inScoresBlock = false;
            }
            
            if (line.includes(':') && !line.startsWith(' ')) {
                const key = line.split(':')[0].trim();
                if (key === 'Lumosity Start Time') {
                    newFm.push(`Lumosity Start Time: "${startTime}"`);
                    keysUpdated.add(key);
                } else if (key === 'scores') {
                    newFm.push('scores:');
                    for (const item of scores) {
                        newFm.push(`  - game: ${item.game}`);
                        newFm.push(`    category: ${item.category}`);
                        newFm.push(`    score: ${item.score}`);
                    }
                    inScoresBlock = true;
                    keysUpdated.add(key);
                } else {
                    newFm.push(line);
                }
            } else if (inScoresBlock) {
                continue;
            } else {
                newFm.push(line);
            }
        }
        
        if (!keysUpdated.has('Lumosity Start Time')) {
            newFm.push(`Lumosity Start Time: "${startTime}"`);
        }
        if (!keysUpdated.has('scores')) {
            newFm.push('scores:');
            for (const item of scores) {
                newFm.push(`  - game: ${item.game}`);
                newFm.push(`    category: ${item.category}`);
                newFm.push(`    score: ${item.score}`);
            }
        }
        
        const newLines = ['---', ...newFm, '---', ...lines.slice(endFm + 1)];
        return newLines.join('\n');
    }

    public updateFrontmatterProperties(content: string, updates: Record<string, any>): string {
        const lines = content.split(/\r?\n/);
        const startFm = lines.indexOf('---');
        if (startFm !== 0) return content;
        const endFm = lines.indexOf('---', 1);
        if (endFm === -1) return content;
        
        const fmText = lines.slice(startFm + 1, endFm);
        const newFm: string[] = [];
        const keysUpdated = new Set<string>();
        
        for (let i = 0; i < fmText.length; i++) {
            const line = fmText[i];
            if (line.includes(':') && !line.startsWith(' ')) {
                const key = line.split(':')[0].trim();
                if (updates[key] !== undefined) {
                    const val = updates[key];
                    if (val === null || val === "" || val === "-") {
                        newFm.push(`${key}:`);
                    } else {
                        newFm.push(`${key}: "${val}"`);
                    }
                    keysUpdated.add(key);
                } else {
                    newFm.push(line);
                }
            } else {
                newFm.push(line);
            }
        }
        
        for (const [key, val] of Object.entries(updates)) {
            if (!keysUpdated.has(key)) {
                if (val === null || val === "" || val === "-") {
                    newFm.push(`${key}:`);
                } else {
                    newFm.push(`${key}: "${val}"`);
                }
            }
        }
        
        const newLines = ['---', ...newFm, '---', ...lines.slice(endFm + 1)];
        return newLines.join('\n');
    }

    public updateDataviewFields(content: string, updates: Record<string, any>): string {
        let fmPart = "";
        let bodyPart = content;
        const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
            fmPart = fmMatch[0];
            bodyPart = content.substring(fmMatch[0].length);
        }
        
        for (const [key, val] of Object.entries(updates)) {
            const pattern = new RegExp(`^(\\s*(?:[-*+]\\s+(?:\\[[ xX]\\]\\s+)?)?)${this.escapeRegex(key)}::.*$`, 'm');
            const match = bodyPart.match(pattern);
            if (match) {
                const prefix = match[1] || '';
                bodyPart = bodyPart.replace(pattern, `${prefix}${key}:: ${val}`);
            } else {
                bodyPart = bodyPart.trim() + `\n${key}:: ${val}\n`;
            }
        }
        return fmPart + bodyPart;
    }

    public appendToBottomLog(content: string, updates: Record<string, any>): string {
        let bodyPart = content;
        const logEntries: string[] = [];
        for (const [key, val] of Object.entries(updates)) {
            logEntries.push(`- [health_sync] ${key}: ${val}`);
        }
        
        if (logEntries.length > 0) {
            const gitStart = bodyPart.indexOf("<!--START_Antigravity_Git_Log-->");
            const newText = "\n" + logEntries.join("\n") + "\n\n";
            if (gitStart !== -1) {
                bodyPart = bodyPart.substring(0, gitStart) + newText + bodyPart.substring(gitStart);
            } else {
                bodyPart = bodyPart.trim() + "\n" + newText;
            }
        }
        return bodyPart;
    }

    public escapeRegex(string: string): string {
        return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    private findDailyNoteFile(dateStr: string): TFile | null {
        const files = this.app.vault.getMarkdownFiles();
        return files.find(f => f.basename === dateStr || f.name === `${dateStr}.md` || f.path.includes(dateStr)) || null;
    }
}
