import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../../main";

export class OmniTemplateCreatorModal extends obsidian.Modal {
    constructor(app, plugin, onSave, preSelectedSource = null) {
        super(app);
        this.plugin = plugin;
        this.onSave = onSave;
        this.preSelectedSource = preSelectedSource;
        this.name = "";
        this.mode = "ocr";
        this.destination = "frontmatter";
        this.exampleInput = ""; 
        this.targetAppearance = "";
        this.customInstructions = "";
        this.generatedPrompt = "";
        this.generatedPythonCode = "";
        this.connectionId = "";
        this.selectedDeviceName = "";
        this.selectedGoogleCategory = "google-sleep";
        this.scanSuggestions = "";
        this.syncStyle = "manual";
        this.syncInterval = 60;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: 'Create Custom Logging Template', cls: 'omni-modal-title' });
        
        const mainContainer = contentEl.createDiv({ cls: 'omni-modal-container' });

        let syncStyleSetting;
        let syncIntervalSetting;
        const updateSyncIntervalVisibility = () => {
            if (syncStyleSetting && syncIntervalSetting) {
                if (this.mode !== 'ocr' && this.syncStyle === 'automatic') {
                    syncIntervalSetting.settingEl.style.display = '';
                } else {
                    syncIntervalSetting.settingEl.style.display = 'none';
                }
                if (this.mode === 'ocr') {
                    syncStyleSetting.settingEl.style.display = 'none';
                } else {
                    syncStyleSetting.settingEl.style.display = '';
                }
            }
        };
        
        const nameSetting = new obsidian.Setting(mainContainer)
            .setName('Template Name')
            .setDesc('E.g., "Duolingo XP" or "LeetCode Stats"')
            .addText(text => text
                .setPlaceholder('Enter name')
                .onChange(val => this.name = val.trim())
            );

        // Source connection dropdown
        const sourceSetting = new obsidian.Setting(mainContainer)
            .setName('Source Connection')
            .setDesc('Select the connection source for this template.');

        const sourceSelect = sourceSetting.controlEl.createEl('select');
        sourceSelect.createEl('option', { value: 'ocr', text: '📷 Manual Screenshot (Clipboard / OCR)' });
        
        // Add API connections
        const apiConns = this.plugin.settings.apiConnections || [];
        apiConns.forEach(c => {
            sourceSelect.createEl('option', { value: `api-${c.id}`, text: `🔌 API: ${c.name}` });
        });

        // Add BLE devices
        const bleDevices = this.plugin.listPairedDevices();
        bleDevices.forEach(d => {
            sourceSelect.createEl('option', { value: `ble-${d.name}`, text: `🦷 BLE: ${d.name} (${d.address})` });
        });

        sourceSelect.onchange = () => {
            const val = sourceSelect.value;
            if (val === 'ocr') {
                this.mode = 'ocr';
                this.connectionId = '';
                this.selectedDeviceName = '';
                this.syncInterval = 60;
            } else if (val.startsWith('api-')) {
                this.mode = 'api';
                this.connectionId = val.replace('api-', '');
                this.selectedDeviceName = '';
                this.syncInterval = 60;
            } else if (val.startsWith('ble-')) {
                this.mode = 'ble';
                this.connectionId = '';
                this.selectedDeviceName = val.replace('ble-', '');
                this.syncInterval = 15;
            }
            updateInputSection();
            updateButtons();
            updateSyncIntervalVisibility();
        };

        // If pre-selected source passed
        if (this.preSelectedSource) {
            sourceSelect.value = this.preSelectedSource;
            // Trigger change event manually to ensure properties set
            setTimeout(() => {
                sourceSelect.value = this.preSelectedSource;
                sourceSelect.dispatchEvent(new Event('change'));
            }, 10);
        }

        const destSetting = new obsidian.Setting(mainContainer)
            .setName('Storage Destination')
            .setDesc('Where to write the extracted keys and values in your Daily Note.')
            .addDropdown(dropdown => dropdown
                .addOption('frontmatter', 'YAML Frontmatter Properties')
                .addOption('dataview', 'Inline Dataview Fields (key:: value)')
                .addOption('append-log', 'Append to Log Section (List)')
                .setValue(this.destination)
                .onChange(val => this.destination = val)
            );

        syncStyleSetting = new obsidian.Setting(mainContainer)
            .setName('Sync Style')
            .setDesc('Choose whether to sync manually or automatically in the background.')
            .addDropdown(dropdown => dropdown
                .addOption('manual', 'Manual (Button/Palette)')
                .addOption('automatic', 'Automatic (Background Polling)')
                .setValue(this.syncStyle)
                .onChange(val => {
                    this.syncStyle = val;
                    updateSyncIntervalVisibility();
                })
            );

        syncIntervalSetting = new obsidian.Setting(mainContainer)
            .setName('Sync Frequency (minutes)')
            .setDesc('Time interval between background sync checks.')
            .addText(text => text
                .setPlaceholder('60')
                .setValue(String(this.syncInterval))
                .onChange(val => this.syncInterval = parseInt(val) || 60)
            );

        updateSyncIntervalVisibility();

        mainContainer.createEl('h4', { text: 'Example Input Data' });
        const inputSection = mainContainer.createDiv();

        // OCR Input
        const ocrContainer = document.createElement('div');
        ocrContainer.className = 'omni-ocr-creator-container';
        
        const dropZone = ocrContainer.createDiv({ cls: 'omni-drop-zone' });
        dropZone.createEl('p', { text: 'Paste screenshot (Ctrl+V) or click to upload example', cls: 'omni-drop-text' });
        
        const fileInput = dropZone.createEl('input', { type: 'file', accept: 'image/*' });
        fileInput.style.display = 'none';
        dropZone.onclick = () => fileInput.click();
        
        const previewContainer = ocrContainer.createDiv({ cls: 'omni-preview-container', style: 'display:none;' });
        const previewImg = previewContainer.createEl('img', { cls: 'omni-preview-image' });
        
        const handleImageFile = (file) => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = () => {
                this.exampleInput = reader.result;
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

        // API Input
        const apiContainer = document.createElement('div');
        
        const apiControlsRow = apiContainer.createDiv({ style: 'display:flex; gap:10px; margin-bottom:8px; align-items:center;' });
        
        const googleCatSelect = apiControlsRow.createEl('select');
        googleCatSelect.createEl('option', { value: 'google-sleep', text: 'Sleep Payload' });
        googleCatSelect.createEl('option', { value: 'google-hrv', text: 'HRV Payload' });
        googleCatSelect.createEl('option', { value: 'google-hydration', text: 'Hydration Payload' });
        googleCatSelect.createEl('option', { value: 'google-nutrition', text: 'Nutrition Payload' });
        googleCatSelect.style.display = 'none';
        googleCatSelect.onchange = () => {
            this.selectedGoogleCategory = googleCatSelect.value;
        };

        const fetchResponseBtn = apiControlsRow.createEl('button', { text: 'Fetch API Response', cls: 'omni-btn' });
        
        const apiTextarea = apiContainer.createEl('textarea', { cls: 'omni-api-textarea' });
        apiTextarea.placeholder = 'Paste example API response JSON or description of the text here...';
        apiTextarea.style.width = '100%';
        apiTextarea.style.height = '120px';
        apiTextarea.onchange = (e) => {
            this.exampleInput = e.target.value;
        };

        fetchResponseBtn.onclick = async () => {
            if (!this.connectionId) {
                new obsidian.Notice("Please select an API source connection!");
                return;
            }
            fetchResponseBtn.disabled = true;
            fetchResponseBtn.setText("Fetching...");
            apiTextarea.value = "Fetching response...";
            try {
                let payload = "";
                if (this.connectionId === 'google-health') {
                    const tempT = { id: this.selectedGoogleCategory, connectionId: 'google-health', mode: 'api' };
                    payload = await this.plugin.fetchPayloadForTemplate(tempT);
                } else {
                    payload = await this.plugin.fetchFromApiConnection(this.connectionId);
                }
                apiTextarea.value = payload;
                this.exampleInput = payload;
            } catch(e) {
                apiTextarea.value = `Failed to fetch: ${e.message}`;
            } finally {
                fetchResponseBtn.disabled = false;
                fetchResponseBtn.setText("Fetch API Response");
            }
        };

        // BLE Input
        const bleContainer = document.createElement('div');
        bleContainer.className = 'omni-ble-creator-container';
        bleContainer.createEl('p', { text: 'Paired BLE device details will be automatically bound to this template.' });

        const updateInputSection = () => {
            inputSection.empty();
            if (this.mode === 'ocr') {
                previewContainer.style.display = 'none';
                dropZone.style.display = 'flex';
                inputSection.appendChild(ocrContainer);
            } else if (this.mode === 'api') {
                if (this.connectionId === 'google-health') {
                    googleCatSelect.style.display = 'inline-block';
                } else {
                    googleCatSelect.style.display = 'none';
                }
                apiTextarea.value = this.exampleInput || "";
                inputSection.appendChild(apiContainer);
            } else if (this.mode === 'ble') {
                inputSection.appendChild(bleContainer);
            }
        };

        const updateButtons = () => {
            if (this.mode === 'ble') {
                generateBtn.style.display = 'none';
                scanPayloadBtn.style.display = 'none';
                saveBtn.style.display = 'inline-block';
                statusBar.setText("Status: Configure details and click Save.");
            } else {
                generateBtn.style.display = 'inline-block';
                if (this.mode === 'api') {
                    scanPayloadBtn.style.display = 'inline-block';
                } else {
                    scanPayloadBtn.style.display = 'none';
                }
                saveBtn.style.display = 'none';
                reviewContainer.style.display = 'none';
                statusBar.setText("Status: Fill details and generate prompt.");
            }
        };

        this.pasteListener = (evt) => {
            if (this.mode !== 'ocr') return;
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

        mainContainer.createEl('h4', { text: 'Custom Instructions / Rules' });
        const instructionsTextarea = mainContainer.createEl('textarea', { cls: 'omni-api-textarea' });
        instructionsTextarea.placeholder = 'e.g. Ignore entries that are not work-related. Do not count call durations.';
        instructionsTextarea.style.width = '100%';
        instructionsTextarea.style.height = '60px';
        instructionsTextarea.onchange = (e) => {
            this.customInstructions = e.target.value;
        };

        // Scan Payload LLM Results Block
        const scanSuggestionsContainer = mainContainer.createDiv({ style: 'display:none; margin-bottom: 12px; padding: 10px; border: 1px solid var(--text-accent); border-radius: 4px; background: rgba(var(--color-accent), 0.05);' });
        scanSuggestionsContainer.createEl('h5', { text: '💡 LLM Payload Analysis & Mapping Suggestions' }).style.marginTop = '0';
        const scanSuggestionsArea = scanSuggestionsContainer.createEl('textarea');
        scanSuggestionsArea.style.width = '100%';
        scanSuggestionsArea.style.height = '120px';
        scanSuggestionsArea.readOnly = true;

        mainContainer.createEl('h4', { text: 'Desired Output Format/Appearance' });
        const targetTextarea = mainContainer.createEl('textarea', { cls: 'omni-api-textarea' });
        targetTextarea.placeholder = 'e.g. Duolingo_XP: 100\nOr: - [ ] Duolingo:: 100';
        targetTextarea.style.width = '100%';
        targetTextarea.style.height = '80px';
        targetTextarea.onchange = (e) => {
            this.targetAppearance = e.target.value;
        };

        const statusBar = mainContainer.createDiv({ cls: 'omni-status-bar', text: 'Status: Fill details and generate prompt.' });

        const reviewContainer = mainContainer.createDiv({ style: 'display:none; margin-top: 12px;' });
        reviewContainer.createEl('h4', { text: 'Generated System Instructions' });
        const promptReview = reviewContainer.createEl('textarea', { cls: 'omni-prompt-review-textarea' });
        promptReview.style.width = '100%';
        promptReview.style.height = '150px';
        promptReview.onchange = (e) => {
            this.generatedPrompt = e.target.value;
        };

        const actionRow = mainContainer.createDiv({ cls: 'omni-action-row', style: 'margin-top:16px; display:flex; gap:10px;' });
        
        const scanPayloadBtn = actionRow.createEl('button', { text: 'Scan Payload with LLM', cls: 'omni-btn' });
        scanPayloadBtn.style.display = 'none';

        const generateBtn = actionRow.createEl('button', { text: 'Generate Prompt via LLM', cls: 'omni-btn btn-process' });
        const cancelBtn = actionRow.createEl('button', { text: 'Cancel', cls: 'omni-btn btn-cancel' });
        cancelBtn.onclick = () => this.close();

        const saveBtn = actionRow.createEl('button', { text: 'Save Template', cls: 'omni-btn btn-process', style: 'display:none;' });

        scanPayloadBtn.onclick = async () => {
            if (!this.exampleInput) {
                new obsidian.Notice("Please provide example input payload first!");
                return;
            }
            scanPayloadBtn.disabled = true;
            scanPayloadBtn.setText("Scanning...");
            statusBar.setText("LLM is scanning the API response payload...");
            try {
                const provider = this.plugin.settings.templateProvider || 'gemini';
                const model = this.plugin.settings.templateModel || 'gemini-2.5-flash';
                const scanPrompt = `Scan this raw API payload and summarize all variables, metrics, and nested fields present. Suggest a clean, structured YAML Frontmatter or Dataview inline fields representation for logging these values in an Obsidian daily note. Include sample values for each field. Respond concisely.`;
                
                const response = await this.plugin.callLLM(provider, model, scanPrompt, `API Payload:\n${this.exampleInput}`);
                
                scanSuggestionsArea.value = response;
                scanSuggestionsContainer.style.display = 'block';
                statusBar.setText("Payload scanned successfully! See suggestions above.");
            } catch(e) {
                statusBar.setText("Failed to scan payload: " + e.message);
            } finally {
                scanPayloadBtn.disabled = false;
                scanPayloadBtn.setText("Scan Payload with LLM");
            }
        };

        generateBtn.onclick = async () => {
            if (!this.name) {
                new obsidian.Notice("Please enter a template name!");
                return;
            }
            if (!this.exampleInput) {
                new obsidian.Notice(`Please provide example input data for ${this.mode === 'ocr' ? 'OCR' : 'API'}!`);
                return;
            }
            if (!this.targetAppearance) {
                new obsidian.Notice("Please describe how the output should look!");
                return;
            }
            
            generateBtn.disabled = true;
            statusBar.setText("Generating template system instructions using LLM...");
            
            try {
                const res = await this.plugin.generateCustomTemplatePrompt(
                    this.name,
                    this.mode,
                    this.exampleInput,
                    this.targetAppearance,
                    this.destination,
                    this.customInstructions
                );
                
                this.generatedPrompt = res.prompt;
                this.generatedPythonCode = res.pythonCode || "";
                promptReview.value = res.prompt;
                reviewContainer.style.display = 'block';
                saveBtn.style.display = 'inline-block';
                statusBar.setText("Template prompt generated. Review and click Save.");
            } catch (err) {
                console.error(err);
                statusBar.setText("Error generating prompt: " + err.message);
            } finally {
                generateBtn.disabled = false;
            }
        };

        saveBtn.onclick = async () => {
            if (!this.name) {
                new obsidian.Notice("Please enter a template name!");
                return;
            }
            let newTemplate;
            if (this.mode === 'ble') {
                newTemplate = {
                    id: 'custom-ble-' + Date.now(),
                    name: this.name,
                    mode: 'ble',
                    destination: this.destination,
                    deviceName: this.selectedDeviceName,
                    syncStyle: this.syncStyle || 'manual',
                    syncInterval: this.syncInterval || 15,
                    metrics: [
                        {
                            name: "Battery Level",
                            characteristicUuid: "00002a19-0000-1000-8000-00805f9b34fb",
                            parser: "uint16_le",
                            destination: this.destination,
                            key: "device_battery"
                        }
                    ]
                };
            } else {
                if (!this.generatedPrompt) {
                    new obsidian.Notice("Missing generated prompt!");
                    return;
                }
                newTemplate = {
                    id: 'custom-' + Date.now(),
                    name: this.name,
                    mode: this.mode,
                    connectionId: this.connectionId,
                    destination: this.destination,
                    syncStyle: this.mode === 'ocr' ? 'manual' : (this.syncStyle || 'manual'),
                    syncInterval: this.syncInterval || 60,
                    prompt: this.generatedPrompt,
                    pythonCode: this.generatedPythonCode
                };
            }
            await this.plugin.saveCustomTemplateToVault(newTemplate, this.exampleInput, this.targetAppearance, this.customInstructions);
            new obsidian.Notice("Saved template " + this.name);
            if (this.onSave) {
                this.onSave();
            }
            this.close();
        };

        updateInputSection();
        updateButtons();
    }

    onClose() {
        if (this.pasteListener) {
            this.contentEl.removeEventListener('paste', this.pasteListener);
        }
        this.contentEl.empty();
    }
}

