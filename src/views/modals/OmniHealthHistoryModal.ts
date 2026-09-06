import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../../main";

export class OmniHealthHistoryModal extends obsidian.Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.selectedEntries = new Set();
        this.dataType = "nutrition-log"; // default
        this.entries = [];
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '🗑️ Google Health History Manager', cls: 'omni-modal-title' });
        
        // Tab header for data types
        const tabHeader = contentEl.createDiv({ cls: 'omni-tab-header' });
        tabHeader.style.display = 'flex';
        tabHeader.style.gap = '15px';
        tabHeader.style.marginBottom = '15px';
        tabHeader.style.borderBottom = '1px solid var(--background-modifier-border)';
        tabHeader.style.paddingBottom = '8px';
        
        const tabNutrition = tabHeader.createSpan({ text: 'Nutrition Logs' });
        const tabHydration = tabHeader.createSpan({ text: 'Hydration Logs' });
        
        tabNutrition.style.cursor = 'pointer';
        tabHydration.style.cursor = 'pointer';
        
        const listContainer = contentEl.createDiv();
        listContainer.style.maxHeight = '400px';
        listContainer.style.overflowY = 'auto';
        listContainer.style.marginBottom = '15px';
        listContainer.style.border = '1px solid var(--background-modifier-border)';
        listContainer.style.borderRadius = '6px';
        listContainer.style.padding = '10px';
        
        const actionRow = contentEl.createDiv();
        actionRow.style.display = 'flex';
        actionRow.style.justifyContent = 'space-between';
        actionRow.style.alignItems = 'center';
        
        const leftActions = actionRow.createDiv();
        leftActions.style.display = 'flex';
        leftActions.style.gap = '10px';
        
        const selectAllBtn = leftActions.createEl('button', { text: 'Select All', cls: 'omni-btn' });
        const deselectAllBtn = leftActions.createEl('button', { text: 'Deselect All', cls: 'omni-btn' });
        
        const rightActions = actionRow.createDiv();
        rightActions.style.display = 'flex';
        rightActions.style.gap = '10px';
        
        const cancelBtn = rightActions.createEl('button', { text: 'Cancel', cls: 'omni-btn btn-cancel' });
        cancelBtn.onclick = () => this.close();
        
        const deleteBtn = rightActions.createEl('button', { text: 'Delete Selected', cls: 'omni-btn btn-process' });
        deleteBtn.style.backgroundColor = 'var(--text-error)';
        deleteBtn.style.color = 'var(--text-on-accent)';
        
        const renderList = async () => {
            listContainer.empty();
            this.selectedEntries.clear();
            
            if (this.dataType === "nutrition-log") {
                tabNutrition.style.fontWeight = 'bold';
                tabNutrition.style.color = 'var(--text-accent)';
                tabHydration.style.fontWeight = 'normal';
                tabHydration.style.color = 'var(--text-muted)';
            } else {
                tabHydration.style.fontWeight = 'bold';
                tabHydration.style.color = 'var(--text-accent)';
                tabNutrition.style.fontWeight = 'normal';
                tabNutrition.style.color = 'var(--text-muted)';
            }
            
            listContainer.createEl('p', { text: 'Fetching entries from Google Health API...', cls: 'omni-loading' });
            
            try {
                const token = await this.plugin.getGoogleAccessToken();
                if (!token) throw new Error("No Google Health access token found.");
                
                const url = `https://health.googleapis.com/v4/users/me/dataTypes/${this.dataType}/dataPoints`;
                const response = await obsidian.requestUrl({
                    url: url,
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                listContainer.empty();
                if (response.status !== 200) {
                    listContainer.createEl('p', { text: `Failed to fetch entries: ${response.status} - ${response.text}`, cls: 'omni-error' });
                    return;
                }
                
                const data = response.json;
                this.entries = data.dataPoints || [];
                
                if (this.entries.length === 0) {
                    listContainer.createEl('p', { text: 'No recent entries found in Google Health.' });
                    return;
                }
                
                // Sort by time descending
                this.entries.sort((a, b) => {
                    const getEndTime = (pt) => {
                        const val = pt.nutritionLog || pt.hydrationLog || {};
                        return val.interval?.endTime || "";
                    };
                    return getEndTime(b).localeCompare(getEndTime(a));
                });
                
                this.entries.forEach(pt => {
                    const row = listContainer.createDiv();
                    row.style.display = 'flex';
                    row.style.alignItems = 'center';
                    row.style.padding = '8px';
                    row.style.borderBottom = '1px solid var(--background-modifier-border)';
                    
                    const chk = row.createEl('input', { type: 'checkbox' });
                    chk.style.marginRight = '12px';
                    chk.checked = this.selectedEntries.has(pt.name);
                    chk.onchange = () => {
                        if (chk.checked) {
                            this.selectedEntries.add(pt.name);
                        } else {
                            this.selectedEntries.delete(pt.name);
                        }
                    };
                    
                    const infoDiv = row.createDiv();
                    infoDiv.style.flex = '1';
                    
                    let title = "";
                    let details = "";
                    let timeStr = "";
                    
                    if (this.dataType === "nutrition-log") {
                        const log = pt.nutritionLog || {};
                        title = log.foodDisplayName || log.foodName || "Unknown Food";
                        
                        // Parse calories, caffeine etc
                        const cals = log.energy?.kcal ? `${log.energy.kcal} kcal` : "";
                        const nutrients = log.nutrients || [];
                        let caffeine = "";
                        let protein = "";
                        let alcohol = "";
                        nutrients.forEach(n => {
                            const grams = n.quantity?.grams || 0;
                            if (n.nutrient === "CAFFEINE") caffeine = `${Math.round(grams * 1000)} mg caffeine`;
                            if (n.nutrient === "PROTEIN") protein = `${grams}g protein`;
                            if (n.nutrient === "ALCOHOL") alcohol = `${grams}g alcohol`;
                        });
                        
                        details = [cals, caffeine, protein, alcohol].filter(Boolean).join(" | ") || "No nutrients logged";
                        timeStr = log.interval?.endTime ? new Date(log.interval.endTime).toLocaleString() : "Unknown Time";
                    } else if (this.dataType === "hydration-log") {
                        const log = pt.hydrationLog || {};
                        const amount = log.amountConsumed?.milliliters || 0;
                        const oz = Math.round(amount * 0.033814);
                        title = `💧 Water (${oz} fl oz)`;
                        details = `${amount} ml`;
                        timeStr = log.interval?.endTime ? new Date(log.interval.endTime).toLocaleString() : "Unknown Time";
                    }
                    
                    const nameSpan = infoDiv.createEl('div', { text: title });
                    nameSpan.style.fontWeight = 'bold';
                    
                    const detailSpan = infoDiv.createEl('div', { text: `${timeStr} (${details})` });
                    detailSpan.style.fontSize = '0.85em';
                    detailSpan.style.color = 'var(--text-muted)';
                });
                
            } catch(e) {
                listContainer.empty();
                listContainer.createEl('p', { text: `Error fetching entries: ${e.message}`, cls: 'omni-error' });
            }
        };
        
        tabNutrition.onclick = () => {
            this.dataType = "nutrition-log";
            renderList();
        };
        
        tabHydration.onclick = () => {
            this.dataType = "hydration-log";
            renderList();
        };
        
        selectAllBtn.onclick = () => {
            this.entries.forEach(pt => this.selectedEntries.add(pt.name));
            listContainer.querySelectorAll('input[type="checkbox"]').forEach((chk) => {
                chk.checked = true;
            });
        };
        
        deselectAllBtn.onclick = () => {
            this.selectedEntries.clear();
            listContainer.querySelectorAll('input[type="checkbox"]').forEach((chk) => {
                chk.checked = false;
            });
        };
        
        deleteBtn.onclick = async () => {
            if (this.selectedEntries.size === 0) {
                new obsidian.Notice("Please select at least one entry to delete!");
                return;
            }
            
            const count = this.selectedEntries.size;
            if (!confirm(`Are you sure you want to delete ${count} selected entries from Google Health?`)) {
                return;
            }
            
            deleteBtn.disabled = true;
            deleteBtn.setText('Deleting...');
            
            try {
                const token = await this.plugin.getGoogleAccessToken();
                const url = `https://health.googleapis.com/v4/users/me/dataTypes/${this.dataType}/dataPoints:batchDelete`;
                
                const response = await obsidian.requestUrl({
                    url: url,
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        names: Array.from(this.selectedEntries)
                    })
                });
                
                if (response.status === 200 || response.status === 204) {
                    new obsidian.Notice(`Successfully deleted ${count} entries!`);
                    try {
                        await this.plugin.pullGoogleHealthData();
                    } catch(e) {
                        console.error("Failed to sync after deletion:", e);
                    }
                    await renderList();
                } else {
                    new obsidian.Notice(`Failed to delete: ${response.status} - ${response.text}`);
                }
            } catch(e) {
                new obsidian.Notice(`Error during deletion: ${e.message}`);
            } finally {
                deleteBtn.disabled = false;
                deleteBtn.setText('Delete Selected');
            }
        };
        
        renderList();
    }

    onClose() {
        this.contentEl.empty();
    }
}

