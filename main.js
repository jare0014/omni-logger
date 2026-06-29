const obsidian = require('obsidian');

const DEFAULT_SETTINGS = {
    geminiApiKeyId: 'omni-logger-gemini-api-key',
    geminiApiKey: '',
    templateProvider: 'gemini',
    templateModel: 'gemini-2.5-flash',
    executorProvider: 'gemini',
    executorModel: 'gemini-2.5-flash',
    ollamaUrl: 'http://localhost:11434',
    customTemplateModel: '',
    customExecutorModel: '',
    ingredientsFolder: 'Omni_Templates',
    dataSourceApi: 'google-health',
    omniCallsInstructions: 'You are a call log analyzer. Examine this phone call logs screenshot and count the number of outgoing and incoming call entries grouped by hourly blocks from 8 AM to 4 PM for the target day. Return findings strictly in a JSON format matching this schema:\n{\n  "calls-08am": 0,\n  "calls-09am": 0,\n  "calls-10am": 0,\n  "calls-11am": 0,\n  "calls-12pm": 0,\n  "calls-01pm": 0,\n  "calls-02pm": 0,\n  "calls-03pm": 0,\n  "calls-04pm": 0\n}\nEnsure no other text is returned besides the JSON.',
    omniLumosityInstructions: 'You are a health and brain-training tracker assistant. Examine this Lumosity workout screenshot and extract the following:\n1. The time of practice (if visible, e.g. "08:15 AM". If not visible, return "Not Found").\n2. The specific game played, its corresponding category, and the score achieved.\n\nReturn findings strictly in a JSON format matching this schema:\n{\n  "start_time": "HH:MM AM/PM",\n  "scores": [\n    {\n      "game": "Game Name",\n      "category": "Category",\n      "score": 1234\n    }\n  ]\n}\nEnsure no other text is returned besides the JSON.',
    omniHealthInstructions: 'You are a health tracker assistant. Examine this health dashboard screenshot and extract sleep hours, wake up time, and heart rate variability (HRV) if visible.\n\nReturn findings strictly in a JSON format matching this schema:\n{\n  "Sleep_hours": "H:MM",\n  "wake_up": "H:MM",\n  "HRV": 55,\n  "Sleep_score": 75,\n  "Readiness": 80\n}\nEnsure no other text is returned besides the JSON.',
    customTemplates: [],
    healthSyncConfig: {
        sleep: { enabled: true, destination: "frontmatter", key: "Sleep_hours" },
        hrv: { enabled: true, destination: "frontmatter", key: "HRV" },
        caffeine: { enabled: true, destination: "frontmatter", key: "caffeine" },
        alcohol: { enabled: true, destination: "frontmatter", key: "alcohol" },
        hydration: { enabled: true, destination: "frontmatter", key: "hydration" },
        protein: { enabled: false, destination: "frontmatter", key: "protein" },
        calories: { enabled: false, destination: "frontmatter", key: "calories" }
    },
    requestedScopes: [
        "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
        "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
        "https://www.googleapis.com/auth/googlehealth.nutrition.readonly",
        "https://www.googleapis.com/auth/googlehealth.nutrition.writeonly"
    ],
    googleHealthSleepPrompt: 'Examine the raw Google Fitness API JSON payload representing my sleep sessions for today. Extract the longest sleep session and calculate the total sleep duration in hours and minutes. Your output MUST be a valid JSON object with keys like "Sleep" and "Wakeup". Do not wrap in markdown blocks. Example: { "Sleep": "7h 30m", "Wakeup": "07:00 AM" }',
    googleHealthVitalsPrompt: 'Examine the raw Google Fitness API JSON payload representing heart rate variability (HRV) for today. Extract the RMSSD or equivalent metric. Your output MUST be a valid JSON object with keys like "HRV". Example: { "HRV": 55 }',
    googleHealthNutritionPrompt: 'Examine the raw Google Fitness API JSON payload representing my food logs for today. Summarize caffeine (mg), alcohol (g), protein (g), and calories (kcal). Your output MUST be a valid JSON object with keys like "caffeine", "alcohol", "protein", "calories". Example: { "caffeine": 95, "alcohol": 0, "protein": 30, "calories": 160 }',
    googleHealthHydrationPrompt: 'Examine the raw Google Fitness API JSON payload representing hydration. Summarize total water intake in milliliters. Your output MUST be a valid JSON object with keys like "hydration". Example: { "hydration": 750 }'
};


class OmniLoggerPlugin extends obsidian.Plugin {
    async ensureVenv() {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'omni-logger');
        const venvDir = path.join(pluginDir, '.venv');
        
        if (fs.existsSync(venvDir)) {
            return;
        }
        
        new obsidian.Notice("Omni-Logger: Setting up Python virtual environment (this may take a minute)...");
        
        const { exec } = require('child_process');
        const checkPython = (cmd, cb) => {
            exec(`${cmd} --version`, (err) => cb(!err));
        };
        
