import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../../main";

export class CustomMetricsSettingsSection {
    constructor(
        private app: obsidian.App,
        private plugin: OmniLoggerPlugin,
        private containerEl: HTMLElement,
        private onReloadCards: () => void
    ) {}

    render(): void {
        const { containerEl } = this;

        // =====================================================================
        // AI Custom Calculated Metric Builder
        // =====================================================================
        containerEl.createEl('h3', { text: '🤖 AI Custom Calculated Metric Builder' });
        containerEl.createEl('p', { 
            text: 'Select one or more input metric keys, define a new calculation in plain English, and the AI will modularly append this calculation rule into your local-parser.js file.',
            cls: 'setting-item-description'
        });

        const builderBox = containerEl.createDiv();
        builderBox.style.border = '1px solid var(--background-modifier-border)';
        builderBox.style.borderRadius = '8px';
        builderBox.style.padding = '15px';
        builderBox.style.marginBottom = '25px';
        builderBox.style.backgroundColor = 'var(--background-primary-alt)';

        builderBox.createEl('h4', { text: '1. Select Input Keys:', style: 'margin-top: 0;' });
        const keysScroll = builderBox.createDiv();
        keysScroll.style.maxHeight = '120px';
        keysScroll.style.overflowY = 'auto';
        keysScroll.style.border = '1px solid var(--background-modifier-border)';
        keysScroll.style.borderRadius = '4px';
        keysScroll.style.padding = '8px';
        keysScroll.style.marginBottom = '15px';
        keysScroll.style.backgroundColor = 'var(--background-primary)';
        keysScroll.style.display = 'grid';
        keysScroll.style.gridTemplateColumns = 'repeat(auto-fill, minmax(160px, 1fr))';
        keysScroll.style.gap = '8px';

        const selectedKeys = new Set<string>();
        const renderInputKeysCheckboxes = async () => {
            keysScroll.empty();
            const keys = await (this.plugin as any).getAvailableKeys();
            keys.forEach((k: string) => {
                const label = keysScroll.createEl('label');
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.gap = '6px';
                label.style.cursor = 'pointer';
                
                const checkbox = label.createEl('input', { type: 'checkbox' });
                checkbox.checked = selectedKeys.has(k);
                checkbox.onchange = () => {
                    if (checkbox.checked) selectedKeys.add(k);
                    else selectedKeys.delete(k);
                };
                label.appendText(k);
            });
            if (keys.length === 0) {
                keysScroll.createSpan({ text: 'No available keys found.', style: 'color: var(--text-muted)' });
            }
        };
        
        renderInputKeysCheckboxes();

        builderBox.createEl('h4', { text: '2. Describe Calculation Logic:' });
        const calcPrompt = builderBox.createEl('textarea');
        calcPrompt.style.width = '100%';
        calcPrompt.style.height = '60px';
        calcPrompt.placeholder = 'e.g. calculate the ratio of HRV to Sleep_hours';
        calcPrompt.style.marginBottom = '15px';

        builderBox.createEl('h4', { text: '3. New Metric Details:' });
        
        const detailsGrid = builderBox.createDiv();
        detailsGrid.style.display = 'grid';
        detailsGrid.style.gridTemplateColumns = '1fr 1fr';
        detailsGrid.style.gap = '10px';
        detailsGrid.style.marginBottom = '15px';
        
        const keyDiv = detailsGrid.createDiv();
        keyDiv.createSpan({ text: 'Key (no spaces, e.g. hrv_sleep_ratio):', style: 'font-size: 0.85em; display:block; margin-bottom: 4px;' });
        const keyField = keyDiv.createEl('input', { type: 'text', placeholder: 'hrv_sleep_ratio' });
        keyField.style.width = '100%';
        
        const labelDiv = detailsGrid.createDiv();
        labelDiv.createSpan({ text: 'Label (Display Title):', style: 'font-size: 0.85em; display:block; margin-bottom: 4px;' });
        const labelField = labelDiv.createEl('input', { type: 'text', placeholder: 'HRV/Sleep Ratio' });
        labelField.style.width = '100%';

        const unitDiv = detailsGrid.createDiv();
        unitDiv.createSpan({ text: 'Unit (e.g. ratio, mg):', style: 'font-size: 0.85em; display:block; margin-bottom: 4px;' });
        const unitField = unitDiv.createEl('input', { type: 'text', placeholder: 'ratio' });
        unitField.style.width = '100%';

        const aggDiv = detailsGrid.createDiv();
        aggDiv.createSpan({ text: 'Aggregation:', style: 'font-size: 0.85em; display:block; margin-bottom: 4px;' });
        const aggSelect = aggDiv.createEl('select');
        aggSelect.style.width = '100%';
        [['average', 'Average'], ['sum', 'Sum'], ['diff', 'Diff']].forEach(([v, l]) => aggSelect.createEl('option', { value: v, text: l }));

        const chartDiv = detailsGrid.createDiv();
        chartDiv.createSpan({ text: 'Chart Type:', style: 'font-size: 0.85em; display:block; margin-bottom: 4px;' });
        const chartSelect = chartDiv.createEl('select');
        chartSelect.style.width = '100%';
        [['line', 'Line Chart'], ['bar', 'Bar Chart'], ['none', 'No Chart']].forEach(([v, l]) => chartSelect.createEl('option', { value: v, text: l }));

        const groupDiv = detailsGrid.createDiv();
        groupDiv.createSpan({ text: 'Chart Group (e.g. Cognitive, Health):', style: 'font-size: 0.85em; display:block; margin-bottom: 4px;' });
        const groupField = groupDiv.createEl('input', { type: 'text', placeholder: 'Health' });
        groupField.style.width = '100%';

        const colorDiv = detailsGrid.createDiv();
        colorDiv.createSpan({ text: 'Line/Bar Color:', style: 'font-size: 0.85em; display:block; margin-bottom: 4px;' });
        const colorField = colorDiv.createEl('input', { type: 'color', value: '#6366f1' });
        colorField.style.width = '100%';

        const actionRow = builderBox.createDiv();
        actionRow.style.display = 'flex';
        actionRow.style.justifyContent = 'flex-end';
        
        const buildBtn = actionRow.createEl('button', { text: '🤖 Compile & Add Calculated Metric', cls: 'mod-cta' });
        buildBtn.onclick = async () => {
            const promptText = calcPrompt.value.trim();
            const newKey = keyField.value.trim();
            const newLabel = labelField.value.trim();
            
            if (!newKey || !newLabel || !promptText) {
                new obsidian.Notice("Please enter a Key, Label, and Calculation logic description!");
                return;
            }
            if (newKey.includes(' ')) {
                new obsidian.Notice("Key name cannot contain spaces. Use underscores!");
                return;
            }

            buildBtn.disabled = true;
            buildBtn.setText("Compiling...");
            new obsidian.Notice("Sending request to LLM (this may take a few seconds)...");

            try {
                const provider = this.plugin.settings.templateProvider || 'gemini';
                const model = this.plugin.settings.templateModel || '';

                const fs = require('fs');
                const path = require('path');
                const basePath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : '';
                const localParserPath = path.join(basePath, '.obsidian', 'plugins', 'omni-logger', 'local-parser.js');

                const currentParserContent = fs.existsSync(localParserPath) 
                    ? fs.readFileSync(localParserPath, 'utf8')
                    : `module.exports = { extraCards: [], parseMetrics: function(frontmatter, inlineData, parsedRow, state, getVal) {} };`;

                const inputKeysArr = Array.from(selectedKeys);

                const systemPrompt = `You are an expert Javascript programmer specializing in writing parsing and calculation logic for daily biometrics/logs.
Your task is to modularly update a local-parser.js file to add a new calculated metric.

The local-parser.js file has this structure:
\`\`\`javascript
module.exports = {
    extraCards: [
        // array of card configs
    ],
    parseMetrics: function(frontmatter, inlineData, parsedRow, state, getVal, content) {
        // calculation logic
    }
};
\`\`\`

You must update the code to:
1. Merge a new card configuration into \`extraCards\`:
{
    "key": "${newKey}",
    "label": "${newLabel}",
    "unit": "${unitField.value.trim()}",
    "agg": "${aggSelect.value}",
    "chartType": "${chartSelect.value}",
    "color": "${colorField.value}",
    "chartGroup": "${groupField.value.trim()}"
}
If a card with this key already exists in \`extraCards\`, update/overwrite its configuration.

2. Add the calculation logic for the key "${newKey}" inside the \`parseMetrics\` function.
The calculation logic should use the following input keys: ${inputKeysArr.join(', ')}.
The natural language rule is: "${promptText}".
Make sure to extract these inputs safely using \`getVal('KeyName')\`.
Make sure to parse these input values to float safely (e.g. check for undefined, empty string, or non-numeric values).
Assign the calculated result to \`parsedRow['${newKey}']\`.
If the calculation requires comparison with previous days, use properties on the \`state\` object (which is passed in and preserved across calls, e.g. \`state.prevVal\`).
Preserve ALL existing calculations and cards in the file. Only add or update the logic for this new key "${newKey}".

Return ONLY valid, executable Javascript code wrapped inside a markdown \`\`\`javascript ... \`\`\` code block. Do not include any HTML, explanations, or text outside the code block.`;

                const userPrompt = `Here is the current local-parser.js code:
\`\`\`javascript
${currentParserContent}
\`\`\`

Please update this code to add the new calculated metric "${newKey}" based on the natural language rule: "${promptText}".`;

                const response = await (this.plugin as any).callLLM(
                    provider,
                    model,
                    systemPrompt,
                    userPrompt
                );

                let code = response.trim();
                const match = code.match(/```javascript([\s\S]*?)```/) || code.match(/```js([\s\S]*?)```/);
                if (match) {
                    code = match[1].trim();
                }

                fs.writeFileSync(localParserPath, code, 'utf8');
                new obsidian.Notice(`Successfully compiled and added "${newLabel}" to local-parser.js!`);
                
                // Clear fields
                calcPrompt.value = '';
                keyField.value = '';
                labelField.value = '';
                unitField.value = '';
                groupField.value = '';
                selectedKeys.clear();
                
                // Re-render components
                await renderInputKeysCheckboxes();
                this.onReloadCards();
            } catch (e: any) {
                console.error(e);
                new obsidian.Notice('AI Compilation failed: ' + e.message);
            } finally {
                buildBtn.disabled = false;
                buildBtn.setText("🤖 Compile & Add Calculated Metric");
            }
        };
    }
}
