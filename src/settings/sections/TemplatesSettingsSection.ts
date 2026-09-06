import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../../main";
import { OmniTemplateCreatorModal } from "../../views/modals/OmniTemplateCreatorModal";

export class TemplatesSettingsSection {
    constructor(
        private app: obsidian.App,
        private plugin: OmniLoggerPlugin,
        private containerEl: HTMLElement,
        private onFullRefresh: () => void
    ) {}

    render(): void {
        const { containerEl } = this;

        // =====================================================================
        // 3. 📋 LOG TEMPLATES & SETTINGS (Bottom)
        // =====================================================================
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: '📋 Log Templates & Settings' });

        // Ingredients Folder
        new obsidian.Setting(containerEl)
            .setName('Ingredients Folder')
            .setDesc('Folder in vault containing template recipes and settings metadata.')
            .addText(text => text
                .setPlaceholder('Omni_Templates')
                .setValue(this.plugin.settings.ingredientsFolder || 'Omni_Templates')
                .onChange(async (value) => {
                    this.plugin.settings.ingredientsFolder = value.trim();
                    await this.plugin.saveSettings();
                }));

        // Render logs templates list
        const customLogsDetails = containerEl.createEl('details');
        customLogsDetails.style.marginBottom = '20px';
        customLogsDetails.style.border = '1px solid var(--background-modifier-border)';
        customLogsDetails.style.borderRadius = '6px';
        customLogsDetails.style.padding = '8px';
        customLogsDetails.setAttribute('open', '');
        const customLogsSummary = customLogsDetails.createEl('summary', { text: '🛠️ Custom Log Templates Registry' });
        customLogsSummary.style.cursor = 'pointer';
        customLogsSummary.style.fontSize = '1.2em';
        customLogsSummary.style.fontWeight = 'bold';
        customLogsSummary.style.color = 'var(--text-accent)';

        const customLogsDetailsContainer = customLogsDetails.createDiv();
        customLogsDetailsContainer.style.paddingTop = '10px';

        const creatorControlsRow = customLogsDetailsContainer.createDiv({ style: 'margin-bottom: 15px;' });
        const createBtn = creatorControlsRow.createEl('button', { text: '+ Create New Template via LLM', cls: 'mod-cta' });
        createBtn.onclick = () => {
            new OmniTemplateCreatorModal(this.app, this.plugin, async () => {
                await this.plugin.loadCustomTemplatesFromVault();
                renderTemplates();
            }).open();
        };

        const templatesContainer = customLogsDetailsContainer.createDiv();
        const renderTemplates = () => {
            templatesContainer.empty();
            const templates = (this.plugin.settings.customTemplates || []).filter(t => 
                !['google-sleep', 'google-hrv', 'google-hydration', 'google-nutrition'].includes(t.id)
            );

            const saveTemplateOnTheFly = async (t: any, destVal: string, styleVal?: string, intervalVal?: number, deviceVal?: string, configVal?: string) => {
                t.destination = destVal;
                if (styleVal !== undefined) t.syncStyle = styleVal;
                if (intervalVal !== undefined) t.syncInterval = intervalVal;
                if (deviceVal !== undefined) t.deviceName = deviceVal;
                
                if (t.mode === 'ble') {
                    try {
                        const parsedConfig = JSON.parse(configVal || '{}');
                        Object.assign(t, parsedConfig);
                    } catch(e) {}
                } else if (configVal !== undefined) {
                    t.prompt = configVal;
                }

                const isBuiltIn = ['google-sleep', 'google-hrv', 'google-hydration', 'google-nutrition'].includes(t.id);
                if (isBuiltIn) {
                    if (t.id === 'calls') (this.plugin.settings as any).omniCallsInstructions = t.prompt;
                    else if (t.id === 'lumosity') (this.plugin.settings as any).omniLumosityInstructions = t.prompt;
                    else if (t.id === 'health') (this.plugin.settings as any).omniHealthInstructions = t.prompt;
                    else if (t.id === 'google-sleep') {
                        (this.plugin.settings as any).googleHealthSleepPrompt = t.prompt;
                        if (!this.plugin.settings.healthSyncConfig) this.plugin.settings.healthSyncConfig = {};
                        if (!this.plugin.settings.healthSyncConfig.sleep) this.plugin.settings.healthSyncConfig.sleep = {} as any;
                        this.plugin.settings.healthSyncConfig.sleep.destination = destVal;
                    }
                    else if (t.id === 'google-hrv') {
                        (this.plugin.settings as any).googleHealthVitalsPrompt = t.prompt;
                        if (!this.plugin.settings.healthSyncConfig) this.plugin.settings.healthSyncConfig = {};
                        if (!this.plugin.settings.healthSyncConfig.hrv) this.plugin.settings.healthSyncConfig.hrv = {} as any;
                        this.plugin.settings.healthSyncConfig.hrv.destination = destVal;
                    }
                    else if (t.id === 'google-hydration') {
                        (this.plugin.settings as any).googleHealthHydrationPrompt = t.prompt;
                        if (!this.plugin.settings.healthSyncConfig) this.plugin.settings.healthSyncConfig = {};
                        if (!this.plugin.settings.healthSyncConfig.hydration) this.plugin.settings.healthSyncConfig.hydration = {} as any;
                        this.plugin.settings.healthSyncConfig.hydration.destination = destVal;
                    }
                    else if (t.id === 'google-nutrition') {
                        (this.plugin.settings as any).googleHealthNutritionPrompt = t.prompt;
                        if (!this.plugin.settings.healthSyncConfig) this.plugin.settings.healthSyncConfig = {};
                        if (!this.plugin.settings.healthSyncConfig.calories) this.plugin.settings.healthSyncConfig.calories = {} as any;
                        this.plugin.settings.healthSyncConfig.calories.destination = destVal;
                    }
                    await this.plugin.saveSettings();
                    return;
                }

                // Save to settings
                await this.plugin.saveSettings();

                // Save to vault file
                const cleanDirName = t.name.replace(/[^a-zA-Z0-9 _-]/g, '');
                const basePath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : '';
                const metadataPath = `${basePath}/${this.plugin.settings.ingredientsFolder}/${cleanDirName}/metadata.json`;
                const fs = require('fs');
                
                try {
                    let m: any = {};
                    if (fs.existsSync(metadataPath)) {
                        m = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                    }
                    m.id = t.id;
                    m.name = t.name;
                    m.mode = t.mode;
                    m.destination = t.destination;
                    m.syncStyle = t.syncStyle;
                    m.syncInterval = t.syncInterval;
                    if (t.mode === 'ble') {
                        m.deviceName = t.deviceName || '';
                        m.metrics = t.metrics || [];
                    } else {
                        m.connectionId = t.connectionId;
                        m.prompt = t.prompt;
                    }
                    const dirPath = `${basePath}/${this.plugin.settings.ingredientsFolder}/${cleanDirName}`;
                    if (!fs.existsSync(dirPath)) {
                        fs.mkdirSync(dirPath, { recursive: true });
                    }
                    fs.writeFileSync(metadataPath, JSON.stringify(m, null, 2), 'utf8');
                    if (t.mode !== 'ble' && t.prompt) {
                        const promptPath = `${dirPath}/system_prompt.txt`;
                        fs.writeFileSync(promptPath, t.prompt, 'utf8');
                    }
                    await this.plugin.updateMetaBindButton(t);
                } catch(e) {
                    console.error("Failed to sync template configuration file on the fly:", e);
                }
            };
            
            if (templates.length === 0) {
                templatesContainer.createEl('p', { text: 'No custom templates found. Click below to generate one!', cls: 'setting-item-description' });
            } else {
                for (let i = 0; i < templates.length; i++) {
                    const t = templates[i];
                    const itemDiv = templatesContainer.createDiv({ cls: 'omni-template-item' });
                    itemDiv.style.border = '1px solid var(--background-modifier-border)';
                    itemDiv.style.padding = '10px';
                    itemDiv.style.marginBottom = '10px';
                    itemDiv.style.borderRadius = '5px';
                    
                    const header = itemDiv.createDiv({ cls: 'omni-template-header' });
                    header.style.display = 'flex';
                    header.style.justifyContent = 'space-between';
                    header.style.alignItems = 'center';
                    header.style.fontWeight = 'bold';
                    
                    const isBuiltIn = ['google-sleep', 'google-hrv', 'google-hydration', 'google-nutrition'].includes(t.id);
                    header.createSpan({ text: `${t.name} (${(t.mode||'').toUpperCase()})` });
                    if (isBuiltIn) {
                        header.createSpan({ 
                            text: 'Built-in', 
                            style: 'font-size:0.75em; background-color:var(--background-modifier-border); color:var(--text-muted); padding:2px 6px; border-radius:4px; margin-left:8px; font-weight:normal;' 
                        });
                    }
                    
                    const controls = header.createDiv();
                    
                    const destSelect = controls.createEl('select');
                    destSelect.style.marginRight = '10px';
                    
                    destSelect.createEl('option', { value: 'frontmatter', text: 'YAML Frontmatter' });
                    destSelect.createEl('option', { value: 'dataview', text: 'Dataview Inline' });
                    destSelect.createEl('option', { value: 'append-log', text: 'Append to Bottom' });
                    
                    destSelect.value = t.destination || 'frontmatter';
                    
                    const editBtn = controls.createEl('button', { text: 'Save' });
                    editBtn.style.marginRight = '5px';
                    
                    const delBtn = controls.createEl('button', { text: 'Delete' });
                    delBtn.onclick = async () => {
                        if (confirm(`Are you sure you want to delete template "${t.name}"?`)) {
                            if (isBuiltIn) {
                                if (!this.plugin.settings.deletedBuiltInTemplates) {
                                    this.plugin.settings.deletedBuiltInTemplates = [];
                                }
                                if (!this.plugin.settings.deletedBuiltInTemplates.includes(t.id)) {
                                    this.plugin.settings.deletedBuiltInTemplates.push(t.id);
                                }
                            }
                            this.plugin.settings.customTemplates = (this.plugin.settings.customTemplates || []).filter(temp => temp.id !== t.id);
                            await this.plugin.saveSettings();
                            await this.plugin.deleteCustomTemplateFromVault(t.name);
                            renderTemplates();
                        }
                    };
                    
                    let configArea: HTMLTextAreaElement;
                    let styleSelect: HTMLSelectElement | undefined;
                    let intervalInput: HTMLInputElement | undefined;
                    let intervalRow: HTMLElement | undefined;
                    let warningEl: HTMLElement | undefined;
                    
                    if (t.mode === 'ble') {
                        // ── Device picker ──────────────────────────────────
                        const deviceRow = itemDiv.createDiv({ style: 'display:flex; gap:8px; align-items:center; margin-top:10px; margin-bottom:8px;' });
                        deviceRow.createSpan({ text: 'Device:', style: 'font-weight:600; min-width:60px;' });
                        const templateDeviceSelect = deviceRow.createEl('select', { style: 'flex:1;' });
                        
                        const repopulateDeviceSelect = () => {
                            templateDeviceSelect.empty();
                            const pairedDevices = this.plugin.listPairedDevices();
                            templateDeviceSelect.createEl('option', { value: '', text: '— Select paired device —' });
                            pairedDevices.forEach(d => templateDeviceSelect.createEl('option', { value: d.name, text: `${d.name}  (${d.address})` }));
                            templateDeviceSelect.value = t.deviceName || '';
                        };
                        repopulateDeviceSelect();
                        templateDeviceSelect.onchange = async () => {
                            t.deviceName = templateDeviceSelect.value;
                            await saveTemplateOnTheFly(t, destSelect.value, styleSelect ? styleSelect.value : undefined, intervalInput ? (parseInt(intervalInput.value) || 15) : undefined, templateDeviceSelect.value, configArea.value);
                        };

                        if (!this.plugin.listPairedDevices().length) {
                            deviceRow.createSpan({ text: 'No paired devices — pair one in Settings above.', style: 'color:var(--text-muted); font-size:0.85em;' });
                        }

                        // Metrics JSON (safe to sync — no credentials)
                        itemDiv.createEl('p', { text: 'Metrics config (no credentials stored here):', style: 'margin:8px 0 4px; font-size:0.85em; color:var(--text-muted);' });
                        configArea = itemDiv.createEl('textarea');
                        configArea.style.width = '100%';
                        configArea.style.marginTop = '4px';
                        configArea.style.height = '160px';
                        configArea.style.fontFamily = 'monospace';
                        
                        const safeConfig = { id: t.id, name: t.name, mode: t.mode, destination: t.destination, deviceName: t.deviceName || '', metrics: t.metrics || [] };
                        configArea.value = JSON.stringify(safeConfig, null, 2);

                        const syncStyleContainer = itemDiv.createDiv();
                        syncStyleContainer.style.marginTop = '10px';
                        syncStyleContainer.style.display = 'flex';
                        syncStyleContainer.style.flexDirection = 'column';
                        syncStyleContainer.style.gap = '8px';
                        
                        const styleRow = syncStyleContainer.createDiv();
                        styleRow.style.display = 'flex';
                        styleRow.style.justifyContent = 'space-between';
                        styleRow.style.alignItems = 'center';
                        styleRow.createSpan({ text: "Sync Style:" });
                        styleSelect = styleRow.createEl('select');
                        styleSelect.createEl('option', { value: 'manual', text: 'Manual (Button/Palette)' });
                        styleSelect.createEl('option', { value: 'automatic', text: 'Automatic (Background Polling)' });
                        styleSelect.value = t.syncStyle || 'manual';
                        
                        intervalRow = syncStyleContainer.createDiv();
                        intervalRow.style.display = 'flex';
                        intervalRow.style.justifyContent = 'space-between';
                        intervalRow.style.alignItems = 'center';
                        intervalRow.createSpan({ text: "Sync Frequency (minutes):" });
                        intervalInput = intervalRow.createEl('input', { type: 'number' });
                        intervalInput.style.width = '70px';
                        intervalInput.min = '1';
                        intervalInput.value = String(t.syncInterval || 15);
                        
                        warningEl = syncStyleContainer.createEl('p', { 
                            text: "⚠️ Warning: Polling more frequently will drain the device's battery significantly faster.",
                            cls: 'setting-item-description'
                        });
                        warningEl.style.color = 'var(--text-accent)';
                        warningEl.style.fontSize = '0.85em';
                        warningEl.style.margin = '4px 0 0 0';
                        
                        const updateConfigArea = () => {
                            try {
                                const parsed = JSON.parse(configArea.value);
                                parsed.syncStyle = styleSelect!.value;
                                parsed.syncInterval = parseInt(intervalInput!.value) || 15;
                                parsed.destination = destSelect.value;
                                configArea.value = JSON.stringify(parsed, null, 2);
                            } catch(e) {}
                        };
                        
                        const toggleInterval = () => {
                            if (styleSelect!.value === 'automatic') {
                                intervalRow!.style.display = 'flex';
                                warningEl!.style.display = 'block';
                            } else {
                                intervalRow!.style.display = 'none';
                                warningEl!.style.display = 'none';
                            }
                        };
                        
                        styleSelect.onchange = async () => {
                            toggleInterval();
                            updateConfigArea();
                            await saveTemplateOnTheFly(t, destSelect.value, styleSelect!.value, parseInt(intervalInput!.value) || 15, templateDeviceSelect.value, configArea.value);
                        };
                        intervalInput.onchange = async () => {
                            updateConfigArea();
                            await saveTemplateOnTheFly(t, destSelect.value, styleSelect!.value, parseInt(intervalInput!.value) || 15, templateDeviceSelect.value, configArea.value);
                        };
                        destSelect.onchange = async () => {
                            updateConfigArea();
                            await saveTemplateOnTheFly(t, destSelect.value, styleSelect!.value, parseInt(intervalInput!.value) || 15, templateDeviceSelect.value, configArea.value);
                        };
                        configArea.onchange = async () => {
                            await saveTemplateOnTheFly(t, destSelect.value, styleSelect!.value, parseInt(intervalInput!.value) || 15, templateDeviceSelect.value, configArea.value);
                        };
                        
                        toggleInterval();
                        updateConfigArea();
                        
                        const codeBlockRow = syncStyleContainer.createDiv();
                        codeBlockRow.style.marginTop = '8px';
                        codeBlockRow.style.display = 'flex';
                        codeBlockRow.style.justifyContent = 'space-between';
                        codeBlockRow.style.alignItems = 'center';
                        codeBlockRow.style.gap = '10px';
                        
                        const labelSpan = codeBlockRow.createSpan({ text: "Meta Bind Button:" });
                        labelSpan.style.fontSize = '0.9em';
                        
                        const btnAndCode = codeBlockRow.createDiv();
                        btnAndCode.style.display = 'flex';
                        btnAndCode.style.alignItems = 'center';
                        btnAndCode.style.gap = '8px';
                        
                        const codeVal = `\`BUTTON[${t.id}-btn]\``;
                        const codeEl = btnAndCode.createEl('code', { text: codeVal });
                        codeEl.style.cursor = 'pointer';
                        codeEl.title = 'Click to copy to clipboard';
                        codeEl.onclick = () => {
                            navigator.clipboard.writeText(codeVal);
                            new obsidian.Notice("Copied Meta Bind code to clipboard!");
                        };
                        
                        const registerBtn = btnAndCode.createEl('button', { text: 'Register/Sync Button', cls: 'mod-normal' });
                        registerBtn.style.padding = '2px 8px';
                        registerBtn.style.fontSize = '0.85em';
                        registerBtn.onclick = async () => {
                            await this.plugin.updateMetaBindButton(t);
                        };
                    } else {
                        const promptArea = itemDiv.createEl('textarea');
                        promptArea.style.width = '100%';
                        promptArea.style.marginTop = '10px';
                        promptArea.style.height = '80px';
                        promptArea.value = t.prompt || '';
                        (t as any)._promptArea = promptArea;

                        const syncStyleContainer = itemDiv.createDiv();
                        syncStyleContainer.style.marginTop = '10px';
                        syncStyleContainer.style.display = 'flex';
                        syncStyleContainer.style.flexDirection = 'column';
                        syncStyleContainer.style.gap = '8px';

                        if (t.mode === 'api') {
                            const styleRow = syncStyleContainer.createDiv();
                            styleRow.style.display = 'flex';
                            styleRow.style.justifyContent = 'space-between';
                            styleRow.style.alignItems = 'center';
                            styleRow.createSpan({ text: "Sync Style:" });
                            styleSelect = styleRow.createEl('select');
                            styleSelect.createEl('option', { value: 'manual', text: 'Manual (Button/Palette)' });
                            styleSelect.createEl('option', { value: 'automatic', text: 'Automatic (Background Polling)' });
                            styleSelect.value = t.syncStyle || 'manual';
                            
                            intervalRow = syncStyleContainer.createDiv();
                            intervalRow.style.display = 'flex';
                            intervalRow.style.justifyContent = 'space-between';
                            intervalRow.style.alignItems = 'center';
                            intervalRow.createSpan({ text: "Sync Frequency (minutes):" });
                            intervalInput = intervalRow.createEl('input', { type: 'number' });
                            intervalInput.style.width = '70px';
                            intervalInput.min = '5';
                            intervalInput.value = String(t.syncInterval || 60);

                            const toggleInterval = () => {
                                if (styleSelect!.value === 'automatic') {
                                    intervalRow!.style.display = 'flex';
                                } else {
                                    intervalRow!.style.display = 'none';
                                }
                            };

                            styleSelect.onchange = async () => {
                                t.syncStyle = styleSelect!.value;
                                toggleInterval();
                                await saveTemplateOnTheFly(t, destSelect.value, styleSelect!.value, parseInt(intervalInput!.value) || 60, undefined, promptArea.value);
                            };
                            intervalInput.onchange = async () => {
                                t.syncInterval = parseInt(intervalInput!.value) || 60;
                                await saveTemplateOnTheFly(t, destSelect.value, styleSelect ? styleSelect.value : undefined, parseInt(intervalInput!.value) || 60, undefined, promptArea.value);
                            };

                            toggleInterval();
                        }

                        destSelect.onchange = async () => {
                            const sVal = styleSelect ? styleSelect.value : undefined;
                            const iVal = intervalInput ? (parseInt(intervalInput.value) || 60) : undefined;
                            await saveTemplateOnTheFly(t, destSelect.value, sVal, iVal, undefined, promptArea.value);
                        };
                        promptArea.onchange = async () => {
                            const sVal = styleSelect ? styleSelect.value : undefined;
                            const iVal = intervalInput ? (parseInt(intervalInput.value) || 60) : undefined;
                            await saveTemplateOnTheFly(t, destSelect.value, sVal, iVal, undefined, promptArea.value);
                        };

                        const codeBlockRow = syncStyleContainer.createDiv();
                        codeBlockRow.style.marginTop = '8px';
                        codeBlockRow.style.display = 'flex';
                        codeBlockRow.style.justifyContent = 'space-between';
                        codeBlockRow.style.alignItems = 'center';
                        codeBlockRow.style.gap = '10px';
                        
                        const labelSpan = codeBlockRow.createSpan({ text: "Meta Bind Button:" });
                        labelSpan.style.fontSize = '0.9em';
                        
                        const btnAndCode = codeBlockRow.createDiv();
                        btnAndCode.style.display = 'flex';
                        btnAndCode.style.alignItems = 'center';
                        btnAndCode.style.gap = '8px';
                        
                        const codeVal = `\`BUTTON[${t.id}-btn]\``;
                        const codeEl = btnAndCode.createEl('code', { text: codeVal });
                        codeEl.style.cursor = 'pointer';
                        codeEl.title = 'Click to copy to clipboard';
                        codeEl.onclick = () => {
                            navigator.clipboard.writeText(codeVal);
                            new obsidian.Notice("Copied Meta Bind code to clipboard!");
                        };
                        
                        const registerBtn = btnAndCode.createEl('button', { text: 'Register/Sync Button', cls: 'mod-normal' });
                        registerBtn.style.padding = '2px 8px';
                        registerBtn.style.fontSize = '0.85em';
                        registerBtn.onclick = async () => {
                            await this.plugin.updateMetaBindButton(t);
                        };
                    }
                    
                    editBtn.onclick = async () => {
                        t.destination = destSelect.value;
                        const cleanDirName = t.name.replace(/[^a-zA-Z0-9 _-]/g, '');
                        const basePath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : '';
                        const metadataPath = `${basePath}/${this.plugin.settings.ingredientsFolder}/${cleanDirName}/metadata.json`;
                        const fs = require('fs');
                        
                        if (t.mode === 'ble') {
                            try {
                                const parsedConfig = JSON.parse(configArea.value);
                                Object.assign(t, parsedConfig);
                                t.destination = destSelect.value;
                                t.syncStyle = styleSelect ? styleSelect.value : 'manual';
                                t.syncInterval = intervalInput ? (parseInt(intervalInput.value) || 15) : 15;
                                
                                const cleanMeta = {
                                    id: t.id,
                                    name: t.name,
                                    mode: t.mode,
                                    destination: t.destination,
                                    deviceName: t.deviceName || '',
                                    metrics: t.metrics,
                                    syncStyle: t.syncStyle,
                                    syncInterval: t.syncInterval
                                };
                                
                                fs.writeFileSync(metadataPath, JSON.stringify(cleanMeta, null, 2), 'utf8');
                                await this.plugin.updateMetaBindButton(t);
                                new obsidian.Notice(`Saved BLE template "${t.name}"!`);
                                renderTemplates();
                            } catch (e) {
                                new obsidian.Notice("Failed to save BLE template: invalid JSON format.");
                            }
                        } else {
                            t.prompt = (t as any)._promptArea ? (t as any)._promptArea.value : '';
                            if (styleSelect) {
                                t.syncStyle = styleSelect.value;
                                t.syncInterval = intervalInput ? (parseInt(intervalInput.value) || 60) : 60;
                            }
                            const dirPath = `${basePath}/${this.plugin.settings.ingredientsFolder}/${cleanDirName}`;
                            if (!fs.existsSync(dirPath)) {
                                fs.mkdirSync(dirPath, { recursive: true });
                            }
                            if (t.prompt) {
                                const promptPath = `${dirPath}/system_prompt.txt`;
                                try {
                                    fs.writeFileSync(promptPath, t.prompt, 'utf8');
                                } catch (e) {
                                    console.error("Failed to write system_prompt.txt:", e);
                                }
                            }
                            if (fs.existsSync(metadataPath)) {
                                try {
                                    let m = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                                    m.prompt = t.prompt;
                                    m.destination = t.destination;
                                    m.syncStyle = t.syncStyle;
                                    m.syncInterval = t.syncInterval;
                                    fs.writeFileSync(metadataPath, JSON.stringify(m, null, 2), 'utf8');
                                    await this.plugin.updateMetaBindButton(t);
                                    new obsidian.Notice(`Saved template "${t.name}"!`);
                                } catch(e: any) {
                                    new obsidian.Notice(`Failed to save template file: ${e.message}`);
                                }
                            } else {
                                try {
                                    const m = {
                                        id: t.id,
                                        name: t.name,
                                        destination: t.destination,
                                        prompt: t.prompt,
                                        mode: t.mode,
                                        connectionId: t.connectionId,
                                        syncStyle: t.syncStyle,
                                        syncInterval: t.syncInterval
                                    };
                                    fs.writeFileSync(metadataPath, JSON.stringify(m, null, 2), 'utf8');
                                    new obsidian.Notice(`Created and saved template "${t.name}"!`);
                                } catch(e: any) {
                                    new obsidian.Notice(`Failed to write template file: ${e.message}`);
                                }
                            }
                        }
                    };
                }
            }
        };
        renderTemplates();
    }
}