        checkPython('python', (hasPython) => {
            const pyCmd = hasPython ? 'python' : 'python3';
            exec(`${pyCmd} -m venv .venv`, { cwd: pluginDir }, (err) => {
                if (err) {
                    console.error("Failed to create venv:", err);
                    new obsidian.Notice("Failed to create Python virtual environment. Please install python.");
                    return;
                }
                const isWin = os.platform() === 'win32';
                const pipCmd = isWin
                    ? `"${path.join(venvDir, 'Scripts', 'pip.exe')}" install requests pillow`
                    : `"${path.join(venvDir, 'bin', 'pip')}" install requests pillow`;
                    
                exec(pipCmd, (pipErr) => {
                    if (pipErr) {
                        console.error("Failed to install dependencies:", pipErr);
                        new obsidian.Notice("Failed to install python dependencies.");
                    } else {
                        new obsidian.Notice("Omni-Logger: Python environment ready!");
                    }
                });
            });
        });
    }

    async onload() {
        await this.loadSettings();
        await this.loadLocalSettings();
        this.ensureVenv();
        await this.loadCustomTemplatesFromVault();
        this.registerCustomTemplateCommands();

        // Register Command to Open Modal
        this.addCommand({
            id: 'open-omni-logger',
            name: 'Open Omni-Logger Modal',
            callback: () => {
                new OmniLoggerModal(this.app, this).open();
            }
        });

        // Register Command to Sync Google Health Data
        this.addCommand({
            id: 'sync-google-health',
            name: 'Sync Google Health Data',
            callback: async () => {
                try {
                    new obsidian.Notice("Starting Google Health sync...");
                    await this.pullGoogleHealthData();
                    new obsidian.Notice("Successfully synced health stats from Google API!");
                } catch (e) {
                    new obsidian.Notice("Google Health sync failed: " + e.message);
                }
            }
        });

        // Register Command to Open Food Logger & Registry
        this.addCommand({
            id: 'open-food-logger',
            name: 'Open Food Ingestion & Registry',
            callback: () => {
                new OmniFoodLoggerModal(this.app, this).open();
            }
        });

        // Register commands for meta-bind buttons
        this.addCommand({
            id: 'log-calls',
            name: 'Log Work Calls Screenshot',
            callback: () => {
                const path = require('path');
                const vaultPath = this.app.vault.adapter.getBasePath();
                const dailyFile = this.getDailyNoteFile();
                if (!dailyFile) {
                    new obsidian.Notice("Daily note not found!");
                    return;
                }
                const absoluteDailyPath = path.join(vaultPath, dailyFile.path);
                const callsTemplateDir = path.join(vaultPath, this.settings.ingredientsFolder || 'Omni_Templates', 'Work Calls');
                this.runPythonScript('log_ocr.py', `--template-dir "${callsTemplateDir}" --file "${absoluteDailyPath}"`);
            }
        });

        this.addCommand({
            id: 'log-lumosity',
            name: 'Log Lumosity Scores Screenshot',
            callback: () => {
                const path = require('path');
                const vaultPath = this.app.vault.adapter.getBasePath();
                const dailyFile = this.getDailyNoteFile();
                if (!dailyFile) {
                    new obsidian.Notice("Daily note not found!");
                    return;
                }
                const absoluteDailyPath = path.join(vaultPath, dailyFile.path);
                const lumosityTemplateDir = path.join(vaultPath, this.settings.ingredientsFolder || 'Omni_Templates', 'Lumosity');
                this.runPythonScript('log_ocr.py', `--template-dir "${lumosityTemplateDir}" --file "${absoluteDailyPath}"`);
            }
        });

        this.addCommand({
            id: 'sync-fitbit',
            name: 'Sync Fitbit/Health Data',
            callback: () => this.runPythonScript('health_checkin_wizard.py')
        });

        this.addCommand({
            id: 'hl7-nl-query',
            name: 'Run HL7 NL-to-SQL Query',
            callback: () => this.runHL7QueryScript()
        });

        this.addCommand({
            id: 'hl7-ingest-all',
            name: 'Ingest All HL7 Samples',
            callback: () => this.runHL7IngestScript()
        });

        // Start background checks for APIs
        setTimeout(() => this.checkAllConnections(), 2000);
        this.connectionCheckInterval = setInterval(() => this.checkAllConnections(), 15 * 60 * 1000);

        this.lastSyncTimes = {};
        this.bleSyncInterval = setInterval(() => this.runBackgroundBLESyncs(), 60 * 1000);

        // Register Settings Tab
        this.settingsTab = new OmniLoggerSettingTab(this.app, this);
        this.addSettingTab(this.settingsTab);

        // Hook Settings Sidebar Organizer
        const setting = this.app.setting;
        if (setting && setting.open) {
            if (!setting.open.__antigravityHooked) {
                const originalOpen = setting.open;
                const plugin = this;
                setting.open = function() {
                    const fs = require('fs');
                    const vaultPath = plugin.app.vault.adapter.getBasePath();
                    const sep = vaultPath.includes('/') ? '/' : '\\';
                    const logPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}debug_display.log`;
                    try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] Hook setting.open called\n`); } catch(e) {}
                    
                    const result = originalOpen.apply(this, arguments);
                    setTimeout(() => {
                        try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] Scheduling organizeCustomPluginsSidebar\n`); } catch(e) {}
                        
                        // Dynamically call sidebar organizers for all loaded custom plugins
                        const activeOmni = plugin.app.plugins.getPlugin('omni-logger');
                        if (activeOmni && typeof activeOmni.organizeCustomPluginsSidebar === 'function') {
                            activeOmni.organizeCustomPluginsSidebar();
                        }
                        const activeTimer = plugin.app.plugins.getPlugin('schedule-assistant-focus-timer');
                        if (activeTimer && typeof activeTimer.organizeCustomPluginsSidebar === 'function') {
                            activeTimer.organizeCustomPluginsSidebar();
                        }
                    }, 50);
                    return result;
                };
                setting.open.__antigravityHooked = true;
                setting.open.__originalOpen = originalOpen;
            }
        }
    }

    registerCustomTemplateCommands() {
        const path = require('path');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const folderName = this.settings.ingredientsFolder || 'Omni_Templates';
        
        for (const t of this.settings.customTemplates) {
            this.addCommand({
                id: `run-template-${t.id}`,
                name: `Sync BLE/Metrics: ${t.name}`,
                callback: () => {
                    if (t.mode === 'ble') {
                        const cleanDirName = t.name.replace(/[^a-zA-Z0-9 _-]/g, '');
                        const absoluteTemplatePath = path.join(vaultPath, folderName, cleanDirName);
                        
                        const dailyFile = this.getDailyNoteFile();
                        if (!dailyFile) {
                            new obsidian.Notice("Daily note not found!");
                            return;
                        }
                        const absoluteDailyPath = path.join(vaultPath, dailyFile.path);
                        
                        new obsidian.Notice(`Starting BLE sync for ${t.name}...`);
                        this.runPythonScript('log_ble.py', `--template-dir "${absoluteTemplatePath}" --file "${absoluteDailyPath}"`);
                    } else if (t.mode === 'connection') {
                        const cleanDirName = t.name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
                        const dirFolderName = cleanDirName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                        const connectionFolder = path.join(vaultPath, '99_System', 'Omni_Connections', dirFolderName);
                        
                        const dailyFile = this.getDailyNoteFile();
                        if (!dailyFile) {
                            new obsidian.Notice("Daily note not found!");
                            return;
                        }
                        const absoluteDailyPath = path.join(vaultPath, dailyFile.path);
                        
                        new obsidian.Notice(`Executing API caller for ${t.name}...`);
                        this.runPythonScript(path.join(connectionFolder, 'caller.py'), "", true).then(() => {
                            new obsidian.Notice(`Mapping metrics for ${t.name}...`);
                            return this.runPythonScript(path.join(connectionFolder, 'sync.py'), `"${absoluteDailyPath}"`, true);
                        }).then(() => {
                            new obsidian.Notice(`Sync complete for ${t.name}!`);
                        }).catch(err => {
                            new obsidian.Notice(`Connection sync failed for ${t.name}: ${err.message}`);
                        });
                    } else {
                        const modal = new OmniLoggerModal(this.app, this);
                        modal.selectedType = t.id;
                        modal.selectedMode = t.mode;
                        modal.open();
                    }
                }
            });
        }
    }

    onunload() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }
        if (this.bleSyncInterval) {
            clearInterval(this.bleSyncInterval);
        }
        if (this.statusBarEl) {
            this.statusBarEl.remove();
        }
    }

    getGoogleTokenPath() {
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        return `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}token.json`;
    }

    async loadCustomTemplatesFromVault() {
        const fs = require('fs');
        const path = require('path');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const folderName = this.settings.ingredientsFolder || 'Omni_Templates';
        const templatesPath = path.join(vaultPath, folderName);
        
        if (!fs.existsSync(templatesPath)) {
            try {
                fs.mkdirSync(templatesPath, { recursive: true });
            } catch(e) {
                console.error("Failed to create templates folder:", e);
                return;
            }
        }
        
        const templates = [];
        try {
            const dirs = fs.readdirSync(templatesPath, { withFileTypes: true });
            for (const dirent of dirs) {
                if (dirent.isDirectory()) {
                    const templateName = dirent.name;
                    const dirPath = path.join(templatesPath, templateName);
                    
                    const promptPath = path.join(dirPath, 'system_prompt.txt');
                    const outputExamplePath = path.join(dirPath, 'output_example.json');
                    const inputExampleTextPath = path.join(dirPath, 'input_example.txt');
                    const inputExamplePngPath = path.join(dirPath, 'input_example.png');
                    const instructionsPath = path.join(dirPath, 'instructions.txt');
                    
                    const metaPath = path.join(dirPath, 'metadata.json');
                    let metadata = { destination: 'frontmatter', id: 'custom-' + Date.now() };
                    if (fs.existsSync(metaPath)) {
                        try {
                            metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                        } catch(e) {}
                    }
                    
                    let prompt = "";
                    if (fs.existsSync(promptPath)) {
                        prompt = fs.readFileSync(promptPath, 'utf8').trim();
                    } else if (metadata.prompt) {
                        prompt = metadata.prompt;
                    }
                    
                    if (prompt || metadata.mode === 'ble') {
                        let instructions = "";
                        if (fs.existsSync(instructionsPath)) {
                            instructions = fs.readFileSync(instructionsPath, 'utf8').trim();
                        } else if (metadata.instructions) {
                            instructions = metadata.instructions;
                        }
                        
                        let destination = metadata.destination || "frontmatter";
                        let mode = metadata.mode || "api";
                        let exampleInput = "";
                        let targetAppearance = "";
                        
                        if (fs.existsSync(outputExamplePath)) {
                            try {
                                const outJson = JSON.parse(fs.readFileSync(outputExamplePath, 'utf8'));
                                targetAppearance = outJson.targetAppearance || '';
                            } catch(e) {}
                        } else if (metadata.targetAppearance) {
                            targetAppearance = metadata.targetAppearance;
                        }
                        
                        if (fs.existsSync(inputExamplePngPath)) {
                            mode = "ocr";
                            const imgBuffer = fs.readFileSync(inputExamplePngPath);
                            exampleInput = `data:image/png;base64,${imgBuffer.toString('base64')}`;
                        } else if (fs.existsSync(inputExampleTextPath)) {
                            mode = "api";
                            exampleInput = fs.readFileSync(inputExampleTextPath, 'utf8').trim();
                        } else if (metadata.exampleInput) {
                            exampleInput = metadata.exampleInput;
                        }
                        
                        const tObj = Object.assign({
                            id: metadata.id || 'custom-' + templateName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                            name: templateName,
                            mode: mode,
                            destination: destination,
                            prompt: prompt,
                            instructions: instructions,
                            exampleInput: exampleInput,
                            targetAppearance: targetAppearance
                        }, metadata);
                        templates.push(tObj);
                    }
                }
            }
        } catch (e) {
            console.error("Failed to read templates from vault:", e);
        }
        
        this.settings.customTemplates = templates;
    }

    async saveCustomTemplateToVault(template, exampleInput, targetAppearance, instructions) {
        const fs = require('fs');
        const path = require('path');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const folderName = this.settings.ingredientsFolder || 'Omni_Templates';
        
        const cleanName = template.name.replace(/[^a-zA-Z0-9 _-]/g, '');
        const dirPath = path.join(vaultPath, folderName, cleanName);
        
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        // Save prompt
        fs.writeFileSync(path.join(dirPath, 'system_prompt.txt'), template.prompt, 'utf8');
        
        // Save instructions
        fs.writeFileSync(path.join(dirPath, 'instructions.txt'), instructions || '', 'utf8');
        
        // Save example input
        if (template.mode === 'ocr' && exampleInput && exampleInput.startsWith('data:')) {
            const base64Data = exampleInput.split(',')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(path.join(dirPath, 'input_example.png'), buffer);
        } else if (exampleInput) {
            fs.writeFileSync(path.join(dirPath, 'input_example.txt'), exampleInput, 'utf8');
        }
        
        // Save expected output appearance
        fs.writeFileSync(path.join(dirPath, 'output_example.json'), JSON.stringify({ targetAppearance: targetAppearance || '' }, null, 2), 'utf8');
        
        // Save metadata
        const metadata = {
            id: template.id,
            destination: template.destination,
            mode: template.mode
        };
        if (template.mode === 'ble') {
            metadata.macAddress = template.macAddress;
            metadata.useLoraxHandshake = template.useLoraxHandshake || false;
            metadata.commandUuid = template.commandUuid;
            metadata.responseUuid = template.responseUuid;
            metadata.handshakeKeyBase64 = template.handshakeKeyBase64;
            metadata.metrics = template.metrics;
            metadata.syncStyle = template.syncStyle || "manual";
            metadata.syncInterval = template.syncInterval || 15;
        }
        fs.writeFileSync(path.join(dirPath, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
        
        await this.updateMetaBindButton(template);
        
        // Reload templates
        await this.loadCustomTemplatesFromVault();
    }

    async deleteCustomTemplateFromVault(templateName) {
        const fs = require('fs');
        const path = require('path');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const folderName = this.settings.ingredientsFolder || 'Omni_Templates';
        
        const cleanName = templateName.replace(/[^a-zA-Z0-9 _-]/g, '');
        const dirPath = path.join(vaultPath, folderName, cleanName);
        
        const template = this.settings.customTemplates?.find(t => t.name === templateName);
        if (template) {
            await this.removeMetaBindButton(template.id);
        }
        
        if (fs.existsSync(dirPath)) {
            try {
                if (fs.rmSync) {
                    fs.rmSync(dirPath, { recursive: true, force: true });
                } else {
                    fs.rmdirSync(dirPath, { recursive: true });
                }
            } catch(e) {
                console.error("Failed to delete template folder:", e);
            }
        }
        
        await this.loadCustomTemplatesFromVault();
    }

    async updateMetaBindButton(t) {
        const fs = require('fs');
        const path = require('path');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const metaBindPath = path.join(vaultPath, '.obsidian', 'plugins', 'obsidian-meta-bind-plugin', 'data.json');
        
        if (!fs.existsSync(metaBindPath)) return;
        
        try {
            const data = JSON.parse(fs.readFileSync(metaBindPath, 'utf8'));
            if (!data.buttonTemplates) data.buttonTemplates = [];
            
            const label = t.mode === 'ble' ? `Sync ${t.name}` : `Log ${t.name}`;
            const icon = t.mode === 'ble' ? 'battery-charging' : 'clipboard-list';
            const tooltip = t.mode === 'ble' ? `Sync BLE metrics for ${t.name}` : `Open logger for ${t.name}`;

            if (!existing) {
                existing = {
                    label: label,
                    icon: icon,
                    style: "primary",
                    class: "",
                    cssStyle: "",
                    backgroundImage: "",
                    tooltip: tooltip,
                    id: btnId,
                    hidden: false,
                    actions: [
                        {
                            type: "command",
                            command: `omni-logger:run-template-${t.id}`
                        }
                    ]
                };
                data.buttonTemplates.push(existing);
            } else {
                existing.label = label;
                existing.icon = icon;
                existing.tooltip = tooltip;
                existing.actions = [
                    {
                        type: "command",
                        command: `omni-logger:run-template-${t.id}`
                    }
                ];
            }
            
            fs.writeFileSync(metaBindPath, JSON.stringify(data, null, 2), 'utf8');
            new obsidian.Notice(`Meta Bind button "${btnId}" template synchronized!`);
        } catch (e) {
            console.error("Failed to update Meta Bind button:", e);
        }
    }

    async removeMetaBindButton(id) {
        const fs = require('fs');
        const path = require('path');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const metaBindPath = path.join(vaultPath, '.obsidian', 'plugins', 'obsidian-meta-bind-plugin', 'data.json');
        
        if (!fs.existsSync(metaBindPath)) return;
        
        try {
            const data = JSON.parse(fs.readFileSync(metaBindPath, 'utf8'));
            if (!data.buttonTemplates) return;
            
            const btnId = `${id}-btn`;
            const initialLen = data.buttonTemplates.length;
            data.buttonTemplates = data.buttonTemplates.filter(b => b.id !== btnId);
            
            if (data.buttonTemplates.length < initialLen) {
                fs.writeFileSync(metaBindPath, JSON.stringify(data, null, 2), 'utf8');
                new obsidian.Notice(`Removed Meta Bind button template "${btnId}".`);
            }
        } catch (e) {
            console.error("Failed to remove Meta Bind button:", e);
        }
    }

    async runBackgroundBLESyncs() {
        if (this.localSettings && this.localSettings.enableBLESync === false) {
            return;
        }
        const path = require('path');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const folderName = this.settings.ingredientsFolder || 'Omni_Templates';
        
        for (const t of this.settings.customTemplates) {
            if (t.mode === 'ble' && t.syncStyle === 'automatic') {
                const intervalMinutes = t.syncInterval || 15;
                const lastSync = this.lastSyncTimes[t.id] || 0;
                const now = Date.now();
                
                if (now - lastSync >= intervalMinutes * 60 * 1000) {
                    this.lastSyncTimes[t.id] = now;
                    const cleanDirName = t.name.replace(/[^a-zA-Z0-9 _-]/g, '');
                    const absoluteTemplatePath = path.join(vaultPath, folderName, cleanDirName);
                    
                    const dailyFile = this.getDailyNoteFile();
                    if (!dailyFile) continue;
                    
                    const absoluteDailyPath = path.join(vaultPath, dailyFile.path);
                    console.log(`[Omni-Logger] Automatic background BLE sync triggered for template "${t.name}" (MAC: ${t.macAddress})`);
                    this.runPythonScript('log_ble.py', `--template-dir "${absoluteTemplatePath}" --file "${absoluteDailyPath}"`, true);
                }
            }
        }
    }

    async callLLM(provider, model, systemPrompt, promptText, imageBase64 = null, imageMimeType = null) {
        if (provider === 'gemini') {
            let apiKey = await this.getSecret(this.settings.geminiApiKeyId || 'omni-logger-gemini-api-key', 'geminiApiKey');
            if (!apiKey) {
                apiKey = await this.getSecret('timeblocker-gemini-api-key', 'geminiApiKey');
            }
            if (!apiKey) {
                throw new Error("Gemini API Key not configured! Please configure it in settings.");
            }
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const parts = [];
            
            if (promptText) {
                parts.push({ text: promptText });
            }
            if (imageBase64 && imageMimeType) {
                parts.push({
                    inlineData: {
                        mimeType: imageMimeType,
                        data: imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64
                    }
                });
            }
            
            const payload = {
                contents: [{ parts: parts }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            };
            if (systemPrompt) {
                payload.systemInstruction = {
                    parts: [{ text: systemPrompt }]
                };
            }
            
            const response = await obsidian.requestUrl({
                url: url,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.status !== 200) {
                throw new Error(`Gemini API error ${response.status}: ${response.text}`);
            }
            
            const resData = response.json;
            return resData.candidates[0].content.parts[0].text.trim();
            
        } else if (provider === 'ollama') {
            const ollamaUrl = this.settings.ollamaUrl || 'http://localhost:11434';
            const url = `${ollamaUrl}/api/generate`;
            
            const payload = {
                model: model,
                system: systemPrompt || "",
                prompt: promptText || "",
                stream: false,
                format: "json"
            };
            
            if (imageBase64) {
                const base64Data = imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64;
                payload.images = [base64Data];
            }
            
            const response = await obsidian.requestUrl({
                url: url,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.status !== 200) {
                throw new Error(`Ollama API error ${response.status}: ${response.text}`);
            }
            
            const resData = response.json;
            return resData.response.trim();
        } else {
            throw new Error(`Unsupported LLM provider: ${provider}`);
        }
    }

    async checkAllConnections() {
        const statuses = {
            gemini: { name: 'Gemini API', ok: false, msg: 'Not checked' },
            ollama: { name: 'Ollama Server', ok: true, msg: 'Not active' },
            googleHealth: { name: 'Google Health API', ok: false, msg: 'Not checked' },
            googleWorkspace: { name: 'Google Calendar/Tasks', ok: false, msg: 'Not checked' },
            todoist: { name: 'Todoist API', ok: false, msg: 'Not checked' },
            notebooklm: { name: 'NotebookLM CLI', ok: false, msg: 'Not checked' }
        };

        const requestWithTimeout = async (params, timeoutMs = 2500) => {
            return Promise.race([
                obsidian.requestUrl(params),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
            ]);
        };
        
        // 1. Gemini
        let geminiKey = await this.getSecret(this.settings.geminiApiKeyId || 'omni-logger-gemini-api-key', 'geminiApiKey');
        if (!geminiKey) {
            geminiKey = await this.getSecret('timeblocker-gemini-api-key', 'geminiApiKey');
        }
        if (!geminiKey) {
            statuses.gemini = { name: 'Gemini API', ok: false, msg: 'Missing Key' };
        } else {
            try {
                const res = await requestWithTimeout({
                    url: `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
                    method: 'GET'
                });
                if (res.status === 200) {
                    statuses.gemini = { name: 'Gemini API', ok: true, msg: 'Connected' };
                } else {
                    statuses.gemini = { name: 'Gemini API', ok: false, msg: 'Invalid Key' };
                }
            } catch(e) {
                statuses.gemini = { name: 'Gemini API', ok: false, msg: 'Connection Error / Timeout' };
            }
        }
        
        // 2. Ollama
        const useOllama = (this.settings.templateProvider === 'ollama' || this.settings.executorProvider === 'ollama');
        if (useOllama) {
            const ollamaUrl = this.settings.ollamaUrl || 'http://localhost:11434';
            try {
                const res = await requestWithTimeout({
                    url: `${ollamaUrl}/api/tags`,
                    method: 'GET'
                });
                if (res.status === 200) {
                    statuses.ollama = { name: 'Ollama Server', ok: true, msg: 'Connected' };
                } else {
                    statuses.ollama = { name: 'Ollama Server', ok: false, msg: 'Unavailable' };
                }
            } catch(e) {
                statuses.ollama = { name: 'Ollama Server', ok: false, msg: 'Offline / Timeout' };
            }
        }
        
        // 3. Google Health (Omni-Logger)
        const fs = require('fs');
        const path = require('path');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const healthTokenPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}token.json`;
        if (this.settings.dataSourceApi === 'google-health') {
            if (!fs.existsSync(healthTokenPath)) {
                statuses.googleHealth = { name: 'Google Health API', ok: false, msg: 'Disconnected' };
            } else {
                try {
                    const token = await this.getGoogleAccessToken();
                    const now = new Date();
                    const startTime = new Date();
                    startTime.setDate(now.getDate() - 1);
                    const filter = `sleep.interval.end_time >= "${startTime.toISOString()}" AND sleep.interval.end_time < "${now.toISOString()}"`;
                    const url = `https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints?filter=${encodeURIComponent(filter)}&pageSize=1`;
                    const res = await requestWithTimeout({
                        url: url,
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.status === 200) {
                        statuses.googleHealth = { name: 'Google Health API', ok: true, msg: 'Connected' };
                    } else {
                        statuses.googleHealth = { name: 'Google Health API', ok: false, msg: 'Auth Expired' };
                    }
                } catch(e) {
                    statuses.googleHealth = { name: 'Google Health API', ok: false, msg: 'Auth Error / Timeout' };
                }
            }
        } else {
            statuses.googleHealth = { name: 'Google Health API', ok: true, msg: 'Not Enabled' };
        }
        
        // 4. Google Workspace & 5. Todoist (Schedule Assistant)
        const schedulePlugin = this.app.plugins.getPlugin('schedule-assistant-focus-timer');
        if (schedulePlugin) {
            // Google Workspace
            const scheduleTokenPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}schedule-assistant-focus-timer${sep}token.json`;
            if (!fs.existsSync(scheduleTokenPath)) {
                statuses.googleWorkspace = { name: 'Google Calendar/Tasks', ok: false, msg: 'Disconnected' };
            } else {
                try {
                    const token = await schedulePlugin.getGoogleAccessToken();
                    const res = await requestWithTimeout({
                        url: `https://www.googleapis.com/tasks/v1/users/@me/lists`,
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.status === 200) {
                        statuses.googleWorkspace = { name: 'Google Calendar/Tasks', ok: true, msg: 'Connected' };
                    } else {
                        statuses.googleWorkspace = { name: 'Google Calendar/Tasks', ok: false, msg: 'Auth Expired / Error' };
                    }
                } catch(e) {
                    statuses.googleWorkspace = { name: 'Google Calendar/Tasks', ok: false, msg: 'Auth Error / Timeout' };
                }
            }
            
            // Todoist
            const tokenVal = await this.app.secretStorage.getSecret('timeblocker-todoist-token') || "";
            if (!tokenVal) {
                statuses.todoist = { name: 'Todoist API', ok: false, msg: 'Missing Token' };
            } else {
                try {
                    const res = await requestWithTimeout({
                        url: `https://api.todoist.com/api/v1/tasks?limit=1`,
                        method: 'GET',
                        headers: { 'Authorization': `Bearer ${tokenVal}` }
                    });
                    if (res.status === 200) {
                        statuses.todoist = { name: 'Todoist API', ok: true, msg: 'Connected' };
                    } else {
                        statuses.todoist = { name: 'Todoist API', ok: false, msg: 'Invalid Token' };
                    }
                } catch(e) {
                    statuses.todoist = { name: 'Todoist API', ok: false, msg: 'Offline / Timeout' };
                }
            }
        } else {
            statuses.googleWorkspace = { name: 'Google Calendar/Tasks', ok: true, msg: 'Plugin Disabled' };
            statuses.todoist = { name: 'Todoist API', ok: true, msg: 'Plugin Disabled' };
        }
        
        // 6. NotebookLM (Knowledge Pipeline)
        const kpPlugin = this.app.plugins.getPlugin('knowledge-pipeline');
        if (kpPlugin) {
            const sessionJson = await this.app.secretStorage.getSecret('knowledge-pipeline-notebooklm-session') || '';
            if (!sessionJson) {
                statuses.notebooklm = { name: 'NotebookLM CLI', ok: true, msg: 'Not Logged In' };
            } else {
                try {
                    const child_process = require('child_process');
                    const env = Object.assign({}, process.env, { NOTEBOOKLM_AUTH_JSON: sessionJson });
                    const isOk = await new Promise((resolve) => {
                        child_process.exec('notebooklm list --json', { env: env, timeout: 10000 }, (err, stdout, stderr) => {
                            const output = (stdout || '') + (stderr || '');
                            if (err || output.toLowerCase().includes('not logged in') || output.toLowerCase().includes('expired')) {
                                resolve(false);
                            } else {
                                resolve(true);
                            }
                        });
                    });
                    if (isOk) {
                        statuses.notebooklm = { name: 'NotebookLM CLI', ok: true, msg: 'Connected' };
                    } else {
                        statuses.notebooklm = { name: 'NotebookLM CLI', ok: false, msg: 'Session Expired' };
                    }
                } catch(e) {
                    statuses.notebooklm = { name: 'NotebookLM CLI', ok: false, msg: 'Offline / Timeout' };
                }
            }
        } else {
            statuses.notebooklm = { name: 'NotebookLM CLI', ok: true, msg: 'Plugin Disabled' };
        }
        
        // Compute active alerts
        const alerts = [];
        for (const key of Object.keys(statuses)) {
            if (!statuses[key].ok) {
                alerts.push(`${statuses[key].name}: ${statuses[key].msg}`);
            }
        }
        
        // Update Status Bar UI
        this.updateStatusBarUI(alerts, statuses);
    }

    updateStatusBarUI(alerts, statuses) {
        if (!this.statusBarEl) {
            this.statusBarEl = this.addStatusBarItem();
        }
        
        this.statusBarEl.empty();
        const container = this.statusBarEl.createDiv({ cls: 'omni-status-bar-item' });
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.cursor = 'pointer';
        
        if (alerts.length > 0) {
            container.innerHTML = `<span style="color:#ff453a; margin-right:4px;">⚠️</span> <span style="font-weight:500; color:#ff453a;">${alerts.length} API Alert${alerts.length > 1 ? 's' : ''}</span>`;
            this.statusBarEl.setAttribute('title', `API Errors:\n- ${alerts.join('\n- ')}\n\nClick to show details.`);
        } else {
            container.innerHTML = `<span style="color:#30d158; margin-right:4px;">✓</span> <span style="color:var(--text-muted); font-size: 0.9em; font-weight: 500;">API Online</span>`;
            this.statusBarEl.setAttribute('title', 'All APIs Connected:\n' + Object.keys(statuses).map(k => `- ${statuses[k].name}: ${statuses[k].msg}`).join('\n'));
        }
        
        container.onclick = () => {
            if (alerts.length > 0) {
                new obsidian.Notice(`API Connection Alert Details:\n\n${alerts.join('\n')}\n\nPlease open settings to re-authenticate.`, 6000);
            } else {
                new obsidian.Notice("All API connections are healthy!", 3000);
            }
        };
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async loadLocalSettings() {
        const fs = require('fs');
        const path = require('path');
        const pluginDir = path.join(this.app.vault.adapter.getBasePath(), '.obsidian', 'plugins', 'omni-logger');
        const localSettingsPath = path.join(pluginDir, 'local-settings.json');
        
        this.localSettings = {
            enableBLESync: true
        };
        
        if (fs.existsSync(localSettingsPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
                this.localSettings = Object.assign(this.localSettings, data);
            } catch (e) {
                console.error("[Omni-Logger] Failed to load local-settings.json:", e);
            }
        }
    }

    async saveLocalSettings() {
        const fs = require('fs');
        const path = require('path');
        const pluginDir = path.join(this.app.vault.adapter.getBasePath(), '.obsidian', 'plugins', 'omni-logger');
        const localSettingsPath = path.join(pluginDir, 'local-settings.json');
        
        try {
            fs.writeFileSync(localSettingsPath, JSON.stringify(this.localSettings, null, 2), 'utf8');
        } catch (e) {
            console.error("[Omni-Logger] Failed to save local-settings.json:", e);
        }
    }

    async getSecret(secretId, fallbackSettingKey) {
        const fs = require('fs');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const logPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}debug_display.log`;
        try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Keychain] getSecret called for ${secretId}\n`); } catch(e) {}
        
        if (this.app.secretStorage) {
            try {
                const val = await this.app.secretStorage.getSecret(secretId) || "";
                try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Keychain] getSecret from secretStorage got length ${val.length}\n`); } catch(e) {}
                return val;
            } catch (e) {
                try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Keychain] getSecret from secretStorage failed: ${e.message}\n`); } catch(e) {}
                console.error(`Failed to get secret ${secretId} from secretStorage:`, e);
            }
        }
        const val = this.settings[fallbackSettingKey] || "";
        try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Keychain] getSecret fallback returned length ${val.length}\n`); } catch(e) {}
        return val;
    }

    async setSecret(secretId, fallbackSettingKey, value) {
        const fs = require('fs');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const logPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}debug_display.log`;
        try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Keychain] setSecret called for ${secretId} value-length=${value.length}\n`); } catch(e) {}
        
        if (this.app.secretStorage) {
            try {
                if(typeof this.app.secretStorage.storeSecret === 'function') { await this.app.secretStorage.storeSecret(secretId, value); } else { await this.app.secretStorage.setSecret(secretId, value); }
                try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Keychain] setSecret in secretStorage done\n`); } catch(e) {}
                this.settings[fallbackSettingKey] = "";
                await this.saveSettings();
                return;
            } catch (e) {
                try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Keychain] setSecret in secretStorage failed: ${e.message}\n`); } catch(e) {}
                console.error(`Failed to set secret ${secretId} in secretStorage:`, e);
            }
        }
        this.settings[fallbackSettingKey] = value;
        try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Keychain] setSecret fallback done\n`); } catch(e) {}
        await this.saveSettings();
    }

    getDailyNoteFile() {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile && activeFile.path.startsWith('02_Journal/01_Daily/') && activeFile.name.endsWith('.md')) {
            return activeFile;
        }
        if (activeFile && /^\d{4}-\d{2}-\d{2}\.md$/.test(activeFile.name)) {
            return activeFile;
        }
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const path = `02_Journal/01_Daily/${year}-${month}-${day}.md`;
        return this.app.vault.getAbstractFileByPath(path);
    }

    async getGoogleAccessToken() {
        const fs = require('fs');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        
        // Check local plugin token path first
        let tokenPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}token.json`;
        if (!fs.existsSync(tokenPath)) {
            // Fallback to schedule assistant token path
            tokenPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}schedule-assistant-focus-timer${sep}token.json`;
        }
        
        if (!fs.existsSync(tokenPath)) {
            throw new Error("Google authentication token.json not found. Please run authorization from the schedule assistant.");
        }
        
        let tokenData;
        try {
            tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        } catch (e) {
            throw new Error(`Failed to parse token.json: ${e.message}`);
        }
        
        const expiry = new Date(tokenData.expiry);
        const now = new Date();
        
        if (expiry.getTime() - now.getTime() > 60000) {
            return tokenData.token;
        }
        
        console.log("Google access token expired. Refreshing...");
        const url = tokenData.token_uri || 'https://oauth2.googleapis.com/token';
        
        const bodyDetails = {
            grant_type: 'refresh_token',
            client_id: tokenData.client_id,
            client_secret: tokenData.client_secret,
            refresh_token: tokenData.refresh_token
        };
        const body = Object.keys(bodyDetails)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(bodyDetails[key]))
            .join('&');
            
        const response = await Promise.race([
            obsidian.requestUrl({
                url: url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Google OAuth token refresh timed out")), 5000))
        ]);
        
        if (response.status !== 200) {
            throw new Error(`Failed to refresh Google API access token. HTTP Status ${response.status}`);
        }
        
        const data = response.json;
        tokenData.token = data.access_token;
        if (data.expires_in) {
            const newExpiry = new Date();
            newExpiry.setSeconds(newExpiry.getSeconds() + data.expires_in);
            tokenData.expiry = newExpiry.toISOString();
        }
        
        try {
            fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2), 'utf8');
        } catch (e) {
            console.error("Failed to update token.json:", e);
        }
        
        return tokenData.token;
    }

    async pullGoogleHealthData() {
        const token = await this.getGoogleAccessToken();
        if (!token) {
            throw new Error("Failed to get Google API Access Token. Please authorize first.");
        }
        
        const now = new Date();
        const startTime = new Date();
        startTime.setDate(now.getDate() - 1);
        startTime.setHours(12, 0, 0, 0);
        
        const endTime = new Date();
        endTime.setHours(12, 0, 0, 0);
        
        const startIso = startTime.toISOString();
        const endIso = endTime.toISOString();
        
        // 1. Fetch Sleep
        const filter = `sleep.interval.end_time >= "${startIso}" AND sleep.interval.end_time < "${endIso}"`;
        const sleepUrl = `https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints?filter=${encodeURIComponent(filter)}`;
        
        console.log(`Pulling Google Health sleep data: ${sleepUrl}`);
        const response = await obsidian.requestUrl({
            url: sleepUrl,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status !== 200) {
            throw new Error(`Google Health API returned status ${response.status}: ${response.text}`);
        }
        
        const data = response.json;
        const points = data.dataPoints || [];
        
        if (points.length === 0) {
            throw new Error("No sleep data found in Google Health/Fit for today (last data was May 17). Please verify your device is syncing to Google Fit.");
        }
        
        // Sort points by end_time descending
        points.sort((a, b) => new Date(b.sleep.interval.endTime) - new Date(a.sleep.interval.endTime));
        const mainSleep = points[0].sleep;
        
        const totalMinutes = mainSleep.summary ? parseInt(mainSleep.summary.minutesAsleep || 0, 10) : 0;
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const sleepHoursStr = `${hours}:${String(mins).padStart(2, '0')}`;
        
        const wakeUpDate = new Date(mainSleep.interval.endTime);
        const wakeUpStr = `${wakeUpDate.getHours()}:${String(wakeUpDate.getMinutes()).padStart(2, '0')}`;
        
        let hrvVal = null;
        
        // 2. Fetch HRV
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const nextDate = new Date(now);
        nextDate.setDate(now.getDate() + 1);
        const nextYear = nextDate.getFullYear();
        const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
        const nextDay = String(nextDate.getDate()).padStart(2, '0');
        const nextDateStr = `${nextYear}-${nextMonth}-${nextDay}`;
        
        const hrvFilter = `daily_heart_rate_variability.date >= "${dateStr}" AND daily_heart_rate_variability.date < "${nextDateStr}"`;
        const hrvUrl = `https://health.googleapis.com/v4/users/me/dataTypes/daily-heart-rate-variability/dataPoints?filter=${encodeURIComponent(hrvFilter)}`;
        
        console.log(`Pulling Google Health HRV data: ${hrvUrl}`);
        try {
            const hrvResponse = await obsidian.requestUrl({
                url: hrvUrl,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (hrvResponse.status === 200) {
                const hrvData = hrvResponse.json;
                const hrvPoints = hrvData.dataPoints || [];
                if (hrvPoints.length > 0) {
                    const valObj = hrvPoints[0].dailyHeartRateVariability || {};
                    const rmssd = valObj.averageHeartRateVariabilityMilliseconds || valObj.deepSleepRootMeanSquareOfSuccessiveDifferencesMilliseconds || 0;
                    hrvVal = String(Math.round(rmssd));
                }
            }
        } catch(e) {
            console.error("Failed to pull HRV from Google Health API:", e);
        }
        
        const dailyFile = this.getDailyNoteFile();
        if (!dailyFile) {
            throw new Error("Daily note not found!");
        }
        
        const content = await this.app.vault.read(dailyFile);
        
        const syncConfig = this.settings.healthSyncConfig || DEFAULT_SETTINGS.healthSyncConfig;
        const yamlUpdates = {};
        const dataviewUpdates = {};
        const appendUpdates = {};
        
        // Process Sleep
        const sleepCfg = syncConfig.sleep || { enabled: true, destination: "frontmatter", key: "Sleep_hours" };
        if (sleepCfg.enabled) {
            const sDest = sleepCfg.destination || 'frontmatter';
            const sKey = sleepCfg.key || 'Sleep_hours';
            
            if (sDest === 'frontmatter') {
                yamlUpdates[sKey] = sleepHoursStr;
                yamlUpdates['wake_up'] = wakeUpStr;
            } else if (sDest === 'dataview') {
                dataviewUpdates[sKey] = sleepHoursStr;
                dataviewUpdates['wake_up'] = wakeUpStr;
            } else if (sDest === 'append-log') {
                appendUpdates[sKey] = sleepHoursStr;
                appendUpdates['wake_up'] = wakeUpStr;
            }
        }
        
        // Process HRV
        if (hrvVal) {
            const hrvCfg = syncConfig.hrv || { enabled: true, destination: "frontmatter", key: "HRV" };
            if (hrvCfg.enabled) {
                const hDest = hrvCfg.destination || 'frontmatter';
                const hKey = hrvCfg.key || 'HRV';
                
                if (hDest === 'frontmatter') {
                    yamlUpdates[hKey] = hrvVal;
                } else if (hDest === 'dataview') {
                    dataviewUpdates[hKey] = hrvVal;
                } else if (hDest === 'append-log') {
                    appendUpdates[hKey] = hrvVal;
                }
            }
        }
        
        let updatedContent = content;
        if (Object.keys(yamlUpdates).length > 0) {
            updatedContent = this.updateFrontmatterProperties(updatedContent, yamlUpdates);
        }
        if (Object.keys(dataviewUpdates).length > 0) {
            updatedContent = this.updateDataviewFields(updatedContent, dataviewUpdates);
        }
        if (Object.keys(appendUpdates).length > 0) {
            updatedContent = this.appendToBottomLog(updatedContent, appendUpdates);
        }
        
        await this.app.vault.modify(dailyFile, updatedContent);
        console.log(`Google Health Pull Success: Sleep hours ${sleepHoursStr}, Wake up time ${wakeUpStr}, HRV ${hrvVal || "N/A"}`);
    }

    async processOCR(base64Data, mimeType, type) {
        let prompt = "";
        const customTemplate = this.settings.customTemplates?.find(t => t.id === type);
        
        if (type === 'calls') {
            prompt = this.settings.omniCallsInstructions;
        } else if (type === 'lumosity') {
            prompt = this.settings.omniLumosityInstructions;
        } else if (type === 'health') {
            prompt = this.settings.omniHealthInstructions;
        } else if (customTemplate) {
            prompt = customTemplate.prompt;
        }
        
        const provider = this.settings.executorProvider || 'gemini';
        const model = this.settings.executorModel || 'gemini-2.5-flash';
        
        const textResponse = await this.callLLM(
            provider,
            model,
            prompt,
            "Extract metrics from this screenshot.",
            base64Data,
            mimeType
        );
        
        const data = JSON.parse(textResponse);
        
        const dailyFile = this.getDailyNoteFile();
        if (!dailyFile) {
            throw new Error("Daily note not found!");
        }
        
        let content = await this.app.vault.read(dailyFile);
        
        if (type === 'calls') {
            content = this.updateCallsInContent(content, data);
        } else if (type === 'lumosity') {
            const startTime = data.start_time || "08:00 AM";
            const scores = data.scores || [];
            content = this.updateLumosityInContent(content, startTime, scores);
        } else if (type === 'health') {
            content = this.updateFrontmatterProperties(content, data);
        } else if (customTemplate) {
            await this.writeCustomTemplateData(data, customTemplate);
            return;
        }
        
        await this.app.vault.modify(dailyFile, content);
    }

    async processCustomAPI(inputText, templateId) {
        const customTemplate = this.settings.customTemplates?.find(t => t.id === templateId);
        if (!customTemplate) {
            throw new Error("Custom template not found.");
        }
        
        const provider = this.settings.executorProvider || 'gemini';
        const model = this.settings.executorModel || 'gemini-2.5-flash';
        
        const textResponse = await this.callLLM(
            provider,
            model,
            customTemplate.prompt,
            `Here is the API response / text input to process:\n${inputText}`
        );
        
        const data = JSON.parse(textResponse);
        await this.writeCustomTemplateData(data, customTemplate);
    }

    async generateCustomTemplatePrompt(name, mode, exampleInput, targetAppearance, destination, customInstructions = "") {
        let instructions = `You are a meta-prompting assistant. The user wants to build a custom logging template for Obsidian.
Your goal is to write a highly detailed, instruction-focused system prompt for a Gemini or Ollama model. 
When that model runs, it will be given a screenshot (if OCR mode) or an API response text (if API mode) and must extract relevant metrics to save to the user's daily note.

Here are the details for the custom template:
- Template Name: ${name}
- Mode: ${mode === 'ocr' ? 'OCR (Screenshot)' : 'API (Text/JSON)'}
- Expected Target Output/Appearance:
${targetAppearance}
- Target Destination in Daily Note: ${destination} (can be 'frontmatter', 'dataview' inline fields like 'key:: value', or 'append-log' list/text block)`;

        if (customInstructions) {
            instructions += `\n- Custom Instructions/User Rules to incorporate: ${customInstructions}`;
        }

        instructions += `\n\nPlease write a system prompt that tells the model:
1. What role to assume (e.g. an expert data extractor for ${name}).
2. What specific visual features or text patterns to look for.
3. Precisely what fields to extract and compile into a JSON object.
4. Specify the exact JSON schema matching the fields in the user's expected target output. For example, if they want frontmatter or dataview fields, the JSON keys should match the field names.
5. Emphasize returning ONLY the raw JSON object matching the schema, with no markdown code fences, no extra text, and no preambles.

Return your response strictly as a JSON object matching this schema:
{
  "prompt": "The full system prompt text you generated."
}`;

        const provider = this.settings.templateProvider || 'gemini';
        const model = this.settings.templateModel || 'gemini-2.5-flash';
        
        const textResponse = await this.callLLM(
            provider,
            model,
            instructions,
            `Create prompt for template: ${name}`,
            (mode === 'ocr' ? (exampleInput && exampleInput.includes(',') ? exampleInput.split(',')[1] : null) : null),
            (mode === 'ocr' && exampleInput && exampleInput.startsWith('data:') ? exampleInput.split(',')[0].split(':')[1].split(';')[0] : null)
        );
        
        const parsed = JSON.parse(textResponse);
        return parsed.prompt;
    }

    async startGoogleOAuthFlow() {
        const fs = require('fs');
        const path = require('path');
        const http = require('http');
        
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const omniLoggerDir = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger`;
        
        let credsPath = `${omniLoggerDir}${sep}credentials.json`;
        if (!fs.existsSync(credsPath)) {
            credsPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}schedule-assistant-focus-timer${sep}credentials.json`;
        }
        
        let credsData;
        if (fs.existsSync(credsPath)) {
            try {
                credsData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            } catch (e) {
                throw new Error(`Failed to parse credentials.json: ${e.message}`);
            }
        } else {
            let googleSecretId = this.settings.googleCredentialsId || 'omni-logger-google-credentials';
            let credsStr = await this.getSecret(googleSecretId, 'googleCredentials');
            if (!credsStr) {
                credsStr = await this.getSecret('schedule-assistant-google-credentials', 'googleCredentials');
            }
            if (!credsStr) {
                credsStr = await this.getSecret('timeblocker-google-credentials', 'googleCredentials');
            }
            if (!credsStr) {
                throw new Error(`Google Credentials JSON not found in omni-logger or schedule-assistant-focus-timer plugin.`);
            }
            try {
                credsData = JSON.parse(credsStr);
            } catch (e) {
                throw new Error(`Failed to parse credentials JSON string: ${e.message}`);
            }
        }
        
        const web = credsData.installed || credsData.web;
        if (!web) {
            throw new Error("Invalid credentials.json format. Expected 'installed' or 'web' client configuration.");
        }
        
        const clientId = web.client_id;
        const clientSecret = web.client_secret;
        const redirectUri = "http://localhost:8092";
        
        const scopesList = this.settings.requestedScopes || [
            "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
            "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly"
        ];
        const scopes = scopesList.join(" ");
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `response_type=code` +
            `&client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&access_type=offline` +
            `&prompt=consent`;
            
        if (this.tempOAuthServer) {
            try {
                this.tempOAuthServer.close();
            } catch(e) {}
        }
        
        this.tempOAuthServer = http.createServer(async (req, res) => {
            const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
            const code = url.searchParams.get("code");
            
            if (code) {
                try {
                    const tokenUrl = "https://oauth2.googleapis.com/token";
                    const bodyDetails = {
                        code: code,
                        client_id: clientId,
                        client_secret: clientSecret,
                        redirect_uri: redirectUri,
                        grant_type: "authorization_code"
                    };
                    const body = Object.keys(bodyDetails)
                        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(bodyDetails[key]))
                        .join('&');
                        
                    const response = await obsidian.requestUrl({
                        url: tokenUrl,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: body
                    });
                    
                    if (response.status !== 200) {
                        throw new Error(`Token exchange failed: ${response.text}`);
                    }
                    
                    const tokenResponse = response.json;
                    const expiryDate = new Date();
                    expiryDate.setSeconds(expiryDate.getSeconds() + (tokenResponse.expires_in || 3600));
                    
                    const tokenData = {
                        token: tokenResponse.access_token,
                        expiry: expiryDate.toISOString(),
                        token_uri: tokenUrl,
                        client_id: clientId,
                        client_secret: clientSecret,
                        refresh_token: tokenResponse.refresh_token
                    };
                    
                    const tokenPath = `${omniLoggerDir}${sep}token.json`;
                    fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2), 'utf8');
                    
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                        <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #1e1e1e; color: #fff;">
                            <h2 style="color: #00ffd0;">Authorization Successful!</h2>
                            <p>Google Health API is now connected to Omni-Logger.</p>
                            <p>You can close this tab and return to Obsidian.</p>
                        </body>
                        </html>
                    `);
                    
                    new obsidian.Notice("Successfully authorized Google Health API!");
                } catch (err) {
                    console.error("OAuth token exchange failed:", err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end("Authentication failed: " + err.message);
                    new obsidian.Notice("Google Health authorization failed: " + err.message);
                } finally {
                    setTimeout(() => {
                        if (this.tempOAuthServer) {
                            this.tempOAuthServer.close();
                            this.tempOAuthServer = null;
                        }
                    }, 1000);
                }
            } else {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end("Authorization code missing.");
                setTimeout(() => {
                    if (this.tempOAuthServer) {
                        this.tempOAuthServer.close();
                        this.tempOAuthServer = null;
                    }
                }, 1000);
            }
        });
        
        this.tempOAuthServer.listen(8092, () => {
            console.log("Omni-Logger OAuth temp server listening on port 8092");
            window.open(authUrl);
        });
        
        new obsidian.Notice("Opening browser to authorize Google Health...");
    }

    async writeCustomTemplateData(data, customTemplate) {
        const dailyFile = this.getDailyNoteFile();
        if (!dailyFile) {
            throw new Error("Daily note not found!");
        }
        
        let content = await this.app.vault.read(dailyFile);
        
        if (customTemplate.destination === 'frontmatter') {
            content = this.updateFrontmatterProperties(content, data);
        } else if (customTemplate.destination === 'dataview') {
            content = this.updateInlineFieldsInContent(content, data);
        } else if (customTemplate.destination === 'append-log') {
            content = this.appendLogFieldsInContent(content, data);
        }
        
        await this.app.vault.modify(dailyFile, content);
    }

    updateInlineFieldsInContent(content, data) {
        const lines = content.split(/\r?\n/);
        const keys = Object.keys(data);
        const updatedKeys = new Set();
        
        for (let i = 0; i < lines.length; i++) {
            const lineTrim = lines[i].trim();
            for (const key of keys) {
                if (lineTrim.startsWith(`${key}::`)) {
                    let val = data[key];
                    if (typeof val === 'object') val = JSON.stringify(val);
                    lines[i] = `${key}:: ${val}`;
                    updatedKeys.add(key);
                }
            }
        }
        
        const missingKeys = keys.filter(k => !updatedKeys.has(k));
        if (missingKeys.length > 0) {
            let logHeaderIndex = lines.findIndex(l => l.includes('## 🪵 Log'));
            const insertLines = [];
            for (const k of missingKeys) {
                let val = data[k];
                if (typeof val === 'object') val = JSON.stringify(val);
                insertLines.push(`${k}:: ${val}`);
            }
            
            if (logHeaderIndex !== -1) {
                lines.splice(logHeaderIndex + 1, 0, "", ...insertLines);
            } else {
                lines.push("", "## 🪵 Log", ...insertLines);
            }
        }
        
        return lines.join('\n');
    }

    appendLogFieldsInContent(content, data) {
        const lines = content.split(/\r?\n/);
        const keys = Object.keys(data);
        
        const insertLines = [];
        for (const k of keys) {
            let val = data[k];
            if (typeof val === 'object') val = JSON.stringify(val);
            insertLines.push(`- ${k}: ${val}`);
        }
        
        let logHeaderIndex = lines.findIndex(l => l.includes('## 🪵 Log'));
        if (logHeaderIndex !== -1) {
            lines.splice(logHeaderIndex + 1, 0, ...insertLines);
        } else {
            lines.push("", "## 🪵 Log", ...insertLines);
        }
        
        return lines.join('\n');
    }


    updateCallsInContent(content, calls_dict) {
        const keys = ["calls-08am", "calls-09am", "calls-10am", "calls-11am", "calls-12pm", "calls-01pm", "calls-02pm", "calls-03pm", "calls-04pm"];
        const lines = content.split(/\r?\n/);
        let updated = false;
        
        for (let i = 0; i < lines.length; i++) {
            for (const k of keys) {
                if (lines[i].trim().startsWith(`${k}::`)) {
                    const val = calls_dict[k] !== undefined ? calls_dict[k] : 0;
                    lines[i] = `${k}:: ${val}`;
                    updated = true;
                }
            }
        }
        
        if (updated) {
            return lines.join('\n');
        }
        
        let logHeaderIndex = lines.findIndex(l => l.includes('## 🪵 Log'));
        if (logHeaderIndex !== -1) {
            const insertLines = [""];
            for (const k of keys) {
                const val = calls_dict[k] !== undefined ? calls_dict[k] : 0;
                insertLines.push(`${k}:: ${val}`);
            }
            lines.splice(logHeaderIndex + 1, 0, ...insertLines);
            return lines.join('\n');
        }
        
        const insertLines = [""];
        for (const k of keys) {
            const val = calls_dict[k] !== undefined ? calls_dict[k] : 0;
            insertLines.push(`${k}:: ${val}`);
        }
        return content.trim() + "\n" + insertLines.join('\n') + "\n";
    }

    updateLumosityInContent(content, startTime, scores) {
        const lines = content.split(/\r?\n/);
        const startFm = lines.indexOf('---');
        if (startFm !== 0) return content;
        const endFm = lines.indexOf('---', 1);
        if (endFm === -1) return content;
        
        const fmText = lines.slice(startFm + 1, endFm);
        const newFm = [];
        let inScoresBlock = false;
        let keysUpdated = new Set();
        
        for (let i = 0; i < fmText.length; i++) {
            const line = fmText[i];
            if (inScoresBlock && line.trim() && !line.startsWith(' ') && !line.startsWith('-')) {
                inScoresBlock = false;
            }
            
            if (line.includes(':') && !line.startsWith(' ')) {
                const key = line.split(':')[0].trim();
                if (key === 'Lumosity Start Time') {
                    newFm.push(`Lumosity Start Time: "${startTime}"`);
                    keysUpdated.add(key);
                } else if (key === 'scores') {
                    newFm.push('scores:');
                    for (const item of scores) {
                        newFm.push(`  - game: ${item.game}`);
                        newFm.push(`    category: ${item.category}`);
                        newFm.push(`    score: ${item.score}`);
                    }
                    inScoresBlock = true;
                    keysUpdated.add(key);
                } else {
                    newFm.push(line);
                }
            } else if (inScoresBlock) {
                continue;
            } else {
                newFm.push(line);
            }
        }
        
        if (!keysUpdated.has('Lumosity Start Time')) {
            newFm.push(`Lumosity Start Time: "${startTime}"`);
        }
        if (!keysUpdated.has('scores')) {
            newFm.push('scores:');
            for (const item of scores) {
                newFm.push(`  - game: ${item.game}`);
                newFm.push(`    category: ${item.category}`);
                newFm.push(`    score: ${item.score}`);
            }
        }
        
        const newLines = ['---', ...newFm, '---', ...lines.slice(endFm + 1)];
        return newLines.join('\n');
    }

    updateFrontmatterProperties(content, updates) {
        const lines = content.split(/\r?\n/);
        const startFm = lines.indexOf('---');
        if (startFm !== 0) return content;
        const endFm = lines.indexOf('---', 1);
        if (endFm === -1) return content;
        
        const fmText = lines.slice(startFm + 1, endFm);
        const newFm = [];
        const keysUpdated = new Set();
        
        for (let i = 0; i < fmText.length; i++) {
            const line = fmText[i];
            if (line.includes(':') && !line.startsWith(' ')) {
                const key = line.split(':')[0].trim();
                if (updates[key] !== undefined) {
                    const val = updates[key];
                    if (val === null || val === "" || val === "-") {
                        newFm.push(`${key}:`);
                    } else {
                        newFm.push(`${key}: "${val}"`);
                    }
                    keysUpdated.add(key);
                } else {
                    newFm.push(line);
                }
            } else {
                newFm.push(line);
            }
        }
        
        for (const [key, val] of Object.entries(updates)) {
            if (!keysUpdated.has(key)) {
                if (val === null || val === "" || val === "-") {
                    newFm.push(`${key}:`);
                } else {
                    newFm.push(`${key}: "${val}"`);
                }
            }
        }
        
        const newLines = ['---', ...newFm, '---', ...lines.slice(endFm + 1)];
        return newLines.join('\n');
    }

    updateDataviewFields(content, updates) {
        let fmPart = "";
        let bodyPart = content;
        const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
            fmPart = fmMatch[0];
            bodyPart = content.substring(fmMatch[0].length);
        }
        
        for (const [key, val] of Object.entries(updates)) {
            const pattern = new RegExp(`^\\s*${this.escapeRegex(key)}::.*$`, 'm');
            if (pattern.test(bodyPart)) {
                bodyPart = bodyPart.replace(pattern, `${key}:: ${val}`);
            } else {
                bodyPart = bodyPart.trim() + `\n${key}:: ${val}\n`;
            }
        }
        return fmPart + bodyPart;
    }

    appendToBottomLog(content, updates) {
        let bodyPart = content;
        const logEntries = [];
        for (const [key, val] of Object.entries(updates)) {
            logEntries.push(`- [health_sync] ${key}: ${val}`);
        }
        
        if (logEntries.length > 0) {
            const gitStart = bodyPart.indexOf("<!--START_Antigravity_Git_Log-->");
            const newText = "\n" + logEntries.join("\n") + "\n\n";
            if (gitStart !== -1) {
                bodyPart = bodyPart.substring(0, gitStart) + newText + bodyPart.substring(gitStart);
            } else {
                bodyPart = bodyPart.trim() + "\n" + newText;
            }
        }
        return bodyPart;
    }

    escapeRegex(string) {
        return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    async loadGoToItems() {
        const fs = require('fs');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const folderName = this.settings.ingredientsFolder || 'Omni_Templates';
        const vaultJsonPath = `${vaultPath}${sep}${folderName}${sep}health_go_to_items.json`;
        const pluginJsonPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}health_go_to_items.json`;
        
        if (fs.existsSync(vaultJsonPath)) {
            try {
                const content = fs.readFileSync(vaultJsonPath, 'utf8');
                const data = JSON.parse(content);
                return data.go_to_items || [];
            } catch(e) {
                console.error("Failed to parse go-to items from vault:", e);
            }
        }
        
        if (fs.existsSync(pluginJsonPath)) {
            try {
                const content = fs.readFileSync(pluginJsonPath, 'utf8');
                const data = JSON.parse(content);
                const vaultTemplatesDir = `${vaultPath}${sep}${folderName}`;
                if (!fs.existsSync(vaultTemplatesDir)) {
                    fs.mkdirSync(vaultTemplatesDir, { recursive: true });
                }
                fs.writeFileSync(vaultJsonPath, content, 'utf8');
                try { fs.unlinkSync(pluginJsonPath); } catch(e) {}
                return data.go_to_items || [];
            } catch(e) {
                console.error("Failed to migrate go-to items:", e);
            }
        }
        
        const defaultRegistry = {
            go_to_items: [
                { id: "americano", name: "Americano", category: "caffeine", default_amount: 1, unit: "cup (12 oz)", caffeine_mg: 150, health_connect_type: "nutrition", nutrients: { caffeine: 0.150 } },
                { id: "espresso", name: "Espresso", category: "caffeine", default_amount: 1, unit: "shot", caffeine_mg: 75, health_connect_type: "nutrition", nutrients: { caffeine: 0.075 } },
                { id: "coffee", name: "Coffee", category: "caffeine", default_amount: 1, unit: "cup (8 oz)", caffeine_mg: 95, health_connect_type: "nutrition", nutrients: { caffeine: 0.095 } },
                { id: "cold_brew", name: "Cold Brew", category: "caffeine", default_amount: 1, unit: "glass (12 oz)", caffeine_mg: 150, health_connect_type: "nutrition", nutrients: { caffeine: 0.150 } },
                { id: "protein_shake", name: "Protein Shake", category: "nutrition", default_amount: 1, unit: "serving", protein_g: 30, calories: 160, health_connect_type: "nutrition", nutrients: { protein: 30.0, energy: 160.0 } },
                { id: "beer", name: "Beer (IPA / Stout / Ale)", category: "alcohol", default_amount: 1, unit: "can (12 oz)", alcohol_g: 14, health_connect_type: "alcohol_consumption", nutrients: { alcohol: 14.0 } },
                { id: "wine", name: "Wine", category: "alcohol", default_amount: 1, unit: "glass (5 oz)", alcohol_g: 14, health_connect_type: "alcohol_consumption", nutrients: { alcohol: 14.0 } },
                { id: "water", name: "Water (Cup)", category: "hydration", default_amount: 1, unit: "cup (8 oz / 250 ml)", water_ml: 250.0, health_connect_type: "hydration", nutrients: {} },
                { id: "water_bottle", name: "Water (Bottle)", category: "hydration", default_amount: 1, unit: "bottle (16.9 oz / 500 ml)", water_ml: 500.0, health_connect_type: "hydration", nutrients: {} }
            ]
        };
        try {
            const vaultTemplatesDir = `${vaultPath}${sep}${folderName}`;
            if (!fs.existsSync(vaultTemplatesDir)) {
                fs.mkdirSync(vaultTemplatesDir, { recursive: true });
            }
            fs.writeFileSync(vaultJsonPath, JSON.stringify(defaultRegistry, null, 2), 'utf8');
        } catch(e) {}
        return defaultRegistry.go_to_items;
    }

    async saveGoToItems(items) {
        const fs = require('fs');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const folderName = this.settings.ingredientsFolder || 'Omni_Templates';
        const vaultJsonPath = `${vaultPath}${sep}${folderName}${sep}health_go_to_items.json`;
        
        const payload = JSON.stringify({ go_to_items: items }, null, 2);
        
        try {
            fs.writeFileSync(vaultJsonPath, payload, 'utf8');
        } catch(e) {
            console.error("Failed to save go-to items to vault:", e);
        }
    }

    organizeCustomPluginsSidebar() {
        const fs = require('fs');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const logPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}debug_display.log`;
        
        const log = (msg) => {
            try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Sidebar] ${msg}\n`); } catch(e) {}
        };
        
        log("Sidebar organize start");
        const settingModal = document.querySelector('.modal.mod-settings');
        if (!settingModal) {
            log("settingModal missing");
            return;
        }
        
        const sidebar = settingModal.querySelector('.vertical-tab-header');
        if (!sidebar) {
            log("sidebar missing");
            return;
        }
        
        const communitySection = sidebar.querySelector('.vertical-tab-header-group-items[data-section="community-plugins"]');
        if (!communitySection) {
            log("communitySection missing");
            return;
        }
        
        let folderContainer = communitySection.querySelector('.custom-plugins-folder-container');
        if (folderContainer) {
            log("folderContainer already exists");
            return;
        }
        
        const targetPluginIds = [
            'schedule-assistant-focus-timer',
            'omni-logger',
            'google-keep-sync',
            'grind-manager',
            'knowledge-pipeline',
            'git-logger'
        ];
        
        const targetElements = [];
        const navItems = communitySection.querySelectorAll('.vertical-tab-nav-item');
        log("Found navItems count: " + navItems.length);
        navItems.forEach(item => {
            const id = item.getAttribute('data-setting-id');
            if (targetPluginIds.includes(id)) {
                targetElements.push(item);
            }
        });
        
        log("Target elements found: " + targetElements.length);
        if (targetElements.length === 0) return;
        
        const folderHeader = document.createElement('div');
        folderHeader.className = 'vertical-tab-nav-item custom-plugins-folder-header';
        folderHeader.style.fontWeight = '600';
        folderHeader.style.cursor = 'pointer';
        folderHeader.style.display = 'flex';
        folderHeader.style.alignItems = 'center';
        folderHeader.style.justifyContent = 'space-between';
        folderHeader.style.padding = '8px 12px';
        folderHeader.style.marginTop = '8px';
        folderHeader.style.borderTop = '1px solid var(--background-modifier-border)';
        
        const headerTitle = document.createElement('span');
        headerTitle.textContent = '📦 Custom Plugins';
        folderHeader.appendChild(headerTitle);
        
        const chevron = document.createElement('span');
        chevron.textContent = '▼';
        chevron.style.fontSize = '0.75rem';
        chevron.style.transition = 'transform 0.2s ease';
        folderHeader.appendChild(chevron);
        
        folderContainer = document.createElement('div');
        folderContainer.className = 'custom-plugins-folder-container';
        folderContainer.style.transition = 'max-height 0.25s ease-out, opacity 0.2s ease';
        folderContainer.style.overflow = 'hidden';
        
        let isCollapsed = localStorage.getItem('custom-plugins-settings-collapsed') === 'true';
        if (isCollapsed) {
            folderContainer.style.maxHeight = '0px';
            folderContainer.style.opacity = '0';
            chevron.style.transform = 'rotate(-90deg)';
        } else {
            folderContainer.style.maxHeight = '500px';
            folderContainer.style.opacity = '1';
        }
        
        folderHeader.onclick = (e) => {
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            localStorage.setItem('custom-plugins-settings-collapsed', isCollapsed);
            if (isCollapsed) {
                folderContainer.style.maxHeight = '0px';
                folderContainer.style.opacity = '0';
                chevron.style.transform = 'rotate(-90deg)';
            } else {
                folderContainer.style.maxHeight = '500px';
                folderContainer.style.opacity = '1';
                chevron.style.transform = 'rotate(0deg)';
            }
        };
        
        const firstTarget = targetElements[0];
        log("Inserting folderHeader and folderContainer before: " + firstTarget.getAttribute('data-setting-id'));
        try {
            communitySection.insertBefore(folderHeader, firstTarget);
            communitySection.insertBefore(folderContainer, firstTarget);
            log("Header and container inserted successfully");
        } catch(e) {
            log("Error inserting header/container: " + e.message);
        }
        
        targetElements.forEach(item => {
            log("Moving nav item: " + item.getAttribute('data-setting-id'));
            item.style.paddingLeft = '24px';
            item.classList.add('custom-plugin-sub-item');
            try {
                folderContainer.appendChild(item);
                log("Moved " + item.getAttribute('data-setting-id'));
            } catch(e) {
                log("Error moving " + item.getAttribute('data-setting-id') + ": " + e.message);
            }
        });
        log("Sidebar organize end");
    }

    runPythonScript(scriptName, scriptArgs = "", isBackground = false) {
        return new Promise((resolve, reject) => {
            const child_process = require('child_process');
            const path = require('path');
            
            const vaultPath = this.app.vault.adapter.getBasePath();
            const sep = vaultPath.includes('/') ? '/' : '\\';
            
            let scriptPath;
            if (scriptName.startsWith('/') || scriptName.startsWith('\\') || scriptName.includes(':') || scriptName.startsWith('99_System')) {
                if (scriptName.startsWith('99_System')) {
                    scriptPath = path.join(vaultPath, scriptName);
                } else {
                    scriptPath = scriptName;
                }
            } else {
                scriptPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}${scriptName}`;
            }
            
            const dailyFile = this.getDailyNoteFile();
            if (!dailyFile) {
                if (!isBackground) {
                    new obsidian.Notice("Daily note not found!");
                }
                resolve();
                return;
            }
            const absoluteDailyPath = path.join(vaultPath, dailyFile.path);
            
            this.getSecret(this.settings.geminiApiKeyId || 'omni-logger-gemini-api-key', 'geminiApiKey').then(async (geminiKey) => {
                if (!geminiKey) {
                    geminiKey = await this.getSecret('timeblocker-gemini-api-key', 'geminiApiKey');
                }
                const env = Object.assign({}, process.env, {
                    GEMINI_API_KEY: geminiKey
                });
                
                const os = require('os');
                const fs = require('fs');
                const pluginDir = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger`;
                const venvPython = os.platform() === 'win32'
                    ? path.join(pluginDir, '.venv', 'Scripts', 'python.exe')
                    : path.join(pluginDir, '.venv', 'bin', 'python');
                const pythonCmd = fs.existsSync(venvPython) ? `"${venvPython}"` : 'python';
                
                const argsStr = scriptArgs ? " " + scriptArgs : ` "${absoluteDailyPath}"`;
                const cmd = `${pythonCmd} -u "${scriptPath}"${argsStr}`;
                console.log(`Running Python script: ${cmd}`);
                
                child_process.exec(cmd, { env: env }, (err, stdout, stderr) => {
                    if (err) {
                        console.error(`Script error: ${stderr || err.message}`);
                        if (!isBackground) {
                            new obsidian.Notice(`Error running ${scriptName}: ${stderr || err.message}`);
                        }
                        reject(err);
                    } else {
                        console.log(`Script output: ${stdout}`);
                        if (stdout.trim() && !isBackground) {
                            new obsidian.Notice(stdout.trim());
                        }
                        resolve(stdout);
                    }
                });
            });
        });
    }

    async runHL7QueryScript() {
        const child_process = require('child_process');
        const path = require('path');
        
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const scriptPath = `${vaultPath}${sep}04_Projects${sep}hl7-nl-to-sql${sep}query_lake_obsidian.py`;
        
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new obsidian.Notice("No active note found!");
            return;
        }
        const absoluteActivePath = path.join(vaultPath, activeFile.path);
        
        let geminiKey = await this.getSecret(this.settings.geminiApiKeyId || 'omni-logger-gemini-api-key', 'geminiApiKey');
        if (!geminiKey) {
            geminiKey = await this.getSecret('timeblocker-gemini-api-key', 'geminiApiKey');
        }
        const env = Object.assign({}, process.env, {
            GEMINI_API_KEY: geminiKey
        });
        
        const cmd = `python -u "${scriptPath}" "${absoluteActivePath}"`;
        console.log(`Running Python script: ${cmd}`);
        
        new obsidian.Notice("Running HL7 NL-to-SQL Query...");
        
        child_process.exec(cmd, { env: env }, (err, stdout, stderr) => {
            if (err) {
                console.error(`Script error: ${stderr || err.message}`);
                new obsidian.Notice(`Error: ${stderr || err.message}`);
            } else {
                console.log(`Script output: ${stdout}`);
                if (stdout.trim()) {
                    new obsidian.Notice(stdout.trim());
                }
            }
        });
    }

    async runHL7IngestScript() {
        const child_process = require('child_process');
        const path = require('path');
        
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const scriptPath = `${vaultPath}${sep}04_Projects${sep}hl7-nl-to-sql${sep}ingest_all_samples.py`;
        
        let geminiKey = await this.getSecret(this.settings.geminiApiKeyId || 'omni-logger-gemini-api-key', 'geminiApiKey');
        if (!geminiKey) {
            geminiKey = await this.getSecret('timeblocker-gemini-api-key', 'geminiApiKey');
        }
        const env = Object.assign({}, process.env, {
            GEMINI_API_KEY: geminiKey
        });
        
        const cmd = `python -u "${scriptPath}"`;
        console.log(`Running Ingest Script: ${cmd}`);
        
        new obsidian.Notice("Starting HL7 Batch Ingestion...");
        
        child_process.exec(cmd, { env: env }, (err, stdout, stderr) => {
            if (err) {
                console.error(`Ingest error: ${stderr || err.message}`);
                new obsidian.Notice(`Ingest Error: ${stderr || err.message}`);
            } else {
                console.log(`Ingest output: ${stdout}`);
                new obsidian.Notice("HL7 Batch Ingestion Completed successfully!");
            }
        });
    }
}

class OmniLoggerSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Omni-Logger Settings' });

        const requestWithTimeout = async (params, timeoutMs = 2500) => {
            return Promise.race([
                obsidian.requestUrl(params),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
            ]);
        };

        const createStatusBadge = (parentEl) => {
            const badge = parentEl.createEl('span');
            badge.style.display = 'inline-block';
            badge.style.width = '10px';
            badge.style.height = '10px';
            badge.style.borderRadius = '50%';
            badge.style.marginLeft = '8px';
            badge.style.verticalAlign = 'middle';
            badge.style.backgroundColor = '#8e8e93';
            badge.setAttribute('title', 'Checking...');
            return badge;
        };

        const updateBadge = (badge, ok, tooltip) => {
            badge.style.backgroundColor = ok ? '#30d158' : '#ff453a';
            badge.setAttribute('title', tooltip);
        };

        // ==========================================
        // 1. GOOGLE HEALTH INTEGRATION (Top, Collapsible)
        // ==========================================
        const googleHealthDetails = containerEl.createEl('details');
        googleHealthDetails.style.marginBottom = '20px';
        googleHealthDetails.style.border = '1px solid var(--background-modifier-border)';
        googleHealthDetails.style.borderRadius = '6px';
        googleHealthDetails.style.padding = '8px';
        if (this.plugin.settings.dataSourceApi === 'google-health') {
            googleHealthDetails.setAttribute('open', '');
        }
        const googleHealthSummary = googleHealthDetails.createEl('summary', { text: '🔗 Google Health Integration' });
        googleHealthSummary.style.cursor = 'pointer';
        googleHealthSummary.style.fontSize = '1.2em';
        googleHealthSummary.style.fontWeight = 'bold';
        googleHealthSummary.style.color = 'var(--text-accent)';
        
        const googleHealthDetailsContainer = googleHealthDetails.createDiv();
        googleHealthDetailsContainer.style.paddingTop = '10px';
        
        new obsidian.Setting(googleHealthDetailsContainer)
            .setName('Enable Google Health API')
            .setDesc('Toggle integration with Google Fitness/Health APIs.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dataSourceApi === 'google-health')
                .onChange(async (value) => {
                    this.plugin.settings.dataSourceApi = value ? 'google-health' : 'none';
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (this.plugin.settings.dataSourceApi === 'google-health') {
            const googleHealthContainer = googleHealthDetailsContainer.createDiv();
            googleHealthContainer.style.padding = '15px';
            googleHealthContainer.style.border = '1px solid var(--background-modifier-border)';
            googleHealthContainer.style.borderRadius = '8px';
            googleHealthContainer.style.marginTop = '10px';
            googleHealthContainer.style.backgroundColor = 'var(--background-secondary)';

            // Clickable Links for Local Resources
            const localLinksDiv = googleHealthContainer.createDiv();
            localLinksDiv.style.marginBottom = '15px';
            localLinksDiv.style.padding = '10px';
            localLinksDiv.style.border = '1px dashed var(--interactive-accent)';
            localLinksDiv.style.borderRadius = '6px';
            localLinksDiv.style.fontSize = '0.9em';
            localLinksDiv.innerHTML = `
                <b>📁 Local Integration Resources:</b><br>
                • <b>Food Registry JSON:</b> <a href="file:///c:/Users/jare0/Documents/Obsidian/99_System/Omni_Templates/health_go_to_items.json">health_go_to_items.json</a> (Edit go-to items & nutritional metadata inside your vault)<br>
                • <b>Log & Sync Script:</b> <a href="file:///c:/Users/jare0/Documents/Obsidian/.obsidian/plugins/omni-logger/health_checkin_wizard.py">health_checkin_wizard.py</a> (GUI check-in wizard)<br>
                • <b>Sleep Logging Script:</b> <a href="file:///c:/Users/jare0/Documents/Obsidian/.obsidian/plugins/omni-logger/log_sleep.py">log_sleep.py</a> (Direct/scheduled sleep logger)<br>
                • <b>Biometrics Logging Script:</b> <a href="file:///c:/Users/jare0/Documents/Obsidian/.obsidian/plugins/omni-logger/log_biometrics.py">log_biometrics.py</a> (Direct/scheduled biometrics logger)<br>
                • <b>Nutrition Syncing Script:</b> <a href="file:///c:/Users/jare0/Documents/Obsidian/.obsidian/plugins/omni-logger/log_nutrition.py">log_nutrition.py</a> (Direct/scheduled nutrition logger)<br>
                • <b>Nutrition Posting Script:</b> <a href="file:///c:/Users/jare0/Documents/Obsidian/.obsidian/plugins/omni-logger/post_nutrition.py">post_nutrition.py</a> (Post foods/drinks directly to API)
            `;

            // Credentials JSON
            new obsidian.Setting(googleHealthContainer)
                .setName('Google Credentials JSON')
                .setDesc('Paste the full {"web":{...}} JSON downloaded from Google Cloud Console.')
                .addText(text => {
                    text.inputEl.type = 'password';
                    text.setPlaceholder('Paste full JSON here');
                    
                    let secretId = this.plugin.settings.googleCredentialsId || 'omni-logger-google-credentials';
                    this.plugin.getSecret(secretId, 'googleCredentials').then(secret => {
                        if (!secret) {
                            return this.plugin.getSecret('schedule-assistant-google-credentials', 'googleCredentials').then(async fbSecret => {
                                if (!fbSecret) {
                                    return this.plugin.getSecret('timeblocker-google-credentials', 'googleCredentials').then(async tbSecret => {
                                        if (tbSecret) {
                                            await this.plugin.setSecret('omni-logger-google-credentials', 'googleCredentials', tbSecret);
                                            this.plugin.settings.googleCredentialsId = 'omni-logger-google-credentials';
                                            await this.plugin.saveSettings();
                                            return tbSecret;
                                        }
                                        return '';
                                    });
                                }
                                await this.plugin.setSecret('omni-logger-google-credentials', 'googleCredentials', fbSecret);
                                this.plugin.settings.googleCredentialsId = 'omni-logger-google-credentials';
                                await this.plugin.saveSettings();
                                return fbSecret;
                            });
                        }
                        return secret;
                    }).then(secret => {
                        if (secret && secret.toLowerCase().includes('client_id')) {
                            let displayStr = secret.substring(0, 15) + '...' + secret.substring(secret.length - 5);
                            text.setValue(displayStr);
                        }
                    });
                    
                    text.onChange(async (value) => {
                        if (value && value.length > 50 && value.toLowerCase().includes('client_id')) {
                            let secretId = 'omni-logger-google-credentials';
                            await this.plugin.setSecret(secretId, 'googleCredentials', value);
                            this.plugin.settings.googleCredentialsId = secretId;
                            await this.plugin.saveSettings();
                            let displayStr = value.substring(0, 15) + '...' + value.substring(value.length - 5);
                            text.setValue(displayStr);
                            new obsidian.Notice("Google Credentials securely stored!");
                        } else if (value.trim() === '') {
                            let secretId = this.plugin.settings.googleCredentialsId || 'omni-logger-google-credentials';
                            await this.plugin.setSecret(secretId, 'googleCredentials', '');
                        }
                    });
                });

            // Collapsible Instructions
            const instructionsDetails = googleHealthContainer.createEl('details');
            instructionsDetails.style.marginBottom = '20px';
            const summary = instructionsDetails.createEl('summary', { text: 'How to get Google Cloud Credentials' });
            summary.style.cursor = 'pointer';
            summary.style.fontWeight = 'bold';
            summary.style.color = 'var(--text-accent)';
            
            const instrContent = instructionsDetails.createDiv();
            instrContent.style.padding = '10px';
            instrContent.style.backgroundColor = 'var(--background-primary)';
            instrContent.style.borderRadius = '5px';
            instrContent.style.marginTop = '10px';
            instrContent.innerHTML = `
                <ol style="margin-top: 0;">
                    <li>Go to <a href="https://console.cloud.google.com/">Google Cloud Console</a>.</li>
                    <li>Create a new project (or use an existing one).</li>
                    <li>Enable the <b>Fitness API</b> in APIs & Services.</li>
                    <li>Go to <b>Credentials</b> -> Create Credentials -> <b>OAuth client ID</b>.</li>
                    <li>Select <b>Web application</b> (or Desktop app).</li>
                    <li>If Web Application, add <code>http://localhost:8092</code> to Authorized redirect URIs.</li>
                    <li>Click Create, then click <b>Download JSON</b>.</li>
                    <li>Open the JSON file in Notepad, copy everything, and paste it into the field above.</li>
                </ol>
            `;

            // Authorization Tools
            const buttonsSetting = new obsidian.Setting(googleHealthContainer)
                .setName('Authorization Tools')
                .setDesc('Connect or test your Google Health API integration.');
            
            buttonsSetting.addButton(btn => {
                btn.setButtonText("Connect Google Account")
                   .setCta()
                   .onClick(() => {
                       this.plugin.startGoogleOAuthFlow('health').catch(e => {
                           new obsidian.Notice("Failed to start OAuth: " + e.message);
                       });
                   });
            });
            
            buttonsSetting.addButton(btn => {
                btn.setButtonText("Test Connection")
                   .onClick(async () => {
                       btn.setButtonText("Testing...");
                       try {
                           const token = await this.plugin.getGoogleAccessToken();
                           if (!token) throw new Error("No access token found.");
                           
                           const res = await requestWithTimeout({
                               url: 'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=' + token,
                               method: 'GET'
                           });
                           
                           if (res.status === 200) {
                               new obsidian.Notice("Google Health connection successful!");
                               btn.setButtonText("Success!");
                           } else {
                               throw new Error(`Google API returned status ${res.status}`);
                           }
                           setTimeout(() => btn.setButtonText("Test Connection"), 2000);
                       } catch (e) {
                           new obsidian.Notice("Connection failed: " + e.message);
                           btn.setButtonText("Failed");
                           setTimeout(() => btn.setButtonText("Test Connection"), 2000);
                       }
                   });
            });

            // OAuth Scopes configuration
            googleHealthContainer.createEl('h4', { text: 'Google Health OAuth Scopes' });
            const scopesDiv = googleHealthContainer.createDiv();
            scopesDiv.style.display = 'flex';
            scopesDiv.style.flexDirection = 'column';
            scopesDiv.style.gap = '8px';
            scopesDiv.style.marginBottom = '20px';
            scopesDiv.style.padding = '10px';
            scopesDiv.style.border = '1px solid var(--background-modifier-border)';
            scopesDiv.style.borderRadius = '6px';
            scopesDiv.style.backgroundColor = 'var(--background-primary)';
            
            const availableScopes = [
                { label: "Sleep (Read)", scope: "https://www.googleapis.com/auth/googlehealth.sleep.readonly" },
                { label: "HRV & Vitals (Read)", scope: "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly" },
                { label: "Nutrition (Read)", scope: "https://www.googleapis.com/auth/googlehealth.nutrition.readonly" },
                { label: "Nutrition (Write)", scope: "https://www.googleapis.com/auth/googlehealth.nutrition.writeonly" }
            ];
            
            availableScopes.forEach(item => {
                const row = scopesDiv.createDiv();
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '8px';
                
                const chk = row.createEl('input', { type: 'checkbox' });
                const userScopes = this.plugin.settings.requestedScopes || DEFAULT_SETTINGS.requestedScopes;
                chk.checked = userScopes.includes(item.scope);
                
                chk.onchange = async () => {
                    let current = this.plugin.settings.requestedScopes || [...DEFAULT_SETTINGS.requestedScopes];
                    if (chk.checked) {
                        if (!current.includes(item.scope)) current.push(item.scope);
                    } else {
                        current = current.filter(s => s !== item.scope);
                    }
                    this.plugin.settings.requestedScopes = current;
                    await this.plugin.saveSettings();
                };
                
                const label = row.createEl('label', { text: item.label });
                label.style.fontSize = '0.9em';
            });

            // Metrics Synchronization configuration
            googleHealthContainer.createEl('h4', { text: 'Synced Health Metrics & Custom Targets' });
            const metricsContainer = googleHealthContainer.createDiv();
            metricsContainer.style.display = 'flex';
            metricsContainer.style.flexDirection = 'column';
            metricsContainer.style.gap = '10px';
            metricsContainer.style.marginBottom = '25px';
            
            const currentMetrics = this.plugin.settings.healthSyncConfig || DEFAULT_SETTINGS.healthSyncConfig;
            
            Object.keys(currentMetrics).forEach(mKey => {
                const mConfig = currentMetrics[mKey];
                const row = metricsContainer.createDiv();
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.justifyContent = 'space-between';
                row.style.padding = '8px';
                row.style.border = '1px solid var(--background-modifier-border)';
                row.style.borderRadius = '6px';
                row.style.backgroundColor = 'var(--background-primary)';
                
                const labelSpan = row.createSpan({ text: mKey.toUpperCase() });
                labelSpan.style.fontWeight = 'bold';
                labelSpan.style.width = '120px';
                
                const controlsDiv = row.createDiv();
                controlsDiv.style.display = 'flex';
                controlsDiv.style.alignItems = 'center';
                controlsDiv.style.gap = '15px';
                
                // Enabled checkbox
                const enabledChk = controlsDiv.createEl('input', { type: 'checkbox' });
                enabledChk.checked = mConfig.enabled;
                enabledChk.onchange = async () => {
                    mConfig.enabled = enabledChk.checked;
                    await this.plugin.saveSettings();
                };
                
                // Destination select dropdown
                const destSelect = controlsDiv.createEl('select');
                destSelect.createEl('option', { value: 'frontmatter', text: 'YAML Frontmatter' });
                destSelect.createEl('option', { value: 'dataview', text: 'Inline Dataview (key::)' });
                destSelect.createEl('option', { value: 'append-log', text: 'Append to Bottom' });
                destSelect.value = mConfig.destination || 'frontmatter';
                destSelect.onchange = async () => {
                    mConfig.destination = destSelect.value;
                    await this.plugin.saveSettings();
                };
                
                // Key input textbox
                const keyInput = controlsDiv.createEl('input', { type: 'text' });
                keyInput.style.width = '130px';
                keyInput.value = mConfig.key || '';
                keyInput.placeholder = 'Dest Property Key';
                keyInput.onchange = async () => {
                    mConfig.key = keyInput.value.trim();
                    await this.plugin.saveSettings();
                };
            });

            // Food Logging Wizard launcher
            new obsidian.Setting(googleHealthContainer)
                .setName('Food Logging & Registry Wizard')
                .setDesc('Launch the interactive UI to add new food entries to the JSON registry and post logs directly to the Health API.')
                .addButton(btn => {
                    btn.setButtonText("Open Food Ingestion UI")
                       .setCta()
                       .onClick(() => {
                           new OmniFoodLoggerModal(this.app, this.plugin).open();
                       });
                });

            // Health History Manager launcher
            new obsidian.Setting(googleHealthContainer)
                .setName('Google Health History Manager')
                .setDesc('View, select, and batch delete erroneous nutrition or hydration log entries from Google Health.')
                .addButton(btn => {
                    btn.setButtonText("Manage Health History")
                       .onClick(() => {
                           new OmniHealthHistoryModal(this.app, this.plugin).open();
                       });
                });

            // Collapsible Ingestion Prompts
            const promptsDetails = googleHealthContainer.createEl('details');
            promptsDetails.style.marginTop = '15px';
            promptsDetails.style.marginBottom = '15px';
            promptsDetails.style.border = '1px solid var(--background-modifier-border)';
            promptsDetails.style.borderRadius = '6px';
            promptsDetails.style.padding = '8px';
            
            const promptsSummary = promptsDetails.createEl('summary', { text: '⚙️ LLM Ingestion Formatting Prompts' });
            promptsSummary.style.cursor = 'pointer';
            promptsSummary.style.fontWeight = 'bold';
            promptsSummary.style.color = 'var(--text-accent)';
            
            const promptsContainer = promptsDetails.createDiv();
            promptsContainer.style.paddingTop = '10px';
            
            new obsidian.Setting(promptsContainer)
                .setName('Sleep Ingestion Prompt')
                .setDesc('Instructions for parsing sleep data payload.')
                .addTextArea(text => {
                    text.inputEl.style.width = '100%';
                    text.inputEl.style.minHeight = '80px';
                    text.setValue(this.plugin.settings.googleHealthSleepPrompt || DEFAULT_SETTINGS.googleHealthSleepPrompt);
                    text.onChange(async (value) => {
                        this.plugin.settings.googleHealthSleepPrompt = value;
                        await this.plugin.saveSettings();
                    });
                });
                
            new obsidian.Setting(promptsContainer)
                .setName('Vitals & HRV Ingestion Prompt')
                .setDesc('Instructions for parsing HRV / vitals data payload.')
                .addTextArea(text => {
                    text.inputEl.style.width = '100%';
                    text.inputEl.style.minHeight = '80px';
                    text.setValue(this.plugin.settings.googleHealthVitalsPrompt || DEFAULT_SETTINGS.googleHealthVitalsPrompt);
                    text.onChange(async (value) => {
                        this.plugin.settings.googleHealthVitalsPrompt = value;
                        await this.plugin.saveSettings();
                    });
                });
                
            new obsidian.Setting(promptsContainer)
                .setName('Nutrition Ingestion Prompt')
                .setDesc('Instructions for parsing food logs payload.')
                .addTextArea(text => {
                    text.inputEl.style.width = '100%';
                    text.inputEl.style.minHeight = '80px';
                    text.setValue(this.plugin.settings.googleHealthNutritionPrompt || DEFAULT_SETTINGS.googleHealthNutritionPrompt);
                    text.onChange(async (value) => {
                        this.plugin.settings.googleHealthNutritionPrompt = value;
                        await this.plugin.saveSettings();
                    });
                });
                
            new obsidian.Setting(promptsContainer)
                .setName('Hydration Ingestion Prompt')
                .setDesc('Instructions for parsing water/hydration data payload.')
                .addTextArea(text => {
                    text.inputEl.style.width = '100%';
                    text.inputEl.style.minHeight = '80px';
                    text.setValue(this.plugin.settings.googleHealthHydrationPrompt || DEFAULT_SETTINGS.googleHealthHydrationPrompt);
                    text.onChange(async (value) => {
                        this.plugin.settings.googleHealthHydrationPrompt = value;
                        await this.plugin.saveSettings();
                    });
                });
        }

        // ==========================================
        // 2. TEMPLATE GENERATOR
        // ==========================================
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: 'Template Generator' });
        
        new obsidian.Setting(containerEl)
            .setName('Provider')
            .setDesc('Select the LLM provider for generating prompts.')
            .addDropdown(dropdown => dropdown
                .addOption('gemini', 'Gemini (Google API)')
                .addOption('ollama', 'Ollama (Local)')
                .setValue(this.plugin.settings.templateProvider || 'gemini')
                .onChange(async (value) => {
                    this.plugin.settings.templateProvider = value;
                    if (value === 'ollama' && !this.plugin.settings.templateModel.includes(':')) {
                        this.plugin.settings.templateModel = 'qwen2.5:7b';
                    } else if (value === 'gemini' && this.plugin.settings.templateModel.includes(':')) {
                        this.plugin.settings.templateModel = 'gemini-2.5-flash';
                    }
                    await this.plugin.saveSettings();
                    this.display(); // full re-render to update dependent fields
                }));

        if (this.plugin.settings.templateProvider === 'gemini') {
            let geminiSecretId = this.plugin.settings.geminiApiKeyId || 'omni-logger-gemini-api-key';
            const geminiSetting = new obsidian.Setting(containerEl)
                .setName('Gemini API Key')
                .setDesc('Used for Template Generation.')
                .addText(text => {
                    text.inputEl.type = 'password';
                    text.setPlaceholder('Enter Gemini API Key');
                    this.plugin.getSecret(geminiSecretId, 'geminiApiKey').then(secret => {
                        if (secret && secret.length > 10) {
                            text.setValue(secret.substring(0, 8) + '...' + secret.substring(secret.length - 4));
                        }
                    });
                    text.onChange(async (value) => {
                        if (value && value.length > 20) {
                            await this.plugin.setSecret(geminiSecretId, 'geminiApiKey', value);
                            let displayStr = value.substring(0, 8) + '...' + value.substring(value.length - 4);
                            text.setValue(displayStr);
                            new obsidian.Notice("Gemini API Key saved!");
                        } else if (value.trim() === '') {
                            await this.plugin.setSecret(geminiSecretId, 'geminiApiKey', '');
                        }
                    });
                })
                .addButton(btn => btn
                    .setButtonText('Test')
                    .onClick(async () => {
                        const key = await this.plugin.getSecret(geminiSecretId, 'geminiApiKey');
                        if (!key) {
                            new obsidian.Notice('Gemini API Key is empty.');
                            return;
                        }
                        btn.setButtonText('Testing...');
                        try {
                            const res = await requestWithTimeout({
                                url: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
                                method: 'GET'
                            });
                            if (res.status === 200) {
                                new obsidian.Notice('Gemini API connection successful!');
                                updateBadge(geminiBadge, true, 'Connected');
                            } else {
                                new obsidian.Notice(`Gemini API error: Status ${res.status}`);
                                updateBadge(geminiBadge, false, 'Error');
                            }
                        } catch(e) {
                            new obsidian.Notice(`Gemini API connection failed: ${e.message}`);
                            updateBadge(geminiBadge, false, 'Error');
                        } finally {
                            btn.setButtonText('Test');
                        }
                    })
                );
            const geminiBadge = createStatusBadge(geminiSetting.nameEl);
            this.plugin.getSecret(geminiSecretId, 'geminiApiKey').then(key => {
                if(key && key.length > 10) {
                    requestWithTimeout({ url: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, method: 'GET' })
                    .then(res => updateBadge(geminiBadge, res.status===200, 'Connected'))
                    .catch(() => updateBadge(geminiBadge, false, 'Error'));
                }
            });
            
            new obsidian.Setting(containerEl)
                .setName('Model')
                .setDesc('Gemini model to use.')
                .addDropdown(dropdown => dropdown
                    .addOption('gemini-2.5-flash', 'Gemini 2.5 Flash')
                    .addOption('gemini-2.5-pro', 'Gemini 2.5 Pro')
                    .setValue(this.plugin.settings.templateModel || 'gemini-2.5-flash')
                    .onChange(async (value) => {
                        this.plugin.settings.templateModel = value;
                        await this.plugin.saveSettings();
                    }));
        } else {
            const ollamaSetting = new obsidian.Setting(containerEl)
                .setName('Ollama Server URL')
                .setDesc('Local URL for Ollama API.')
                .addText(text => text
                    .setPlaceholder('http://localhost:11434')
                    .setValue(this.plugin.settings.ollamaUrl || 'http://localhost:11434')
                    .onChange(async (value) => {
                        this.plugin.settings.ollamaUrl = value;
                        await this.plugin.saveSettings();
                    }))
                .addButton(btn => btn
                    .setButtonText('Test')
                    .onClick(async () => {
                        const url = this.plugin.settings.ollamaUrl || 'http://localhost:11434';
                        btn.setButtonText('Testing...');
                        try {
                            const res = await requestWithTimeout({
                                url: `${url}/api/tags`,
                                method: 'GET'
                            });
                            if (res.status === 200) {
                                new obsidian.Notice('Ollama server is online!');
                                updateBadge(ollamaBadge, true, 'Connected');
                            } else {
                                new obsidian.Notice(`Ollama server returned status ${res.status}`);
                                updateBadge(ollamaBadge, false, 'Error');
                            }
                        } catch(e) {
                            new obsidian.Notice(`Ollama server connection failed: ${e.message}`);
                            updateBadge(ollamaBadge, false, 'Error');
                        } finally {
                            btn.setButtonText('Test');
                        }
                    })
                );
            const ollamaBadge = createStatusBadge(ollamaSetting.nameEl);
            requestWithTimeout({ url: `${this.plugin.settings.ollamaUrl || 'http://localhost:11434'}/api/tags`, method: 'GET' })
                .then(res => updateBadge(ollamaBadge, res.status===200, 'Connected'))
                .catch(() => updateBadge(ollamaBadge, false, 'Error'));
                
            new obsidian.Setting(containerEl)
                .setName('Model')
                .setDesc('Enter Ollama model name.')
                .addText(text => text
                    .setPlaceholder('qwen2.5:7b')
                    .setValue(this.plugin.settings.templateModel || 'qwen2.5:7b')
                    .onChange(async (value) => {
                        this.plugin.settings.templateModel = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // ==========================================
        // 3. LOG EXECUTOR
        // ==========================================
        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: 'Log Executor' });
        
        new obsidian.Setting(containerEl)
            .setName('Provider')
            .setDesc('Select the LLM provider for processing and execution.')
            .addDropdown(dropdown => dropdown
                .addOption('gemini', 'Gemini (Google API)')
                .addOption('ollama', 'Ollama (Local)')
                .setValue(this.plugin.settings.executorProvider || 'gemini')
                .onChange(async (value) => {
                    this.plugin.settings.executorProvider = value;
                    if (value === 'ollama' && !this.plugin.settings.executorModel.includes(':')) {
                        this.plugin.settings.executorModel = 'qwen2.5:7b';
                    } else if (value === 'gemini' && this.plugin.settings.executorModel.includes(':')) {
                        this.plugin.settings.executorModel = 'gemini-2.5-flash';
                    }
                    await this.plugin.saveSettings();
                    this.display();
                }));

        if (this.plugin.settings.executorProvider === 'gemini') {
            let geminiSecretId = this.plugin.settings.geminiApiKeyId || 'omni-logger-gemini-api-key';
            const geminiSetting = new obsidian.Setting(containerEl)
                .setName('Gemini API Key')
                .setDesc('Used for Log Execution. (Shared)')
                .addText(text => {
                    text.inputEl.type = 'password';
                    text.setPlaceholder('Enter Gemini API Key');
                    this.plugin.getSecret(geminiSecretId, 'geminiApiKey').then(secret => {
                        if (secret && secret.length > 10) {
                            text.setValue(secret.substring(0, 8) + '...' + secret.substring(secret.length - 4));
                        }
                    });
                    text.onChange(async (value) => {
                        if (value && value.length > 20) {
                            await this.plugin.setSecret(geminiSecretId, 'geminiApiKey', value);
                            let displayStr = value.substring(0, 8) + '...' + value.substring(value.length - 4);
                            text.setValue(displayStr);
                            new obsidian.Notice("Gemini API Key saved!");
                        } else if (value.trim() === '') {
                            await this.plugin.setSecret(geminiSecretId, 'geminiApiKey', '');
                        }
                    });
                })
                .addButton(btn => btn
                    .setButtonText('Test')
                    .onClick(async () => {
                        const key = await this.plugin.getSecret(geminiSecretId, 'geminiApiKey');
                        if (!key) {
                            new obsidian.Notice('Gemini API Key is empty.');
                            return;
                        }
                        btn.setButtonText('Testing...');
                        try {
                            const res = await requestWithTimeout({
                                url: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
                                method: 'GET'
                            });
                            if (res.status === 200) {
                                new obsidian.Notice('Gemini API connection successful!');
                            } else {
                                new obsidian.Notice(`Gemini API error: Status ${res.status}`);
                            }
                        } catch(e) {
                            new obsidian.Notice(`Gemini API connection failed: ${e.message}`);
                        } finally {
                            btn.setButtonText('Test');
                        }
                    })
                );
                
            new obsidian.Setting(containerEl)
                .setName('Model')
                .setDesc('Gemini model to use.')
                .addDropdown(dropdown => dropdown
                    .addOption('gemini-2.5-flash', 'Gemini 2.5 Flash')
                    .addOption('gemini-2.5-pro', 'Gemini 2.5 Pro')
                    .setValue(this.plugin.settings.executorModel || 'gemini-2.5-flash')
                    .onChange(async (value) => {
                        this.plugin.settings.executorModel = value;
                        await this.plugin.saveSettings();
                    }));
        } else {
            const ollamaSetting = new obsidian.Setting(containerEl)
                .setName('Ollama Server URL')
                .setDesc('Local URL for Ollama API. (Shared)')
                .addText(text => text
                    .setPlaceholder('http://localhost:11434')
                    .setValue(this.plugin.settings.ollamaUrl || 'http://localhost:11434')
                    .onChange(async (value) => {
                        this.plugin.settings.ollamaUrl = value;
                        await this.plugin.saveSettings();
                    }))
                .addButton(btn => btn
                    .setButtonText('Test')
                    .onClick(async () => {
                        const url = this.plugin.settings.ollamaUrl || 'http://localhost:11434';
                        btn.setButtonText('Testing...');
                        try {
                            const res = await requestWithTimeout({
                                url: `${url}/api/tags`,
                                method: 'GET'
                            });
                            if (res.status === 200) {
                                new obsidian.Notice('Ollama server is online!');
                            } else {
                                new obsidian.Notice(`Ollama server returned status ${res.status}`);
                            }
                        } catch(e) {
                            new obsidian.Notice(`Ollama server connection failed: ${e.message}`);
                        } finally {
                            btn.setButtonText('Test');
                        }
                    })
                );
                
            new obsidian.Setting(containerEl)
                .setName('Model')
                .setDesc('Enter Ollama model name.')
                .addText(text => text
                    .setPlaceholder('qwen2.5:7b')
                    .setValue(this.plugin.settings.executorModel || 'qwen2.5:7b')
                    .onChange(async (value) => {
                        this.plugin.settings.executorModel = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // ==========================================
        // 4. CUSTOM LOGS & TEMPLATES (Collapsible)
        // ==========================================
        containerEl.createEl('hr');
        const customLogsDetails = containerEl.createEl('details');
        customLogsDetails.style.marginBottom = '20px';
        customLogsDetails.style.border = '1px solid var(--background-modifier-border)';
        customLogsDetails.style.borderRadius = '6px';
        customLogsDetails.style.padding = '8px';
        const customLogsSummary = customLogsDetails.createEl('summary', { text: '🛠️ Custom Logs & Templates' });
        customLogsSummary.style.cursor = 'pointer';
        customLogsSummary.style.fontSize = '1.2em';
        customLogsSummary.style.fontWeight = 'bold';
        customLogsSummary.style.color = 'var(--text-accent)';
        
        const customLogsDetailsContainer = customLogsDetails.createDiv();
        customLogsDetailsContainer.style.paddingTop = '10px';

        new obsidian.Setting(customLogsDetailsContainer)
            .setName('Ingredients Folder')
            .setDesc('Directory in the vault where custom template ingredients are stored.')
            .addText(text => text
                .setPlaceholder('Omni_Templates')
                .setValue(this.plugin.settings.ingredientsFolder || 'Omni_Templates')
                .onChange(async (value) => {
                    this.plugin.settings.ingredientsFolder = value;
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(customLogsDetailsContainer)
            .setName('Enable Background BLE Sync on this Machine')
            .setDesc('Toggle whether background Bluetooth sync tasks run on this specific computer. (Saved locally in local-settings.json, does not sync over Obsidian Sync).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.localSettings?.enableBLESync !== false)
                .onChange(async (value) => {
                    this.plugin.localSettings.enableBLESync = value;
                    await this.plugin.saveLocalSettings();
                }));

        new obsidian.Setting(customLogsDetailsContainer)
            .setName('Scan BLE Devices')
            .setDesc('Scan for visible Bluetooth Low Energy devices nearby.')
            .addButton(btn => btn
                .setButtonText('Scan Now')
                .onClick(async () => {
                    btn.setButtonText('Scanning...');
                    new obsidian.Notice("Starting Bluetooth scan...");
                    const child_process = require('child_process');
                    const path = require('path');
                    const vaultPath = this.plugin.app.vault.adapter.getBasePath();
                    const sep = vaultPath.includes('/') ? '/' : '\\';
                    const pluginDir = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger`;
                    const venvPython = require('os').platform() === 'win32'
                        ? path.join(pluginDir, '.venv', 'Scripts', 'python.exe')
                        : path.join(pluginDir, '.venv', 'bin', 'python');
                    const pythonCmd = require('fs').existsSync(venvPython) ? `"${venvPython}"` : 'python';
                    const scriptPath = `${pluginDir}${sep}ble_scan.py`;
                    
                    child_process.exec(`${pythonCmd} "${scriptPath}"`, (err, stdout, stderr) => {
                        btn.setButtonText('Scan Now');
                        if (err) {
                            new obsidian.Notice("Scan failed: " + (stderr || err.message));
                            return;
                        }
                        try {
                            const devices = JSON.parse(stdout.trim());
                            if (devices.error) {
                                new obsidian.Notice("Scan failed: " + devices.error);
                            } else if (devices.length === 0) {
                                new obsidian.Notice("No BLE devices found nearby.");
                            } else {
                                const listStr = devices.map(d => `• ${d.name} (${d.address})`).join('\n');
                                new obsidian.Notice(`Found BLE Devices:\n\n${listStr}`, 10000);
                            }
                        } catch (e) {
                            new obsidian.Notice("Failed to parse scan output: " + stdout);
                        }
                    });
                })
            );

        const templatesContainer = customLogsDetailsContainer.createDiv();
        const renderTemplates = () => {
            templatesContainer.empty();
            const templates = this.plugin.settings.customTemplates || [];
            
            if (templates.length === 0) {
                templatesContainer.createEl('p', { text: 'No custom templates found. Ensure they exist in your Ingredients Folder!', cls: 'setting-item-description' });
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
                    
                    header.createSpan({ text: `${t.name} (${(t.mode||'').toUpperCase()})` });
                    
                    const controls = header.createDiv();
                    controls.style.display = 'flex';
                    controls.style.alignItems = 'center';
                    
                    const destSelect = controls.createEl('select');
                    destSelect.style.marginRight = '10px';
                    
                    const optYaml = destSelect.createEl('option', { value: 'frontmatter', text: 'YAML Frontmatter' });
                    const optDb = destSelect.createEl('option', { value: 'dataview', text: 'Dataview Inline' });
                    const optApp = destSelect.createEl('option', { value: 'append-log', text: 'Append to Bottom' });
                    
                    destSelect.value = t.destination || 'frontmatter';
                    
                    const editBtn = controls.createEl('button', { text: 'Save' });
                    editBtn.style.marginRight = '5px';
                    
                    const delBtn = controls.createEl('button', { text: 'Delete' });
                    delBtn.onclick = async () => {
                        await this.plugin.deleteCustomTemplateFromVault(t.name);
                        renderTemplates();
                    };
                    
                    let configArea;
                    if (t.mode === 'ble') {
                        configArea = itemDiv.createEl('textarea');
                        configArea.style.width = '100%';
                        configArea.style.marginTop = '10px';
                        configArea.style.height = '180px';
                        configArea.style.fontFamily = 'monospace';
                        
                        const bleConfig = Object.assign({}, t);
                        delete bleConfig.prompt;
                        delete bleConfig.instructions;
                        delete bleConfig.exampleInput;
                        delete bleConfig.targetAppearance;
                        configArea.value = JSON.stringify(bleConfig, null, 2);

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
                        const styleSelect = styleRow.createEl('select');
                        styleSelect.createEl('option', { value: 'manual', text: 'Manual (Button/Palette)' });
                        styleSelect.createEl('option', { value: 'automatic', text: 'Automatic (Background Polling)' });
                        styleSelect.value = t.syncStyle || 'manual';
                        
                        const intervalRow = syncStyleContainer.createDiv();
                        intervalRow.style.display = 'flex';
                        intervalRow.style.justifyContent = 'space-between';
                        intervalRow.style.alignItems = 'center';
                        intervalRow.createSpan({ text: "Sync Frequency (minutes):" });
                        const intervalInput = intervalRow.createEl('input', { type: 'number' });
                        intervalInput.style.width = '70px';
                        intervalInput.min = '1';
                        intervalInput.value = t.syncInterval || 15;
                        
                        const warningEl = syncStyleContainer.createEl('p', { 
                            text: "⚠️ Warning: Polling more frequently will drain the device's battery significantly faster.",
                            cls: 'setting-item-description'
                        });
                        warningEl.style.color = 'var(--text-accent)';
                        warningEl.style.fontSize = '0.85em';
                        warningEl.style.margin = '4px 0 0 0';
                        
                        const updateConfigArea = () => {
                            try {
                                const parsed = JSON.parse(configArea.value);
                                parsed.syncStyle = styleSelect.value;
                                parsed.syncInterval = parseInt(intervalInput.value) || 15;
                                parsed.destination = destSelect.value;
                                configArea.value = JSON.stringify(parsed, null, 2);
                            } catch(e) {}
                        };
                        
                        const toggleInterval = () => {
                            if (styleSelect.value === 'automatic') {
                                intervalRow.style.display = 'flex';
                                warningEl.style.display = 'block';
                            } else {
                                intervalRow.style.display = 'none';
                                warningEl.style.display = 'none';
                            }
                        };
                        
                        styleSelect.onchange = () => {
                            toggleInterval();
                            updateConfigArea();
                        };
                        intervalInput.onchange = () => {
                            updateConfigArea();
                        };
                        destSelect.onchange = () => {
                            updateConfigArea();
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
                        t._promptArea = promptArea;

                        const codeBlockRow = itemDiv.createDiv();
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
                        const metadataPath = `${this.app.vault.adapter.getBasePath()}/${this.plugin.settings.ingredientsFolder}/${cleanDirName}/metadata.json`;
                        const fs = require('fs');
                        
                        if (t.mode === 'ble') {
                            try {
                                const parsedConfig = JSON.parse(configArea.value);
                                Object.assign(t, parsedConfig);
                                t.destination = destSelect.value;
                                t.syncStyle = styleSelect.value;
                                t.syncInterval = parseInt(intervalInput.value) || 15;
                                
                                const cleanMeta = {
                                    id: t.id,
                                    name: t.name,
                                    mode: t.mode,
                                    destination: t.destination,
                                    macAddress: t.macAddress,
                                    useLoraxHandshake: t.useLoraxHandshake,
                                    commandUuid: t.commandUuid,
                                    responseUuid: t.responseUuid,
                                    handshakeKeyBase64: t.handshakeKeyBase64,
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
                            t.prompt = t._promptArea ? t._promptArea.value : '';
                            if (fs.existsSync(metadataPath)) {
                                try {
                                    let m = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                                    m.prompt = t.prompt;
                                    m.destination = t.destination;
                                    fs.writeFileSync(metadataPath, JSON.stringify(m, null, 2), 'utf8');
                                    await this.plugin.updateMetaBindButton(t);
                                    new obsidian.Notice(`Saved template "${t.name}"!`);
                                } catch(e) {
                                    new obsidian.Notice(`Failed to save template file: ${e.message}`);
                                }
                            } else {
                                try {
                                    const dirPath = `${this.app.vault.adapter.getBasePath()}/${this.plugin.settings.ingredientsFolder}/${cleanDirName}`;
                                    if (!fs.existsSync(dirPath)) {
                                        fs.mkdirSync(dirPath, { recursive: true });
                                    }
                                    const m = {
                                        id: t.id,
                                        name: t.name,
                                        destination: t.destination,
                                        prompt: t.prompt,
                                        mode: t.mode
                                    };
                                    fs.writeFileSync(metadataPath, JSON.stringify(m, null, 2), 'utf8');
                                    new obsidian.Notice(`Created and saved template "${t.name}"!`);
                                } catch(e) {
                                    new obsidian.Notice(`Failed to write template file: ${e.message}`);
                                }
                            }
                        }
                    };
                }
            }
        };
        renderTemplates();

        const addTemplateBtn = customLogsDetailsContainer.createEl('button', { text: '+ Create New Template via LLM', cls: 'mod-cta' });
        addTemplateBtn.style.marginTop = '10px';
        addTemplateBtn.onclick = () => {
            new OmniTemplateCreatorModal(this.app, this.plugin, async () => {
                await this.plugin.loadCustomTemplatesFromVault();
                renderTemplates();
            }).open();
        };
    }
}
class OmniLoggerModal extends obsidian.Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.selectedType = 'calls';
        this.selectedMode = 'ocr';
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
        typeSelect.createEl('option', { value: 'calls', text: 'Work Calls' });
        typeSelect.createEl('option', { value: 'lumosity', text: 'Lumosity Daily Scores' });
        typeSelect.createEl('option', { value: 'health', text: 'Google Health/Vitals' });
        
        if (this.plugin.settings.customTemplates) {
            for (const t of this.plugin.settings.customTemplates) {
                typeSelect.createEl('option', { value: t.id, text: `[Custom] ${t.name}` });
            }
        }
        typeSelect.value = this.selectedType;
        
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
                    if (this.selectedType === 'health') {
                        statusBar.setText('Calling Google Health API...');
                        await this.plugin.pullGoogleHealthData();
                        statusBar.setText('Successfully pulled Google Health data!');
                        new obsidian.Notice("Successfully synced health stats from Google API!");
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
                            new obsidian.Notice("Successfully logged scores/counts to Daily Note!");
                            setTimeout(() => this.close(), 1500);
                        } else {
                            statusBar.setText('Unsupported configuration.');
                            processBtn.disabled = false;
                        }
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

class OmniTemplateCreatorModal extends obsidian.Modal {
    constructor(app, plugin, onSave) {
        super(app);
        this.plugin = plugin;
        this.onSave = onSave;
        this.name = "";
        this.mode = "ocr";
        this.destination = "frontmatter";
        this.exampleInput = ""; 
        this.targetAppearance = "";
        this.customInstructions = "";
        this.generatedPrompt = "";
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: 'Create Custom Logging Template', cls: 'omni-modal-title' });
        
        const mainContainer = contentEl.createDiv({ cls: 'omni-modal-container' });
        
        const nameSetting = new obsidian.Setting(mainContainer)
            .setName('Template Name')
            .setDesc('E.g., "Duolingo XP" or "LeetCode Stats"')
            .addText(text => text
                .setPlaceholder('Enter name')
                .onChange(val => this.name = val.trim())
            );

        const modeSetting = new obsidian.Setting(mainContainer)
            .setName('Source Mode')
            .setDesc('Select the method to capture data: Clipboard/OCR, Direct API, or BLE Polling.')
            .addDropdown(dropdown => dropdown
                .addOption('ocr', 'Clipboard / OCR')
                .addOption('api', 'API / Text Payload')
                .addOption('ble', 'Bluetooth Low Energy (BLE)')
                .setValue(this.mode)
                .onChange(val => {
                    this.mode = val;
                    this.exampleInput = "";
                    updateInputSection();
                    updateButtons();
                })
            );

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

        mainContainer.createEl('h4', { text: 'Example Input Data' });
        const inputSection = mainContainer.createDiv();

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

        const apiTextarea = document.createElement('textarea');
        apiTextarea.className = 'omni-api-textarea';
        apiTextarea.placeholder = 'Paste example API response JSON or description of the text here...';
        apiTextarea.style.width = '100%';
        apiTextarea.style.height = '120px';
        apiTextarea.onchange = (e) => {
            this.exampleInput = e.target.value;
        };

        const bleContainer = document.createElement('div');
        bleContainer.className = 'omni-ble-creator-container';
        bleContainer.createEl('p', { text: 'Configure default BLE fields for the new template.' });
        
        const macSetting = new obsidian.Setting(bleContainer)
            .setName('Device MAC Address')
            .setDesc('Enter the target BLE MAC address (e.g. 84:71:27:56:30:07). Use the Settings scan tool to discover it.')
            .addText(text => text
                .setPlaceholder('AA:BB:CC:DD:EE:FF')
                .onChange(val => this.macAddress = val.trim())
            );

        const updateInputSection = () => {
            inputSection.empty();
            if (this.mode === 'ocr') {
                previewContainer.style.display = 'none';
                dropZone.style.display = 'flex';
                inputSection.appendChild(ocrContainer);
            } else if (this.mode === 'api') {
                apiTextarea.value = "";
                inputSection.appendChild(apiTextarea);
            } else if (this.mode === 'ble') {
                inputSection.appendChild(bleContainer);
            }
        };

        const updateButtons = () => {
            if (this.mode === 'ble') {
                generateBtn.style.display = 'none';
                saveBtn.style.display = 'inline-block';
                statusBar.setText("Status: Configure details and click Save.");
            } else {
                generateBtn.style.display = 'inline-block';
                saveBtn.style.display = 'none';
                reviewContainer.style.display = 'none';
                statusBar.setText("Status: Fill details and generate prompt.");
            }
        };

        updateInputSection();
        updateButtons();

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

        const actionRow = mainContainer.createDiv({ cls: 'omni-action-row', style: 'margin-top:16px;' });
        
        const generateBtn = actionRow.createEl('button', { text: 'Generate Prompt via LLM', cls: 'omni-btn btn-process' });
        const cancelBtn = actionRow.createEl('button', { text: 'Cancel', cls: 'omni-btn btn-cancel' });
        cancelBtn.onclick = () => this.close();

        const saveBtn = actionRow.createEl('button', { text: 'Save Template', cls: 'omni-btn btn-process', style: 'display:none;' });
        
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
                const generated = await this.plugin.generateCustomTemplatePrompt(
                    this.name,
                    this.mode,
                    this.exampleInput,
                    this.targetAppearance,
                    this.destination,
                    this.customInstructions
                );
                
                this.generatedPrompt = generated;
                promptReview.value = generated;
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
                    macAddress: this.macAddress || "00:00:00:00:00:00",
                    useLoraxHandshake: false,
                    commandUuid: "",
                    responseUuid: "",
                    handshakeKeyBase64: "",
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
                    destination: this.destination,
                    prompt: this.generatedPrompt
                };
            }
            await this.plugin.saveCustomTemplateToVault(newTemplate, this.exampleInput, this.targetAppearance, this.customInstructions);
            new obsidian.Notice("Saved template " + this.name);
            if (this.onSave) {
                this.onSave();
            }
            this.close();
        };
    }

    onClose() {
        if (this.pasteListener) {
            this.contentEl.removeEventListener('paste', this.pasteListener);
        }
        this.contentEl.empty();
    }
}

class OmniFoodLoggerModal extends obsidian.Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.selectedFoodId = "";
        this.logAmount = 1.0;
        
        // Form fields for new item
        this.newId = "";
        this.newName = "";
        this.newCategory = "nutrition";
        this.newUnit = "serving";
        this.newProtein = 0;
        this.newCalories = 0;
        this.newCaffeine = 0;
        this.newAlcohol = 0;
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
        
        tabLog.style.cursor = 'pointer';
        tabLog.style.fontWeight = 'bold';
        tabLog.style.color = 'var(--text-accent)';
        
        tabAdd.style.cursor = 'pointer';
        tabAdd.style.color = 'var(--text-muted)';
        
        const mainContainer = contentEl.createDiv();
        
        const renderLogTab = async () => {
            mainContainer.empty();
            tabLog.style.color = 'var(--text-accent)';
            tabLog.style.fontWeight = 'bold';
            tabAdd.style.color = 'var(--text-muted)';
            tabAdd.style.fontWeight = 'normal';
            
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
                    
                    // Trigger post_nutrition.py script via plugin runPythonScript
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
            
            new obsidian.Setting(mainContainer)
                .setName('Unique ID')
                .setDesc('E.g. "espresso_double" or "peanut_butter"')
                .addText(text => text.onChange(val => this.newId = val.trim().toLowerCase().replace(/\s+/g, '_')));
                
            new obsidian.Setting(mainContainer)
                .setName('Display Name')
                .setDesc('E.g. "Double Espresso" or "Organic Peanut Butter"')
                .addText(text => text.onChange(val => this.newName = val.trim()));
                
            new obsidian.Setting(mainContainer)
                .setName('Category')
                .addDropdown(dropdown => dropdown
                    .addOption('caffeine', 'Caffeine')
                    .addOption('alcohol', 'Alcohol')
                    .addOption('nutrition', 'General Nutrition')
                    .setValue(this.newCategory)
                    .onChange(val => this.newCategory = val)
                );
                
            new obsidian.Setting(mainContainer)
                .setName('Unit Name')
                .setDesc('E.g. "shot", "can", "serving"')
                .addText(text => text.setValue(this.newUnit).onChange(val => this.newUnit = val.trim()));
                
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
                
                // Construct nutrients payload
                const nutrients = {};
                let healthType = "nutrition";
                
                if (this.newCategory === "caffeine" && this.newCaffeine > 0) {
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
                    health_connect_type: healthType,
                    nutrients: nutrients
                };
                
                items.push(newItem);
                await this.plugin.saveGoToItems(items);
                new obsidian.Notice(`Added ${this.newName} to Registry!`);
                renderLogTab();
            };
        };
        
        tabLog.onclick = renderLogTab;
        tabAdd.onclick = renderAddTab;
        
        renderLogTab();
    }

    onClose() {
        this.contentEl.empty();
    }
}

class OmniHealthHistoryModal extends obsidian.Modal {
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
                        title = `💧 Water (${amount} ml)`;
                        details = `${Math.round(amount * 0.033814)} oz`;
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

module.exports = OmniLoggerPlugin;

