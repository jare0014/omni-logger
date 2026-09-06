import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../../main";

export class ManageKeysModal extends obsidian.Modal {
    constructor(app, plugin, onUpdate) {
        super(app);
        this.plugin = plugin;
        this.onUpdate = onUpdate;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h3', { text: '⚙️ Manage Available Keys Pool' });
        contentEl.createEl('p', { 
            text: 'This is the pool of keys available when adding new dashboard cards. You can manually add custom keys or hide/blacklist auto-detected keys.',
            cls: 'setting-item-description' 
        });

        const listContainer = contentEl.createDiv();
        listContainer.style.maxHeight = '200px';
        listContainer.style.overflowY = 'auto';
        listContainer.style.border = '1px solid var(--background-modifier-border)';
        listContainer.style.borderRadius = '6px';
        listContainer.style.padding = '10px';
        listContainer.style.marginBottom = '15px';

        const renderList = async () => {
            listContainer.empty();
            const allScannedKeys = await this.plugin.getRawScannedKeys();
            const blacklisted = this.plugin.settings.blacklistedKeys || [];
            
            const activeKeys = allScannedKeys.filter(k => !blacklisted.includes(k));
            
            activeKeys.forEach(key => {
                const row = listContainer.createDiv();
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.alignItems = 'center';
                row.style.padding = '6px 0';
                row.style.borderBottom = '1px solid var(--background-modifier-border-focus)';
                
                row.createSpan({ text: key });
                
                const removeBtn = row.createEl('button', { text: 'Hide' });
                removeBtn.style.color = 'var(--text-error)';
                removeBtn.onclick = async () => {
                    if (!this.plugin.settings.blacklistedKeys) this.plugin.settings.blacklistedKeys = [];
                    if (!this.plugin.settings.blacklistedKeys.includes(key)) {
                        this.plugin.settings.blacklistedKeys.push(key);
                    }
                    this.plugin.settings.customAvailableKeys = (this.plugin.settings.customAvailableKeys || []).filter(k => k !== key);
                    
                    await this.plugin.saveSettings();
                    await renderList();
                    this.onOpen();
                    if (this.onUpdate) this.onUpdate();
                };
            });

            if (activeKeys.length === 0) {
                listContainer.createSpan({ text: 'No active keys in pool.', style: 'color: var(--text-muted)' });
            }
        };

        await renderList();

        const blacklisted = this.plugin.settings.blacklistedKeys || [];
        if (blacklisted.length > 0) {
            contentEl.createEl('h4', { text: 'Hidden Keys' });
            
            const restoreContainer = contentEl.createDiv();
            restoreContainer.style.maxHeight = '120px';
            restoreContainer.style.overflowY = 'auto';
            restoreContainer.style.border = '1px solid var(--background-modifier-border)';
            restoreContainer.style.borderRadius = '6px';
            restoreContainer.style.padding = '10px';
            restoreContainer.style.marginBottom = '15px';

            blacklisted.forEach(key => {
                const row = restoreContainer.createDiv();
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.alignItems = 'center';
                row.style.padding = '4px 0';
                
                row.createSpan({ text: key });
                
                const restoreBtn = row.createEl('button', { text: 'Restore' });
                restoreBtn.onclick = async () => {
                    this.plugin.settings.blacklistedKeys = this.plugin.settings.blacklistedKeys.filter(k => k !== key);
                    await this.plugin.saveSettings();
                    this.onOpen();
                    if (this.onUpdate) this.onUpdate();
                };
            });
        }

        const addContainer = contentEl.createDiv();
        addContainer.style.display = 'flex';
        addContainer.style.gap = '8px';
        addContainer.style.alignItems = 'center';
        addContainer.style.marginTop = '15px';

        const keyInput = addContainer.createEl('input', { type: 'text', placeholder: 'New key name (e.g. custom_metric)' });
        keyInput.style.flex = '1';
        
        const addBtn = addContainer.createEl('button', { text: 'Add Custom Key', cls: 'mod-cta' });
        addBtn.onclick = async () => {
            const val = keyInput.value.trim();
            if (!val) {
                new obsidian.Notice("Please enter a key name!");
                return;
            }
            if (!this.plugin.settings.customAvailableKeys) this.plugin.settings.customAvailableKeys = [];
            if (!this.plugin.settings.customAvailableKeys.includes(val)) {
                this.plugin.settings.customAvailableKeys.push(val);
            }
            if (this.plugin.settings.blacklistedKeys) {
                this.plugin.settings.blacklistedKeys = this.plugin.settings.blacklistedKeys.filter(k => k !== val);
            }
            await this.plugin.saveSettings();
            keyInput.value = '';
            new obsidian.Notice(`Added ${val} to available keys pool!`);
            this.onOpen();
            if (this.onUpdate) this.onUpdate();
        };
    }

    onClose() {
        this.contentEl.empty();
    }
}



