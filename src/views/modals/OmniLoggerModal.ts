import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../../main";

export class OmniLoggerModal extends obsidian.Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.selectedType = "";
        this.selectedMode = "ocr";
        this.pastedImageBase64 = null;
        this.apiInputText = "";
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: 'Omni-Logger: Consolidated Data Sync', cls: 'omni-modal-title' });
        
        const mainContainer = contentEl.createDiv({ cls: 'omni-modal-container' });
        
        // 1. Selector row
        const selectorRow = mainContainer.createDiv({ cls: 'omni-selector-row' });
        
        selectorRow.createSpan({ text: 'Log Type: ' });
        const typeSelect = selectorRow.createEl('select');
        
        let defaultType = "";
        let defaultMode = "ocr";
        if (this.plugin.settings.customTemplates) {
            const allowedTemplates = this.plugin.settings.customTemplates.filter(t => 
                !['google-sleep', 'google-hrv', 'google-hydration', 'google-nutrition'].includes(t.id)
            );
            for (const t of allowedTemplates) {
                typeSelect.createEl('option', { value: t.id, text: t.name });
                if (!defaultType) {
                    defaultType = t.id;
                    defaultMode = t.mode || 'ocr';
                }
            }
        }
        
        if (this.plugin.settings.customTemplates?.some(t => t.id === this.selectedType)) {
            typeSelect.value = this.selectedType;
        } else {
            this.selectedType = defaultType;
            this.selectedMode = defaultMode;
            typeSelect.value = defaultType;
        }
        
        selectorRow.createSpan({ text: '  Mode: ' });
        const modeSelect = selectorRow.createEl('select');
        modeSelect.createEl('option', { value: 'ocr', text: 'Clipboard / OCR' });
        modeSelect.createEl('option', { value: 'api', text: 'Direct API Payload' });
        modeSelect.value = this.selectedMode;

        // 2. Clipboard Drag & Drop Zone
        const dropZone = mainContainer.createDiv({ cls: 'omni-drop-zone' });
        dropZone.createEl('p', { text: 'Paste screenshot (Ctrl+V) or click to upload', cls: 'omni-drop-text' });
        
        const fileInput = dropZone.createEl('input', { type: 'file', accept: 'image/*' });
        fileInput.style.display = 'none';
        
        dropZone.onclick = () => fileInput.click();
        
        // Image preview
        const previewContainer = mainContainer.createDiv({ cls: 'omni-preview-container', style: 'display:none;' });
        const previewImg = previewContainer.createEl('img', { cls: 'omni-preview-image' });
        
        // Form trigger/API elements
        const formContainer = mainContainer.createDiv({ cls: 'omni-form-container', style: 'display:none;' });
        
        // Mode toggle styling/visibility helper
        const updateVisibility = () => {
            this.selectedType = typeSelect.value;
            
            const customTemplate = this.plugin.settings.customTemplates?.find(t => t.id === this.selectedType);
            if (customTemplate) {
                this.selectedMode = customTemplate.mode;
                modeSelect.value = customTemplate.mode;
                modeSelect.disabled = true;
            } else {
                modeSelect.disabled = false;
                this.selectedMode = modeSelect.value;
            }
            
            if (this.selectedMode === 'ocr') {
                dropZone.style.display = 'flex';
                if (this.pastedImageBase64) {
                    previewContainer.style.display = 'block';
                    dropZone.style.display = 'none';
                } else {
                    previewContainer.style.display = 'none';
                }
                formContainer.style.display = 'none';
            } else if (this.selectedMode === 'api') {
                dropZone.style.display = 'none';
                previewContainer.style.display = 'none';
                formContainer.style.display = 'block';
                formContainer.empty();
                
                if (this.selectedType === 'health') {
                    formContainer.createEl('p', { text: 'Pulls Sleep hours and wake up time directly from Google Health APIs.' });
                } else if (customTemplate && customTemplate.mode === 'api') {
                    formContainer.createEl('p', { text: `Enter raw API response text or JSON below to process via "${customTemplate.name}" template:` });
                    const apiInput = formContainer.createEl('textarea', { cls: 'omni-api-textarea' });
                    apiInput.style.width = '100%';
                    apiInput.style.height = '150px';
                    apiInput.placeholder = 'Paste API response / JSON data here...';
                    apiInput.onchange = (e) => {
                        this.apiInputText = e.target.value;
                    };
                } else {
                    formContainer.createEl('p', { text: 'Direct API payload is not supported for this category. Please use Clipboard / OCR mode.' });
                }
            } else if (this.selectedMode === 'ble') {
                dropZone.style.display = 'none';
                previewContainer.style.display = 'none';
                formContainer.style.display = 'block';
                formContainer.empty();
                
                formContainer.createEl('p', { text: `Pulls metrics from your ${customTemplate.name} BLE device.` });
                const syncBtn = formContainer.createEl('button', { text: 'Sync BLE Device Now', cls: 'mod-cta' });
                syncBtn.style.marginTop = '10px';
                syncBtn.onclick = async () => {
                    syncBtn.disabled = true;
                    syncBtn.textContent = 'Syncing...';
                    const folderName = this.plugin.settings.ingredientsFolder || 'Omni_Templates';
                    const path = require('path');
                    const vaultPath = this.plugin.app.vault.adapter.getBasePath();
                    const cleanDirName = customTemplate.name.replace(/[^a-zA-Z0-9 _-]/g, '');
                    const absoluteTemplatePath = path.join(vaultPath, folderName, cleanDirName);
                    
                    const dailyFile = this.plugin.getDailyNoteFile();
                    if (!dailyFile) {
                        new obsidian.Notice("Daily note not found!");
                        syncBtn.disabled = false;
                        syncBtn.textContent = 'Sync BLE Device Now';
                        return;
                    }
                    const absoluteDailyPath = path.join(vaultPath, dailyFile.path);
                    
                    new obsidian.Notice(`Starting BLE sync for ${customTemplate.name}...`);
                    try {
                        await this.plugin.runPythonScript('log_ble.py', `--template-dir "${absoluteTemplatePath}" --file "${absoluteDailyPath}"`);
                        statusBar.setText("BLE sync completed successfully!");
                        setTimeout(() => this.close(), 1500);
                    } catch (e) {
                        new obsidian.Notice("BLE sync failed: " + e.message);
                        syncBtn.disabled = false;
                        syncBtn.textContent = 'Sync BLE Device Now';
                    }
                };
            }
        };

        typeSelect.onchange = updateVisibility;
        modeSelect.onchange = updateVisibility;
        
        // File processing handler
        const handleImageFile = (file) => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = () => {
                this.pastedImageBase64 = reader.result;
                previewImg.src = reader.result;
                previewContainer.style.display = 'block';
                dropZone.style.display = 'none';
            };
            reader.readAsDataURL(file);
        };
        
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                handleImageFile(e.target.files[0]);
            }
        };
        
        // Listen to paste event globally inside modal
        this.pasteListener = (evt) => {
            if (this.selectedMode !== 'ocr') return;
            const items = (evt.clipboardData || evt.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    handleImageFile(file);
                    break;
                }
            }
        };
        
        contentEl.addEventListener('paste', this.pasteListener);
        
        // 3. Action and status bar
        const statusBar = mainContainer.createDiv({ cls: 'omni-status-bar', text: 'Status: Ready' });
        
        const actionRow = mainContainer.createDiv({ cls: 'omni-action-row' });
        const cancelBtn = actionRow.createEl('button', { text: 'Cancel', cls: 'omni-btn btn-cancel' });
        cancelBtn.onclick = () => this.close();
        
        const processBtn = actionRow.createEl('button', { text: 'Process & Log', cls: 'omni-btn btn-process' });
        processBtn.onclick = async () => {
            statusBar.setText('Processing... please wait.');
            processBtn.disabled = true;
            try {
                if (this.selectedMode === 'ocr') {
                    if (!this.pastedImageBase64) {
                        new obsidian.Notice("Please paste or upload an image first!");
                        statusBar.setText('Error: No image provided.');
                        processBtn.disabled = false;
                        return;
                    }
                    
                    const base64Data = this.pastedImageBase64.split(',')[1];
                    const mimeType = this.pastedImageBase64.split(',')[0].split(':')[1].split(';')[0];
                    
                    await this.plugin.processOCR(base64Data, mimeType, this.selectedType);
                    statusBar.setText('Successfully logged data from OCR!');
                    new obsidian.Notice("Successfully logged scores/counts to Daily Note!");
                    setTimeout(() => this.close(), 1500);
                } else {
                    const customTemplate = this.plugin.settings.customTemplates?.find(t => t.id === this.selectedType);
                    if (customTemplate && customTemplate.mode === 'api') {
                        if (!this.apiInputText || !this.apiInputText.trim()) {
                            new obsidian.Notice("Please enter API text first!");
                            statusBar.setText('Error: No text provided.');
                            processBtn.disabled = false;
                            return;
                        }
                        statusBar.setText(`Processing via "${customTemplate.name}" template...`);
                        await this.plugin.processCustomAPI(this.apiInputText, this.selectedType);
                        statusBar.setText('Successfully logged data from API!');
                        new obsidian.Notice("Successfully logged data from API!");
                        setTimeout(() => this.close(), 1500);
                    } else {
                        statusBar.setText('Unsupported configuration.');
                        processBtn.disabled = false;
                    }
                }
            } catch (err) {
                console.error("Omni-Logger failed:", err);
                statusBar.setText('Error: ' + err.message);
                processBtn.disabled = false;
            }
        };
    }

    onClose() {
        if (this.pasteListener) {
            this.contentEl.removeEventListener('paste', this.pasteListener);
        }
        this.contentEl.empty();
    }
}

