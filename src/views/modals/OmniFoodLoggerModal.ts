import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../../main";

export class OmniFoodLoggerModal extends obsidian.Modal {
    constructor(app, plugin, activeTab = 'log') {
        super(app);
        this.plugin = plugin;
        this.activeTab = activeTab;
        this.selectedFoodId = "";
        this.logAmount = 1.0;
        
        // Form fields for new/edit item
        this.newId = "";
        this.newName = "";
        this.newCategory = "nutrition";
        this.newUnit = "serving";
        this.newProtein = 0;
        this.newCalories = 0;
        this.newCaffeine = 0;
        this.newAlcohol = 0;
        
        this.editingItem = null; // Currently editing item reference
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '🥗 Google Health Food Logger & Registry', cls: 'omni-modal-title' });
        
        const tabHeader = contentEl.createDiv({ cls: 'omni-tab-header' });
        tabHeader.style.display = 'flex';
        tabHeader.style.gap = '15px';
        tabHeader.style.marginBottom = '15px';
        tabHeader.style.borderBottom = '1px solid var(--background-modifier-border)';
        tabHeader.style.paddingBottom = '8px';
        
        const tabLog = tabHeader.createSpan({ text: 'Log Food' });
        const tabAdd = tabHeader.createSpan({ text: 'Add to Registry' });
        const tabManage = tabHeader.createSpan({ text: 'Manage Registry' });
        const tabHistory = tabHeader.createSpan({ text: 'History' });
        
        tabLog.style.cursor = 'pointer';
        tabAdd.style.cursor = 'pointer';
        tabManage.style.cursor = 'pointer';
        tabHistory.style.cursor = 'pointer';
        
        tabHistory.onclick = () => {
            this.close();
            new OmniHealthHistoryModal(this.app, this.plugin).open();
        };
        
        const mainContainer = contentEl.createDiv();
        
        const renderLogTab = async () => {
            mainContainer.empty();
            tabLog.style.color = 'var(--text-accent)';
            tabLog.style.fontWeight = 'bold';
            tabAdd.style.color = 'var(--text-muted)';
            tabAdd.style.fontWeight = 'normal';
            tabManage.style.color = 'var(--text-muted)';
            tabManage.style.fontWeight = 'normal';
            
            const items = await this.plugin.loadGoToItems();
            
            if (items.length === 0) {
                mainContainer.createEl('p', { text: 'No go-to food items found in registry JSON.' });
                return;
            }
            
            this.selectedFoodId = items[0].id;
            
            new obsidian.Setting(mainContainer)
                .setName('Select Food / Drink')
                .setDesc('Choose from your registry of custom food items.')
                .addDropdown(dropdown => {
                    items.forEach(item => {
                        dropdown.addOption(item.id, `${item.name} (${item.unit})`);
                    });
                    dropdown.setValue(this.selectedFoodId);
                    dropdown.onChange(val => this.selectedFoodId = val);
                });
                
            new obsidian.Setting(mainContainer)
                .setName('Amount / Servings')
                .setDesc('Enter the number of servings to log.')
                .addText(text => text
                    .setValue(String(this.logAmount))
                    .onChange(val => {
                        const parsed = parseFloat(val);
                        if (!isNaN(parsed)) this.logAmount = parsed;
                    })
                );
                
            const actionRow = mainContainer.createDiv();
            actionRow.style.marginTop = '20px';
            actionRow.style.display = 'flex';
            actionRow.style.justifyContent = 'flex-end';
            actionRow.style.gap = '10px';
            
            const cancelBtn = actionRow.createEl('button', { text: 'Cancel', cls: 'omni-btn btn-cancel' });
            cancelBtn.onclick = () => this.close();
            
            const logBtn = actionRow.createEl('button', { text: 'Log to Google Health', cls: 'omni-btn btn-process' });
            logBtn.onclick = async () => {
                logBtn.disabled = true;
                logBtn.setText('Logging...');
                try {
                    const dailyFile = this.plugin.getDailyNoteFile();
                    if (!dailyFile) {
                        new obsidian.Notice("Today's Daily Note not found!");
                        logBtn.disabled = false;
                        logBtn.setText('Log to Google Health');
                        return;
                    }
                    const path = require('path');
                    const vaultPath = this.plugin.app.vault.adapter.getBasePath();
                    const folderName = this.plugin.settings.ingredientsFolder || 'Omni_Templates';
                    const registryPath = path.join(vaultPath, folderName, 'health_go_to_items.json');
                    
                    const scriptPath = 'post_nutrition.py';
                    const args = `--id ${this.selectedFoodId} --amount ${this.logAmount} --registry "${registryPath}"`;
                    
                    await this.plugin.runPythonScript(scriptPath, args);
                    new obsidian.Notice("Successfully logged via HealthAPI.");
                    this.close();
                } catch(e) {
                    new obsidian.Notice("Failed to log food: " + e.message);
                    logBtn.disabled = false;
                    logBtn.setText('Log to Google Health');
                }
            };
        };
        
        const renderAddTab = () => {
            mainContainer.empty();
            tabAdd.style.color = 'var(--text-accent)';
            tabAdd.style.fontWeight = 'bold';
            tabLog.style.color = 'var(--text-muted)';
            tabLog.style.fontWeight = 'normal';
            tabManage.style.color = 'var(--text-muted)';
            tabManage.style.fontWeight = 'normal';
            
            this.newId = "";
            this.newName = "";
            this.newCategory = "nutrition";
            this.newUnit = "serving";
            this.newProtein = 0;
            this.newCalories = 0;
            this.newCaffeine = 0;
            this.newAlcohol = 0;
            this.newWaterFlOz = 0;
            this.newWaterMl = 0;

            new obsidian.Setting(mainContainer)
                .setName('Unique ID')
                .setDesc('E.g. "espresso_double" or "water_12oz"')
                .addText(text => text.onChange(val => this.newId = val.trim().toLowerCase().replace(/\s+/g, '_')));
                
            new obsidian.Setting(mainContainer)
                .setName('Display Name')
                .setDesc('E.g. "Double Espresso" or "Water (12 oz Cup)"')
                .addText(text => text.onChange(val => this.newName = val.trim()));
                
            new obsidian.Setting(mainContainer)
                .setName('Category')
                .addDropdown(dropdown => dropdown
                    .addOption('hydration', 'Hydration / Water')
                    .addOption('caffeine', 'Caffeine')
                    .addOption('alcohol', 'Alcohol')
                    .addOption('nutrition', 'General Nutrition')
                    .setValue(this.newCategory)
                    .onChange(val => this.newCategory = val)
                );
                
            new obsidian.Setting(mainContainer)
                .setName('Unit Name')
                .setDesc('E.g. "cup (12 oz / 355 ml)", "shot", "can"')
                .addText(text => text.setValue(this.newUnit).onChange(val => this.newUnit = val.trim()));
                
            new obsidian.Setting(mainContainer)
                .setName('Water / Volume (fl oz per serving)')
                .setDesc('Required for Hydration items (e.g. 12 for 12 oz cup, 16.9 for bottle)')
                .addText(text => text.setValue('0').onChange(val => {
                    this.newWaterFlOz = parseFloat(val) || 0;
                    this.newWaterMl = Math.round(this.newWaterFlOz * 29.5735 * 10) / 10;
                }));

            new obsidian.Setting(mainContainer)
                .setName('Protein (g per serving)')
                .addText(text => text.setValue('0').onChange(val => this.newProtein = parseFloat(val) || 0));
                
            new obsidian.Setting(mainContainer)
                .setName('Calories (kcal per serving)')
                .addText(text => text.setValue('0').onChange(val => this.newCalories = parseFloat(val) || 0));
                
            new obsidian.Setting(mainContainer)
                .setName('Caffeine (mg per serving)')
                .addText(text => text.setValue('0').onChange(val => this.newCaffeine = parseFloat(val) || 0));
                
            new obsidian.Setting(mainContainer)
                .setName('Alcohol (g per serving)')
                .addText(text => text.setValue('0').onChange(val => this.newAlcohol = parseFloat(val) || 0));
                
            const actionRow = mainContainer.createDiv();
            actionRow.style.marginTop = '20px';
            actionRow.style.display = 'flex';
            actionRow.style.justifyContent = 'flex-end';
            actionRow.style.gap = '10px';
            
            const cancelBtn = actionRow.createEl('button', { text: 'Cancel', cls: 'omni-btn btn-cancel' });
            cancelBtn.onclick = () => this.close();
            
            const saveBtn = actionRow.createEl('button', { text: 'Save to Registry', cls: 'omni-btn btn-process' });
            saveBtn.onclick = async () => {
                if (!this.newId || !this.newName) {
                    new obsidian.Notice("Please enter ID and Display Name!");
                    return;
                }
                
                const items = await this.plugin.loadGoToItems();
                if (items.some(item => item.id === this.newId)) {
                    new obsidian.Notice("A food item with this ID already exists!");
                    return;
                }
                
                const nutrients = {};
                let healthType = "nutrition";
                let waterMl = undefined;
                
                if (this.newCategory === "hydration") {
                    healthType = "hydration";
                    waterMl = this.newWaterFlOz > 0 ? Math.round(this.newWaterFlOz * 29.5735 * 10) / 10 : (this.newWaterMl || 250.0);
                } else if (this.newCategory === "caffeine" && this.newCaffeine > 0) {
                    nutrients["caffeine"] = this.newCaffeine / 1000.0; // mg to g
                } else if (this.newCategory === "alcohol" && this.newAlcohol > 0) {
                    nutrients["alcohol"] = this.newAlcohol;
                    healthType = "alcohol_consumption";
                }
                
                if (this.newProtein > 0) nutrients["protein"] = this.newProtein;
                if (this.newCalories > 0) nutrients["energy"] = this.newCalories;
                
                const newItem = {
                    id: this.newId,
                    name: this.newName,
                    category: this.newCategory,
                    default_amount: 1,
                    unit: this.newUnit,
                    caffeine_mg: this.newCaffeine > 0 ? this.newCaffeine : undefined,
                    alcohol_g: this.newAlcohol > 0 ? this.newAlcohol : undefined,
                    protein_g: this.newProtein > 0 ? this.newProtein : undefined,
                    calories: this.newCalories > 0 ? this.newCalories : undefined,
                    water_ml: waterMl,
                    health_connect_type: healthType,
                    nutrients: nutrients
                };
                
                items.push(newItem);
                await this.plugin.saveGoToItems(items);
                new obsidian.Notice(`Added ${this.newName} to Registry!`);
                renderManageTab();
            };
        };

        const renderManageTab = async () => {
            mainContainer.empty();
            tabManage.style.color = 'var(--text-accent)';
            tabManage.style.fontWeight = 'bold';
            tabLog.style.color = 'var(--text-muted)';
            tabLog.style.fontWeight = 'normal';
            tabAdd.style.color = 'var(--text-muted)';
            tabAdd.style.fontWeight = 'normal';

            const items = await this.plugin.loadGoToItems();
            if (items.length === 0) {
                mainContainer.createEl('p', { text: 'No items in registry.' });
                return;
            }

            const listDiv = mainContainer.createDiv({ style: 'max-height: 400px; overflow-y: auto; border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 10px;' });

            items.forEach(item => {
                const row = listDiv.createDiv({ style: 'display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--background-modifier-border);' });
                
                const info = row.createDiv();
                const title = info.createEl('div', { text: `${item.name} (${item.unit})`, style: 'font-weight:bold;' });
                const detail = info.createEl('div', { 
                    text: `ID: ${item.id} | Category: ${item.category} | ${item.water_ml ? Math.round(item.water_ml * 0.033814 * 10) / 10 + ' fl oz ' : ''}${item.calories ? item.calories + ' kcal ' : ''}${item.protein_g ? item.protein_g + 'g prot ' : ''}${item.caffeine_mg ? item.caffeine_mg + 'mg caff ' : ''}${item.alcohol_g ? item.alcohol_g + 'g alc ' : ''}`, 
                    style: 'font-size:0.85em; color:var(--text-muted);' 
                });

                const actions = row.createDiv({ style: 'display:flex; gap:8px;' });
                
                const editBtn = actions.createEl('button', { text: 'Edit', cls: 'omni-btn btn-cancel' });
                editBtn.onclick = () => renderEditItem(item);

                const deleteBtn = actions.createEl('button', { text: 'Delete', cls: 'omni-btn' });
                deleteBtn.style.backgroundColor = 'var(--text-error)';
                deleteBtn.style.color = 'var(--text-on-accent)';
                deleteBtn.onclick = async () => {
                    if (confirm(`Are you sure you want to delete "${item.name}" from your registry?`)) {
                        const updated = items.filter(i => i.id !== item.id);
                        await this.plugin.saveGoToItems(updated);
                        new obsidian.Notice(`Deleted "${item.name}".`);
                        renderManageTab();
                    }
                };
            });
        };

        const renderEditItem = (item) => {
            mainContainer.empty();
            tabManage.style.color = 'var(--text-accent)';
            tabManage.style.fontWeight = 'bold';

            mainContainer.createEl('h3', { text: `Edit Item: ${item.name}` });

            this.editingItem = item;
            this.newId = item.id;
            this.newName = item.name;
            this.newCategory = item.category || "nutrition";
            this.newUnit = item.unit || "serving";
            this.newProtein = item.protein_g || 0;
            this.newCalories = item.calories || 0;
            this.newCaffeine = item.caffeine_mg || 0;
            this.newAlcohol = item.alcohol_g || 0;
            this.newWaterMl = item.water_ml || 0;
            this.newWaterFlOz = item.water_ml ? Math.round(item.water_ml * 0.033814 * 10) / 10 : 0;

            new obsidian.Setting(mainContainer)
                .setName('Unique ID')
                .setDesc('Cannot be changed.')
                .addText(text => text.setValue(this.newId).setDisabled(true));
                
            new obsidian.Setting(mainContainer)
                .setName('Display Name')
                .addText(text => text.setValue(this.newName).onChange(val => this.newName = val.trim()));
                
            new obsidian.Setting(mainContainer)
                .setName('Category')
                .addDropdown(dropdown => dropdown
                    .addOption('hydration', 'Hydration / Water')
                    .addOption('caffeine', 'Caffeine')
                    .addOption('alcohol', 'Alcohol')
                    .addOption('nutrition', 'General Nutrition')
                    .setValue(this.newCategory)
                    .onChange(val => this.newCategory = val)
                );
                
            new obsidian.Setting(mainContainer)
                .setName('Unit Name')
                .addText(text => text.setValue(this.newUnit).onChange(val => this.newUnit = val.trim()));
                
            new obsidian.Setting(mainContainer)
                .setName('Water / Volume (fl oz per serving)')
                .setDesc('Required for Hydration items (e.g. 12 for 12 oz cup, 16.9 for bottle)')
                .addText(text => text.setValue(String(this.newWaterFlOz)).onChange(val => {
                    this.newWaterFlOz = parseFloat(val) || 0;
                    this.newWaterMl = Math.round(this.newWaterFlOz * 29.5735 * 10) / 10;
                }));

            new obsidian.Setting(mainContainer)
                .setName('Protein (g per serving)')
                .addText(text => text.setValue(String(this.newProtein)).onChange(val => this.newProtein = parseFloat(val) || 0));
                
            new obsidian.Setting(mainContainer)
                .setName('Calories (kcal per serving)')
                .addText(text => text.setValue(String(this.newCalories)).onChange(val => this.newCalories = parseFloat(val) || 0));
                
            new obsidian.Setting(mainContainer)
                .setName('Caffeine (mg per serving)')
                .addText(text => text.setValue(String(this.newCaffeine)).onChange(val => this.newCaffeine = parseFloat(val) || 0));
                
            new obsidian.Setting(mainContainer)
                .setName('Alcohol (g per serving)')
                .addText(text => text.setValue(String(this.newAlcohol)).onChange(val => this.newAlcohol = parseFloat(val) || 0));

            const actionRow = mainContainer.createDiv();
            actionRow.style.marginTop = '20px';
            actionRow.style.display = 'flex';
            actionRow.style.justifyContent = 'flex-end';
            actionRow.style.gap = '10px';
            
            const cancelBtn = actionRow.createEl('button', { text: 'Back to List', cls: 'omni-btn btn-cancel' });
            cancelBtn.onclick = renderManageTab;
            
            const saveBtn = actionRow.createEl('button', { text: 'Save Changes', cls: 'omni-btn btn-process' });
            saveBtn.onclick = async () => {
                if (!this.newName) {
                    new obsidian.Notice("Please enter Display Name!");
                    return;
                }
                
                const items = await this.plugin.loadGoToItems();
                const index = items.findIndex(i => i.id === this.newId);
                if (index === -1) {
                    new obsidian.Notice("Item not found in registry!");
                    return;
                }

                const nutrients = {};
                let healthType = "nutrition";
                let waterMl = undefined;
                
                if (this.newCategory === "hydration") {
                    healthType = "hydration";
                    waterMl = this.newWaterFlOz > 0 ? Math.round(this.newWaterFlOz * 29.5735 * 10) / 10 : (this.newWaterMl || 250.0);
                } else if (this.newCategory === "caffeine" && this.newCaffeine > 0) {
                    nutrients["caffeine"] = this.newCaffeine / 1000.0; // mg to g
                } else if (this.newCategory === "alcohol" && this.newAlcohol > 0) {
                    nutrients["alcohol"] = this.newAlcohol;
                    healthType = "alcohol_consumption";
                }
                
                if (this.newProtein > 0) nutrients["protein"] = this.newProtein;
                if (this.newCalories > 0) nutrients["energy"] = this.newCalories;
                
                const updatedItem = {
                    id: this.newId,
                    name: this.newName,
                    category: this.newCategory,
                    default_amount: 1,
                    unit: this.newUnit,
                    caffeine_mg: this.newCaffeine > 0 ? this.newCaffeine : undefined,
                    alcohol_g: this.newAlcohol > 0 ? this.newAlcohol : undefined,
                    protein_g: this.newProtein > 0 ? this.newProtein : undefined,
                    calories: this.newCalories > 0 ? this.newCalories : undefined,
                    water_ml: waterMl,
                    health_connect_type: healthType,
                    nutrients: nutrients
                };

                items[index] = updatedItem;
                await this.plugin.saveGoToItems(items);
                new obsidian.Notice(`Updated "${this.newName}" in Registry!`);
                renderManageTab();
            };
        };
        
        tabLog.onclick = renderLogTab;
        tabAdd.onclick = renderAddTab;
        tabManage.onclick = renderManageTab;
        
        if (this.activeTab === 'manage') {
            renderManageTab();
        } else if (this.activeTab === 'add') {
            renderAddTab();
        } else {
            renderLogTab();
        }
    }

    onClose() {
        this.contentEl.empty();
    }
}

