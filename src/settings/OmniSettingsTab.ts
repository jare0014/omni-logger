import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../main";
import { AiProviderSettingsSection } from "./sections/AiProviderSettingsSection";
import { SourcesSettingsSection } from "./sections/SourcesSettingsSection";
import { TemplatesSettingsSection } from "./sections/TemplatesSettingsSection";
import { DashboardSettingsSection } from "./sections/DashboardSettingsSection";
import { CustomMetricsSettingsSection } from "./sections/CustomMetricsSettingsSection";

export class OmniLoggerSettingTab extends obsidian.PluginSettingTab {
    plugin: OmniLoggerPlugin;

    constructor(app: obsidian.App, plugin: OmniLoggerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Omni-Logger Settings' });

        const onFullRefresh = () => this.display();

        // 1. AI Provider & Execution Settings (< 350 lines)
        new AiProviderSettingsSection(this.plugin, containerEl, onFullRefresh).render();

        // 2. Data Sources & Connections (< 450 lines)
        new SourcesSettingsSection(this.app, this.plugin, containerEl, onFullRefresh).render();

        // 3. Log Templates Registry (< 500 lines)
        new TemplatesSettingsSection(this.app, this.plugin, containerEl, onFullRefresh).render();

        // 4. Configurable Dashboard Metrics & Cards (< 350 lines)
        const dashboardSection = new DashboardSettingsSection(this.app, this.plugin, containerEl);
        dashboardSection.render();

        // 5. AI Custom Calculated Metric Builder (< 250 lines)
        new CustomMetricsSettingsSection(this.app, this.plugin, containerEl, () => {
            dashboardSection.render();
        }).render();
    }
}
