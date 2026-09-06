import { App, Notice } from "obsidian";
import { exec } from "child_process";
import { OmniPluginSettings } from "../models/OmniSettings";

export class GitLoggerService {
    private app: App;
    private settings: OmniPluginSettings;

    constructor(app: App, settings: OmniPluginSettings) {
        this.app = app;
        this.settings = settings;
    }

    public async logGitHistory(): Promise<void> {
        const paths = (this.settings.gitRepoPaths || "")
            .split("\n")
            .map(p => p.trim())
            .filter(p => p.length > 0);

        if (paths.length === 0) {
            new Notice("No Git repository paths configured in Omni-Logger settings.");
            return;
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        let aggregatedCommits: string[] = [];

        for (const repoPath of paths) {
            try {
                const commits = await this.runGitLog(repoPath, todayStr, this.settings.gitAuthor);
                if (commits.length > 0) {
                    aggregatedCommits.push(`**${repoPath.split(/[\\/]/).pop()}**:`);
                    aggregatedCommits.push(...commits);
                }
            } catch (e) {
                console.error(`Git log error for ${repoPath}:`, e);
            }
        }

        const files = this.app.vault.getMarkdownFiles();
        const dailyFile = files.find(f => f.basename === todayStr || f.name === `${todayStr}.md`);

        if (!dailyFile) {
            new Notice(`Daily note for ${todayStr} not found.`);
            return;
        }

        try {
            const content = await this.app.vault.read(dailyFile);
            const startMarker = "<!--START_Antigravity_Git_Log-->";
            const endMarker = "<!--END_Antigravity_Git_Log-->";

            let gitSection = "";
            if (aggregatedCommits.length > 0) {
                gitSection = `${startMarker}\n### 🐙 Git Activity (${todayStr})\n${aggregatedCommits.join('\n')}\n${endMarker}`;
            } else {
                gitSection = `${startMarker}\n### 🐙 Git Activity (${todayStr})\n*No commits logged for today.*\n${endMarker}`;
            }

            let newContent = "";
            if (content.includes(startMarker) && content.includes(endMarker)) {
                const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'm');
                newContent = content.replace(regex, gitSection);
            } else {
                newContent = content + "\n\n" + gitSection;
            }

            await this.app.vault.modify(dailyFile, newContent);
            new Notice(`Logged git activity for ${todayStr}! 🐙`);
        } catch (e) {
            console.error("Failed to append git activity to daily note:", e);
        }
    }

    private runGitLog(repoPath: string, dateStr: string, authorFilter?: string): Promise<string[]> {
        return new Promise((resolve) => {
            const authorCmd = authorFilter ? `--author="${authorFilter}"` : "";
            const cmd = `git -C "${repoPath}" log --since="${dateStr} 00:00:00" --until="${dateStr} 23:59:59" ${authorCmd} --pretty=format:"- %h: %s (%cr)"`;

            exec(cmd, (err, stdout) => {
                if (err || !stdout.trim()) {
                    resolve([]);
                } else {
                    resolve(stdout.trim().split(/\r?\n/));
                }
            });
        });
    }
}
