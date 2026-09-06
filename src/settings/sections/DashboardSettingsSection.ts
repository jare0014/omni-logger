import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../../main";
import { ManageKeysModal } from "../../views/modals/ManageKeysModal";

export class DashboardSettingsSection {
    constructor(
        private app: obsidian.App,
        private plugin: OmniLoggerPlugin,
        private containerEl: HTMLElement
    ) {}

    render(): void {
        const { containerEl } = this;

        // =====================================================================
        // 5. 📊 CONFIGURABLE DASHBOARD SETTINGS
        // =====================================================================
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '📊 Dashboard Settings' });

        new obsidian.Setting(containerEl)
            .setName('Date Range (Days)')
            .setDesc('Number of past days to query and display on the dashboard.')
            .addText(text => text
                .setPlaceholder('14')
                .setValue(String(this.plugin.settings.dashboardDateRange || 14))
                .onChange(async (value) => {
                    const parsed = parseInt(value, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                        this.plugin.settings.dashboardDateRange = parsed;
                        await this.plugin.saveSettings();
                    }
                }));

        new obsidian.Setting(containerEl)
            .setName('Exclude Weekends')
            .setDesc('Toggle whether Saturday and Sunday are excluded from calculated baseline averages.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dashboardExcludeWeekends !== false)
                .onChange(async (value) => {
                    this.plugin.settings.dashboardExcludeWeekends = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h4', { text: 'Metrics & Cards Display Config' });
        const cardsContainer = containerEl.createDiv();
        cardsContainer.style.border = '1px solid var(--background-modifier-border)';
        cardsContainer.style.borderRadius = '8px';
        cardsContainer.style.padding = '15px';
        cardsContainer.style.marginBottom = '20px';
        cardsContainer.style.backgroundColor = 'var(--background-primary-alt)';

        const renderDashboardCardsList = () => {
            cardsContainer.empty();
            
            let localParser: any = null;
            try {
                const fs = require('fs');
                const path = require('path');
                const basePath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : '';
                const localParserPath = path.join(basePath, '.obsidian', 'plugins', 'omni-logger', 'local-parser.js');
                if (fs.existsSync(localParserPath)) {
                    const localContent = fs.readFileSync(localParserPath, 'utf8');
                    const moduleObj = { exports: {} };
                    const fn = new Function('module', 'exports', 'require', localContent);
                    fn(moduleObj, moduleObj.exports, require);
                    localParser = moduleObj.exports;
                }
            } catch (e) {
                console.error("Settings Tab: Failed to load local parser:", e);
            }
            
            const cards: any[] = (localParser && Array.isArray(localParser.extraCards)) ? localParser.extraCards : [];

            if (cards.length === 0) {
                const emptyMsg = cardsContainer.createDiv({ text: 'No dashboard cards configured. Create one below!' });
                emptyMsg.style.color = 'var(--text-muted)';
                emptyMsg.style.marginBottom = '15px';
            } else {
                cards.forEach((card, index) => {
                    const cardRow = cardsContainer.createDiv();
                    cardRow.style.display = 'flex';
                    cardRow.style.gap = '8px';
                    cardRow.style.alignItems = 'center';
                    cardRow.style.marginBottom = '10px';
                    cardRow.style.paddingBottom = '10px';
                    cardRow.style.borderBottom = '1px solid var(--background-modifier-border)';

                    const labelInput = cardRow.createEl('input', { type: 'text', value: card.label });
                    labelInput.style.flex = '2';
                    labelInput.style.minWidth = '100px';
                    labelInput.setAttribute('placeholder', 'Label');
                    labelInput.onchange = async () => {
                        card.label = labelInput.value;
                        await (this.plugin as any).saveLocalParserCards(cards);
                    };

                    const keyInput = cardRow.createEl('input', { type: 'text', value: card.key });
                    keyInput.style.flex = '2';
                    keyInput.style.minWidth = '100px';
                    keyInput.setAttribute('placeholder', 'Frontmatter Key');
                    keyInput.onchange = async () => {
                        card.key = keyInput.value;
                        await (this.plugin as any).saveLocalParserCards(cards);
                    };

                    const unitInput = cardRow.createEl('input', { type: 'text', value: card.unit || '' });
                    unitInput.style.flex = '1';
                    unitInput.style.width = '60px';
                    unitInput.setAttribute('placeholder', 'Unit');
                    unitInput.onchange = async () => {
                        card.unit = unitInput.value;
                        await (this.plugin as any).saveLocalParserCards(cards);
                    };

                    const aggSelect = cardRow.createEl('select');
                    [['average', 'Average'], ['sum', 'Sum'], ['diff', 'Diff']].forEach(([v, l]) => {
                        const opt = aggSelect.createEl('option', { value: v, text: l });
                        if (card.agg === v) opt.selected = true;
                    });
                    aggSelect.onchange = async () => {
                        card.agg = aggSelect.value;
                        await (this.plugin as any).saveLocalParserCards(cards);
                    };

                    const chartSelect = cardRow.createEl('select');
                    [['line', 'Line Chart'], ['bar', 'Bar Chart'], ['none', 'No Chart']].forEach(([v, l]) => {
                        const opt = chartSelect.createEl('option', { value: v, text: l });
                        if (card.chartType === v) opt.selected = true;
                    });
                    chartSelect.onchange = async () => {
                        card.chartType = chartSelect.value;
                        await (this.plugin as any).saveLocalParserCards(cards);
                    };

                    const groupInput = cardRow.createEl('input', { type: 'text', value: card.chartGroup || '' });
                    groupInput.style.flex = '1.5';
                    groupInput.style.minWidth = '80px';
                    groupInput.setAttribute('placeholder', 'Chart Group');
                    groupInput.onchange = async () => {
                        card.chartGroup = groupInput.value.trim();
                        await (this.plugin as any).saveLocalParserCards(cards);
                    };

                    const tileLabel = cardRow.createEl('label');
                    tileLabel.style.display = 'flex';
                    tileLabel.style.alignItems = 'center';
                    tileLabel.style.gap = '4px';
                    tileLabel.style.fontSize = '0.85em';
                    tileLabel.style.whiteSpace = 'nowrap';
                    
                    const tileCheckbox = tileLabel.createEl('input', { type: 'checkbox' });
                    tileCheckbox.checked = card.showTile !== false;
                    tileLabel.appendText('Tile');
                    
                    tileCheckbox.onchange = async () => {
                        card.showTile = tileCheckbox.checked;
                        await (this.plugin as any).saveLocalParserCards(cards);
                    };

                    const wkndLabel = cardRow.createEl('label');
                    wkndLabel.style.display = 'flex';
                    wkndLabel.style.alignItems = 'center';
                    wkndLabel.style.gap = '4px';
                    wkndLabel.style.fontSize = '0.85em';
                    wkndLabel.style.whiteSpace = 'nowrap';
                    
                    const wkndCheckbox = wkndLabel.createEl('input', { type: 'checkbox' });
                    wkndCheckbox.checked = card.excludeWeekends === true;
                    wkndLabel.appendText('Excl Wknd');
                    
                    wkndCheckbox.onchange = async () => {
                        card.excludeWeekends = wkndCheckbox.checked;
                        await (this.plugin as any).saveLocalParserCards(cards);
                    };

                    const colorInput = cardRow.createEl('input', { type: 'color', value: card.color || '#6366f1' });
                    colorInput.style.width = '40px';
                    colorInput.onchange = async () => {
                        card.color = colorInput.value;
                        await (this.plugin as any).saveLocalParserCards(cards);
                    };

                    const btnContainer = cardRow.createDiv();
                    btnContainer.style.display = 'flex';
                    btnContainer.style.gap = '4px';

                    const upBtn = btnContainer.createEl('button', { text: '▲' });
                    upBtn.disabled = index === 0;
                    upBtn.onclick = async () => {
                        const temp = cards[index - 1];
                        cards[index - 1] = card;
                        cards[index] = temp;
                        await (this.plugin as any).saveLocalParserCards(cards);
                        renderDashboardCardsList();
                    };

                    const downBtn = btnContainer.createEl('button', { text: '▼' });
                    downBtn.disabled = index === cards.length - 1;
                    downBtn.onclick = async () => {
                        const temp = cards[index + 1];
                        cards[index + 1] = card;
                        cards[index] = temp;
                        await (this.plugin as any).saveLocalParserCards(cards);
                        renderDashboardCardsList();
                    };

                    const delBtn = btnContainer.createEl('button', { text: '🗑' });
                    delBtn.style.color = 'var(--text-error)';
                    delBtn.onclick = async () => {
                        cards.splice(index, 1);
                        await (this.plugin as any).saveLocalParserCards(cards);
                        renderDashboardCardsList();
                    };
                });
            }

            const addMetricContainer = cardsContainer.createDiv();
            addMetricContainer.style.marginTop = '15px';
            addMetricContainer.style.paddingTop = '15px';
            addMetricContainer.style.borderTop = '2px dashed var(--background-modifier-border)';

            let isAdding = false;

            const renderAddMetricControls = async () => {
                addMetricContainer.empty();
                if (!isAdding) {
                    const btnRow = addMetricContainer.createDiv();
                    btnRow.style.display = 'flex';
                    btnRow.style.justifyContent = 'space-between';
                    btnRow.style.alignItems = 'center';

                    const addBtn = btnRow.createEl('button', { text: '＋ Add Metric', cls: 'mod-cta' });
                    addBtn.onclick = async () => {
                        isAdding = true;
                        await renderAddMetricControls();
                    };

                    const manageBtn = btnRow.createEl('button', { text: '⚙️ Manage Available Keys Pool' });
                    manageBtn.onclick = () => {
                        new ManageKeysModal(this.app, this.plugin, async () => {
                            await renderAddMetricControls();
                            renderDashboardCardsList();
                        }).open();
                    };
                } else {
                    const addFormRow = addMetricContainer.createDiv();
                    addFormRow.style.display = 'flex';
                    addFormRow.style.gap = '8px';
                    addFormRow.style.alignItems = 'center';

                    const availableKeys = await (this.plugin as any).getAvailableKeys();
                    
                    if (availableKeys.length === 0) {
                        addFormRow.createSpan({ text: 'No available keys found. Add some in daily notes or settings first!' });
                    } else {
                        addFormRow.createSpan({ text: 'Select Key:' });
                        const keySelect = addFormRow.createEl('select');
                        availableKeys.forEach((k: string) => {
                            keySelect.createEl('option', { value: k, text: k });
                        });

                        const confirmBtn = addFormRow.createEl('button', { text: 'Add', cls: 'mod-cta' });
                        confirmBtn.onclick = async () => {
                            const selectedKey = keySelect.value;
                            if (selectedKey) {
                                const defaultLabel = selectedKey
                                    .replace(/_/g, ' ')
                                    .replace(/\b\w/g, (c: string) => c.toUpperCase());
                                
                                let defaultUnit = '';
                                let defaultAgg = 'average';
                                let defaultChart = 'line';
                                let defaultGroup = '';
                                let defaultColor = '#6366f1';
                                
                                if (selectedKey === 'git_commits') {
                                    defaultUnit = 'commits';
                                    defaultAgg = 'sum';
                                    defaultChart = 'bar';
                                    defaultGroup = 'Productivity';
                                    defaultColor = '#10b981';
                                } else if (selectedKey === 'Sleep_hours') {
                                    defaultUnit = 'hrs';
                                    defaultGroup = 'Health';
                                    defaultColor = '#10b981';
                                } else if (selectedKey === 'Sleep_score') {
                                    defaultGroup = 'Health';
                                    defaultColor = '#6366f1';
                                } else if (selectedKey === 'Readiness') {
                                    defaultGroup = 'Health';
                                    defaultColor = '#ec4899';
                                } else if (selectedKey === 'HRV') {
                                    defaultUnit = 'ms';
                                    defaultGroup = 'Health';
                                    defaultColor = '#f59e0b';
                                }

                                cards.push({
                                    key: selectedKey,
                                    label: defaultLabel,
                                    unit: defaultUnit,
                                    agg: defaultAgg,
                                    chartType: defaultChart,
                                    color: defaultColor,
                                    chartGroup: defaultGroup,
                                    showTile: true
                                });
                                await (this.plugin as any).saveLocalParserCards(cards);
                                isAdding = false;
                                renderDashboardCardsList();
                            }
                        };
                    }

                    const cancelBtn = addFormRow.createEl('button', { text: 'Cancel' });
                    cancelBtn.onclick = async () => {
                        isAdding = false;
                        await renderAddMetricControls();
                    };
                }
            };

            renderAddMetricControls();
        };

        renderDashboardCardsList();
    }
}
