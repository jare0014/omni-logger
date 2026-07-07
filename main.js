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
    omniHealthInstructions: 'You are a health tracker assistant. Examine this health dashboard screenshot and extract sleep hours, wake up time, heart rate variability (HRV), sleep score, and readiness score if visible.\n\nReturn findings strictly in a JSON format matching this schema:\n{\n  "Sleep_hours": "H:MM",\n  "wake_up": "H:MM",\n  "HRV": 55,\n  "Sleep_score": 75,\n  "Readiness": 80\n}\nEnsure no other text is returned besides the JSON.',
    customTemplates: [],
    apiConnections: [],
    healthSyncConfig: {
        sleep: { enabled: true, destination: "frontmatter", key: "Sleep_hours", syncStyle: "manual", syncInterval: 60 },
        hrv: { enabled: true, destination: "frontmatter", key: "HRV", syncStyle: "manual", syncInterval: 60 },
        caffeine: { enabled: true, destination: "frontmatter", key: "caffeine" },
        alcohol: { enabled: true, destination: "frontmatter", key: "alcohol" },
        hydration: { enabled: true, destination: "frontmatter", key: "hydration", syncStyle: "manual", syncInterval: 60 },
        protein: { enabled: false, destination: "frontmatter", key: "protein" },
        calories: { enabled: false, destination: "frontmatter", key: "calories" },
        nutrition: { enabled: true, syncStyle: "manual", syncInterval: 60 }
    },
    requestedScopes: [
        "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
        "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
        "https://www.googleapis.com/auth/googlehealth.nutrition.readonly",
        "https://www.googleapis.com/auth/googlehealth.nutrition.writeonly"
    ],
    googleHealthSleepPrompt: 'Examine the raw Google Fitness API JSON payload representing my sleep sessions for today. Extract the longest sleep session and calculate the total sleep duration (minutesAsleep). Output the sleep duration in the exact format H:MM (e.g. 7:04). Also extract the wake up time from the end of the session, making sure to apply the endUtcOffset to convert the Zulu time into local time (e.g. if time is 09:54Z and offset is -18000s (5 hours), local time is 04:54). Format the wake up time as H:MM (24-hour time or just without AM/PM). Your output MUST be a valid JSON object with keys like "Sleep" and "Wakeup". Do not wrap in markdown blocks. Example: { "Sleep": "7:05", "Wakeup": "4:54" }',
    googleHealthVitalsPrompt: 'Examine the raw Google Fitness API JSON payload representing heart rate variability (HRV) for today. Extract the averageHeartRateVariabilityMilliseconds or RMSSD metric. Round the value to the nearest integer. Your output MUST be a valid JSON object with keys like "HRV". Example: { "HRV": 44 }',
    googleHealthNutritionPrompt: 'Examine the raw Google Fitness API JSON payload representing my food logs for today. Summarize total caffeine, alcohol, protein, and calories. IMPORTANT: The API may provide caffeine and alcohol in GRAMS (e.g. 0.225 grams). You MUST convert this to MILLIGRAMS (mg) by multiplying by 1000 (e.g. 0.225g = 225mg). Output values as numbers without units. If any nutrient is missing from the payload, output 0 for that nutrient. Your output MUST be a valid JSON object with exactly these keys: "caffeine", "alcohol", "protein", "calories". Example: { "caffeine": 225, "alcohol": 0, "protein": 0, "calories": 0 }',
    googleHealthHydrationPrompt: 'Examine the raw Google Fitness API JSON payload representing hydration. Summarize total water intake in milliliters. Your output MUST be a valid JSON object with keys like "hydration". Example: { "hydration": 750 }',
    gitRepoPaths: [
        "c:\\Users\\jare0\\Documents\\Obsidian",
        "c:\\Users\\jare0\\Documents\\Obsidian\\04_Projects\\Quant",
        "c:\\Users\\jare0\\Documents\\Obsidian\\04_Projects\\chaos-dashboard",
        "c:\\Users\\jare0\\Documents\\Obsidian\\04_Projects\\omni-logger",
        "c:\\Users\\jare0\\Documents\\Obsidian\\04_Projects\\schedule-assistant-focus-timer",
        "c:\\Users\\jare0\\Documents\\Obsidian\\04_Projects\\knowledge-pipeline"
    ].join('\n'),
    gitAuthor: "",
    gitTargetHeading: "## 🪵 Log",
    autoSyncOnStartup: false,
    enableClipboardOcr: false,
    gitSyncStyle: 'manual',
    gitSyncInterval: 60,
    googleHealthSyncStyle: 'manual',
    googleHealthSyncInterval: 60,
    deletedBuiltInTemplates: [],
    dashboardDateRange: 14,
    dashboardExcludeWeekends: true,
    dashboardCards: [
        { key: "Sleep_score", label: "Sleep Score", unit: "", agg: "average", chartType: "line", color: "#6366f1" },
        { key: "Sleep_hours", label: "Sleep Hours", unit: "hrs", agg: "average", chartType: "line", color: "#10b981" },
        { key: "Readiness", label: "Readiness", unit: "", agg: "average", chartType: "line", color: "#ec4899" },
        { key: "HRV", label: "HRV", unit: "ms", agg: "average", chartType: "line", color: "#f59e0b" }
    ],
    openaiApiKeyId: 'omni-logger-openai-api-key',
    openaiApiKey: ''
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

    initializeDefaultConnectionsAndTemplates() {
        if (!this.settings.apiConnections || this.settings.apiConnections.length === 0) {
            this.settings.apiConnections = [
                {
                    id: 'google-health',
                    name: 'Google Health API',
                    url: 'https://health.googleapis.com/v4/users/me',
                    authType: 'oauth2',
                    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                    tokenUrl: 'https://oauth2.googleapis.com/token',
                    scopes: [
                        "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
                        "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
                        "https://www.googleapis.com/auth/googlehealth.nutrition.readonly",
                        "https://www.googleapis.com/auth/googlehealth.nutrition.writeonly"
                    ],
                    redirectUri: 'http://localhost:8092',
                    clientId: '',
                    clientSecret: ''
                }
            ];
        }

        if (!this.settings.customTemplates) {
            this.settings.customTemplates = [];
        }
    }

    registerDashboardCodeBlock() {
        this.registerMarkdownCodeBlockProcessor("omni-dashboard", async (source, el, ctx) => {
            el.empty();
            const wrapper = el.createDiv({ cls: 'omni-dashboard-wrapper' });
            wrapper.style.padding = '10px 0';
            wrapper.style.fontFamily = "'Outfit', 'Inter', -apple-system, sans-serif";
            
            const styleId = 'omni-dashboard-styles';
            if (!document.getElementById(styleId)) {
                const styleEl = document.createElement("style");
                styleEl.id = styleId;
                styleEl.textContent = `
                    .omni-db-container {
                        color: var(--text-normal);
                        background-color: var(--background-primary);
                        padding: 16px;
                        border-radius: 12px;
                    }
                    .omni-db-header {
                        margin-bottom: 24px;
                    }
                    .omni-db-title {
                        font-size: 1.8em;
                        font-weight: 700;
                        margin: 0;
                        background: linear-gradient(90deg, #818cf8, #ec4899);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                    }
                    .omni-db-subtitle {
                        font-size: 0.9em;
                        color: var(--text-muted);
                        margin: 4px 0 0 0;
                    }
                    .omni-db-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                        gap: 16px;
                        margin-bottom: 24px;
                    }
                    .omni-db-card {
                        background-color: var(--background-secondary);
                        border: 1px solid var(--background-modifier-border);
                        border-radius: 10px;
                        padding: 16px;
                        transition: transform 0.2s ease, box-shadow 0.2s ease;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
                    }
                    .omni-db-card:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                        border-color: var(--interactive-accent);
                    }
                    .omni-db-card-title {
                        font-size: 0.85em;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: var(--text-muted);
                        margin: 0 0 8px 0;
                    }
                    .omni-db-card-value {
                        font-size: 1.8em;
                        font-weight: 700;
                        margin: 0;
                        color: var(--text-normal);
                        display: flex;
                        align-items: baseline;
                        gap: 8px;
                    }
                    .omni-db-card-unit {
                        font-size: 0.5em;
                        color: var(--text-muted);
                        font-weight: 400;
                    }
                    .omni-db-card-trend {
                        font-size: 0.75em;
                        margin-top: 6px;
                        font-weight: 600;
                    }
                    .omni-trend-up { color: #10b981; }
                    .omni-trend-down { color: #ef4444; }
                    .omni-trend-neutral { color: var(--text-muted); }
                    
                    .omni-db-charts-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                        gap: 20px;
                        margin-bottom: 24px;
                    }
                    .omni-db-chart-container {
                        background-color: var(--background-secondary);
                        border: 1px solid var(--background-modifier-border);
                        border-radius: 12px;
                        padding: 16px;
                        height: 320px;
                    }
                    .omni-db-chart-title {
                        font-size: 1em;
                        font-weight: 600;
                        margin: 0 0 16px 0;
                        color: var(--text-normal);
                        border-left: 3px solid var(--interactive-accent);
                        padding-left: 8px;
                    }
                    .omni-db-chart-canvas-wrapper {
                        position: relative;
                        height: calc(100% - 36px);
                        width: 100%;
                    }
                    
                    .omni-db-table-container {
                        background-color: var(--background-secondary);
                        border: 1px solid var(--background-modifier-border);
                        border-radius: 12px;
                        padding: 16px;
                        overflow-x: auto;
                        margin-bottom: 24px;
                    }
                    .omni-db-table-title {
                        font-size: 1.1em;
                        font-weight: 600;
                        margin: 0 0 12px 0;
                    }
                    .omni-db-table {
                        width: 100%;
                        border-collapse: collapse;
                        text-align: left;
                        font-size: 0.9em;
                    }
                    .omni-db-table th, .omni-db-table td {
                        padding: 10px 12px;
                        border-bottom: 1px solid var(--background-modifier-border);
                    }
                    .omni-db-table th {
                        font-weight: 600;
                        color: var(--text-muted);
                    }
                    .omni-db-table tr:hover td {
                        background-color: var(--background-primary-alt);
                    }
                `;
                document.head.appendChild(styleEl);
            }
            
            let configDays = this.settings.dashboardDateRange || 14;
            let configExcludeWeekends = this.settings.dashboardExcludeWeekends !== false;
            
            if (source) {
                const YAML = require('yaml');
                try {
                    const parsedConfig = YAML.parse(source);
                    if (parsedConfig) {
                        if (parsedConfig.days !== undefined) configDays = parseInt(parsedConfig.days, 10);
                        if (parsedConfig['exclude-weekends'] !== undefined) configExcludeWeekends = !!parsedConfig['exclude-weekends'];
                    }
                } catch(e) {}
            }

            const dailyFiles = this.app.vault.getMarkdownFiles().filter(file => {
                const norm = file.path.replace(/\\/g, '/');
                return norm.includes('02_Journal/01_Daily') && file.name.match(/^\d{4}-\d{2}-\d{2}\.md$/);
            }).sort((a, b) => a.name.localeCompare(b.name));

            const dataset = [];
            for (let file of dailyFiles) {
                const dateStr = file.basename;
                const content = await this.app.vault.read(file);
                const cache = this.app.metadataCache.getFileCache(file);
                const frontmatter = cache?.frontmatter || {};
                
                const inlineData = {};
                const inlineRegex = /^([a-zA-Z0-9_\-]+)::\s*(.+)$/gm;
                let match;
                while ((match = inlineRegex.exec(content)) !== null) {
                    inlineData[match[1].trim()] = match[2].trim();
                }

                const getVal = (key) => {
                    if (frontmatter[key] !== undefined) return frontmatter[key];
                    if (inlineData[key] !== undefined) return inlineData[key];
                    for (let fKey in frontmatter) {
                        if (fKey.toLowerCase() === key.toLowerCase()) return frontmatter[fKey];
                    }
                    for (let iKey in inlineData) {
                        if (iKey.toLowerCase() === key.toLowerCase()) return inlineData[iKey];
                    }
                    return null;
                };

                const parsedRow = { date: dateStr };
                const cards = this.settings.dashboardCards || [];
                cards.forEach(card => {
                    const rawVal = getVal(card.key);
                    let val = 0;
                    if (rawVal !== undefined && rawVal !== null && rawVal !== "" && rawVal !== "-") {
                        const str = String(rawVal).trim();
                        if (str.includes(":")) {
                            const parts = str.split(":");
                            if (parts.length >= 2) {
                                const hrs = parseInt(parts[0], 10) || 0;
                                const mins = parseInt(parts[1], 10) || 0;
                                val = hrs + (mins / 60);
                            }
                        } else {
                            const num = parseFloat(str.replace(/[^0-9.\-]/g, ""));
                            val = isNaN(num) ? 0 : num;
                        }
                    }
                    parsedRow[card.key] = val;
                });
                
                dataset.push(parsedRow);
            }

            if (dataset.length === 0) {
                wrapper.createDiv({ text: 'No daily notes data found.' });
                return;
            }

            dataset.sort((a, b) => a.date.localeCompare(b.date));
            const latest = dataset[dataset.length - 1];
            const rangeData = dataset.slice(-configDays);
            const baselineDays = rangeData.slice(0, -1);
            
            const filteredBaseline = configExcludeWeekends
                ? baselineDays.filter(d => {
                    const day = window.moment(d.date).day();
                    return day !== 0 && day !== 6;
                })
                : baselineDays;

            const dbContainer = wrapper.createDiv({ cls: 'omni-db-container' });
            const header = dbContainer.createDiv({ cls: 'omni-db-header' });
            header.createEl('h2', { text: 'Readiness & Productivity Dashboard', cls: 'omni-db-title' });
            header.createEl('p', { 
                text: `Latest Update: ${latest.date} | Historical baseline computed over prior ${filteredBaseline.length} days (Range: ${configDays} days)`, 
                cls: 'omni-db-subtitle' 
            });

            const grid = dbContainer.createDiv({ cls: 'omni-db-grid' });
            const cards = this.settings.dashboardCards || [];

            cards.forEach(card => {
                const cardEl = grid.createDiv({ cls: 'omni-db-card' });
                cardEl.createEl('h4', { text: card.label, cls: 'omni-db-card-title' });
                
                const val = latest[card.key] || 0;
                let formattedVal = val;
                if (card.unit === 'hrs') {
                    formattedVal = Math.round(val * 100) / 100;
                } else if (card.agg === 'average') {
                    formattedVal = Math.round(val);
                }

                const valEl = cardEl.createEl('p', { cls: 'omni-db-card-value' });
                valEl.appendText(String(formattedVal));
                if (card.unit) {
                    const unitSpan = document.createElement('span');
                    unitSpan.className = 'omni-db-card-unit';
                    unitSpan.textContent = ' ' + card.unit;
                    valEl.appendChild(unitSpan);
                }

                let sum = 0, count = 0;
                filteredBaseline.forEach(d => {
                    if (d[card.key] !== undefined && d[card.key] !== null) {
                        sum += d[card.key];
                        count++;
                    }
                });
                const baselineAvg = count > 0 ? (sum / count) : 0;
                const diff = val - baselineAvg;
                
                let trendClass = 'omni-trend-neutral';
                let trendText = 'No baseline';
                
                if (baselineAvg > 0 && val > 0) {
                    const pct = Math.round((diff / baselineAvg) * 100);
                    const sign = pct >= 0 ? '+' : '';
                    trendText = `${sign}${pct}% vs avg (${Math.round(baselineAvg)})`;
                    
                    if (pct === 0) {
                        trendClass = 'omni-trend-neutral';
                    } else if (pct > 0) {
                        trendClass = 'omni-trend-up';
                    } else {
                        trendClass = 'omni-trend-down';
                    }
                }
                cardEl.createEl('div', { text: trendText, cls: `omni-db-card-trend ${trendClass}` });
            });

            const chartsGrid = dbContainer.createDiv({ cls: 'omni-db-charts-grid' });
            const chartCards = cards.filter(c => c.chartType && c.chartType !== 'none');
            const canvases = [];
            chartCards.forEach((card, idx) => {
                const chartBox = chartsGrid.createDiv({ cls: 'omni-db-chart-container' });
                chartBox.createEl('h4', { text: `${card.label} Trend (${configDays}-Day)`, cls: 'omni-db-chart-title' });
                const wrapper = chartBox.createDiv({ cls: 'omni-db-chart-canvas-wrapper' });
                const canvas = wrapper.createEl('canvas', { attr: { id: `omni_chart_${card.key}_${idx}` } });
                canvases.push({ canvas, card });
            });

            const renderAllCharts = () => {
                const chartData = rangeData;
                const labels = chartData.map(d => d.date.substring(5));
                const isDark = document.body.classList.contains("theme-dark");
                const textColor = isDark ? "#b3b3b3" : "#555555";
                const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

                canvases.forEach(({ canvas, card }) => {
                    const ctx = canvas.getContext('2d');
                    const chartId = `instance_${canvas.id}`;
                    if (window[chartId]) window[chartId].destroy();
                    
                    window[chartId] = new Chart(ctx, {
                        type: card.chartType,
                        data: {
                            labels: labels,
                            datasets: [{
                                label: card.label,
                                data: chartData.map(d => d[card.key] || null),
                                borderColor: card.color || '#6366f1',
                                backgroundColor: card.chartType === 'bar' ? (card.color || '#6366f1') + '66' : (card.color || '#6366f1') + '1a',
                                borderWidth: 2,
                                tension: 0.3,
                                spanGaps: true
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false }
                            },
                            scales: {
                                x: {
                                    grid: { color: gridColor },
                                    ticks: { color: textColor, font: { size: 9 } }
                                },
                                y: {
                                    grid: { color: gridColor },
                                    ticks: { color: textColor, font: { size: 9 } },
                                    beginAtZero: card.chartType === 'bar'
                                }
                            }
                        }
                    });
                });
            };

            if (typeof Chart === 'undefined') {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
                script.onload = () => renderAllCharts();
                document.head.appendChild(script);
            } else {
                renderAllCharts();
            }
        });
    }

    async archiveWeeklyReport() {
        const moment = window.moment;
        const now = moment();
        const startOfLastWeek = moment().subtract(7, 'days').startOf('day');
        const endOfLastWeek = moment().subtract(1, 'days').endOf('day');
        
        const weekNum = now.week();
        const yearNum = now.year();
        const reportFilename = `${yearNum}-W${String(weekNum).padStart(2, '0')}.md`;
        
        const dailyFiles = this.app.vault.getMarkdownFiles().filter(file => {
            const norm = file.path.replace(/\\/g, '/');
            if (!norm.includes('02_Journal/01_Daily') || !file.name.match(/^\d{4}-\d{2}-\d{2}\.md$/)) return false;
            const fileDate = moment(file.basename, 'YYYY-MM-DD');
            return fileDate.isSameOrAfter(startOfLastWeek) && fileDate.isSameOrBefore(endOfLastWeek);
        }).sort((a, b) => a.name.localeCompare(b.name));
        
        if (dailyFiles.length === 0) {
            new obsidian.Notice("No daily notes found in the last 7 days to compile a report!");
            return;
        }
        
        new obsidian.Notice("Compiling weekly report...");
        
        let markdown = `# 📊 Weekly Health & Productivity Report (${yearNum}-W${weekNum})\n`;
        markdown += `Report compiled on: ${now.format('YYYY-MM-DD HH:mm:ss')}\n`;
        markdown += `Period: ${startOfLastWeek.format('YYYY-MM-DD')} to ${endOfLastWeek.format('YYYY-MM-DD')}\n\n`;
        
        const cards = this.settings.dashboardCards || [];
        markdown += `## 📈 Summary Metrics\n\n`;
        markdown += `| Date | ` + cards.map(c => c.label).join(' | ') + ` |\n`;
        markdown += `| --- | ` + cards.map(() => '---').join(' | ') + ` |\n`;
        
        const parsedRows = [];
        for (let file of dailyFiles) {
            const dateStr = file.basename;
            const content = await this.app.vault.read(file);
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter || {};
            
            const inlineData = {};
            const inlineRegex = /^([a-zA-Z0-9_\-]+)::\s*(.+)$/gm;
            let match;
            while ((match = inlineRegex.exec(content)) !== null) {
                inlineData[match[1].trim()] = match[2].trim();
            }
            
            const getVal = (key) => {
                if (frontmatter[key] !== undefined) return frontmatter[key];
                if (inlineData[key] !== undefined) return inlineData[key];
                for (let fKey in frontmatter) {
                    if (fKey.toLowerCase() === key.toLowerCase()) return frontmatter[fKey];
                }
                for (let iKey in inlineData) {
                    if (iKey.toLowerCase() === key.toLowerCase()) return inlineData[iKey];
                }
                return null;
            };
            
            const rowVals = [];
            const rowData = { date: dateStr };
            cards.forEach(card => {
                const rawVal = getVal(card.key);
                let val = 0;
                if (rawVal !== undefined && rawVal !== null && rawVal !== "" && rawVal !== "-") {
                    const str = String(rawVal).trim();
                    if (str.includes(":")) {
                        const parts = str.split(":");
                        if (parts.length >= 2) {
                            const hrs = parseInt(parts[0], 10) || 0;
                            const mins = parseInt(parts[1], 10) || 0;
                            val = hrs + (mins / 60);
                        }
                    } else {
                        const num = parseFloat(str.replace(/[^0-9.\-]/g, ""));
                        val = isNaN(num) ? 0 : num;
                    }
                }
                rowData[card.key] = val;
                
                let displayVal = val;
                if (card.unit === 'hrs') displayVal = (Math.round(val * 100) / 100) + ' hrs';
                else if (card.unit) displayVal = val + ' ' + card.unit;
                rowVals.push(displayVal);
            });
            parsedRows.push(rowData);
            markdown += `| **${dateStr}** | ` + rowVals.join(' | ') + ` |\n`;
        }
        
        markdown += `\n### 📊 Weekly Baselines & Averages\n\n`;
        const averages = [];
        cards.forEach(card => {
            let sum = 0, count = 0;
            parsedRows.forEach(row => {
                if (row[card.key] !== undefined && row[card.key] !== null) {
                    sum += row[card.key];
                    count++;
                }
            });
            const avg = count > 0 ? (sum / count) : 0;
            let displayAvg = Math.round(avg * 100) / 100;
            if (card.unit) displayAvg += ' ' + card.unit;
            averages.push(`*   **${card.label}:** ${displayAvg}`);
        });
        markdown += averages.join('\n') + `\n`;
        
        const folderPath = '08_Health/Reports/Weekly';
        const fullFilePath = `${folderPath}/${reportFilename}`;
        
        const fs = require('fs');
        const path = require('path');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const absFolderPath = path.join(vaultPath, folderPath.replace(/\//g, path.sep));
        const absFilePath = path.join(vaultPath, fullFilePath.replace(/\//g, path.sep));
        
        if (!fs.existsSync(absFolderPath)) {
            fs.mkdirSync(absFolderPath, { recursive: true });
        }
        
        fs.writeFileSync(absFilePath, markdown, 'utf8');
        new obsidian.Notice(`Archived weekly health report as: ${fullFilePath}`);
    }

    getBuiltInGoogleTemplate(templateId) {
        const syncConfig = this.settings.healthSyncConfig || {};
        if (templateId === 'google-sleep') {
            const sleepCfg = syncConfig.sleep || { enabled: true, destination: "frontmatter", key: "Sleep_hours" };
            return {
                id: 'google-sleep',
                name: 'Google Sleep',
                mode: 'api',
                connectionId: 'google-health',
                destination: sleepCfg.destination || 'frontmatter',
                key: sleepCfg.key || 'Sleep_hours',
                prompt: this.settings.googleHealthSleepPrompt || DEFAULT_SETTINGS.googleHealthSleepPrompt
            };
        }
        if (templateId === 'google-hrv') {
            const hrvCfg = syncConfig.hrv || { enabled: true, destination: "frontmatter", key: "HRV" };
            return {
                id: 'google-hrv',
                name: 'Google HRV',
                mode: 'api',
                connectionId: 'google-health',
                destination: hrvCfg.destination || 'frontmatter',
                key: hrvCfg.key || 'HRV',
                prompt: this.settings.googleHealthVitalsPrompt || DEFAULT_SETTINGS.googleHealthVitalsPrompt
            };
        }
        if (templateId === 'google-hydration') {
            const hydCfg = syncConfig.hydration || { enabled: true, destination: "frontmatter", key: "hydration" };
            return {
                id: 'google-hydration',
                name: 'Google Hydration',
                mode: 'api',
                connectionId: 'google-health',
                destination: hydCfg.destination || 'frontmatter',
                key: hydCfg.key || 'hydration',
                prompt: this.settings.googleHealthHydrationPrompt || DEFAULT_SETTINGS.googleHealthHydrationPrompt
            };
        }
        if (templateId === 'google-nutrition') {
            const calCfg = syncConfig.calories || { enabled: false, destination: "frontmatter", key: "calories" };
            return {
                id: 'google-nutrition',
                name: 'Google Nutrition',
                mode: 'api',
                connectionId: 'google-health',
                destination: calCfg.destination || 'frontmatter',
                key: calCfg.key || 'calories',
                prompt: this.settings.googleHealthNutritionPrompt || DEFAULT_SETTINGS.googleHealthNutritionPrompt
            };
        }
        return null;
    }

    async onload() {
        await this.loadSettings();
        await this.loadLocalSettings();
        this.initializeDefaultConnectionsAndTemplates();
        await this.saveSettings();
        this.ensureVenv();
        await this.loadCustomTemplatesFromVault();
        this.registerCustomTemplateCommands();
        this.registerDashboardCodeBlock();

        // Register Command to Archive Weekly Report
        this.addCommand({
            id: 'archive-weekly-report',
            name: 'Archive Weekly Health & Productivity Report',
            callback: () => this.archiveWeeklyReport()
        });

        // Register Command to Open Modal
        this.addCommand({
            id: 'open-omni-logger',
            name: 'Open Omni-Logger Modal',
            callback: () => {
                new OmniLoggerModal(this.app, this).open();
            }
        });

        // Add Git Logging commands absorbed from git-logger
        this.addCommand({
            id: 'log-today-git-history',
            name: 'Log Today\'s Git History',
            callback: () => this.logGitHistory(),
        });

        this.addRibbonIcon('git-branch', 'Log Git Activity', () => {
            this.logGitHistory();
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
        this.backgroundSyncInterval = setInterval(() => this.runBackgroundSyncs(), 60 * 1000);

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

        // Auto-sync on startup if enabled and API configuration is set
        if (this.settings.autoSyncOnStartup && this.settings.dataSourceApi === 'google-health') {
            this.app.workspace.onLayoutReady(async () => {
                try {
                    console.log("Omni-Logger: Performing auto-sync on startup...");
                    await this.pullGoogleHealthData();
                    console.log("Omni-Logger: Auto-sync completed successfully.");
                } catch (e) {
                    console.warn("Omni-Logger: Startup auto-sync failed:", e);
                }
            });
        }
    }

    registerSingleTemplateCommand(t) {
        const path = require('path');
        const vaultPath = this.app.vault.adapter.getBasePath();
        const folderName = this.settings.ingredientsFolder || 'Omni_Templates';
        
        const fullId = `omni-logger:run-template-${t.id}`;
        if (this.app.commands?.commands?.[fullId]) {
            delete this.app.commands.commands[fullId];
        }
        
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
                } else if (t.mode === 'api') {
                    new obsidian.Notice(`Syncing API connection for ${t.name}...`);
                    this.syncApiTemplate(t.id);
                } else {
                    const modal = new OmniLoggerModal(this.app, this);
                    modal.selectedType = t.id;
                    modal.selectedMode = t.mode;
                    modal.open();
                }
            }
        });
    }

    registerCustomTemplateCommands() {
        for (const t of this.settings.customTemplates) {
            this.registerSingleTemplateCommand(t);
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
        fs.writeFileSync(path.join(dirPath, 'system_prompt.txt'), template.prompt || '', 'utf8');
        
        // Save parser script if present
        if (template.pythonCode) {
            fs.writeFileSync(path.join(dirPath, 'parser.py'), template.pythonCode, 'utf8');
        }
        
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
        } else if (template.mode === 'api') {
            metadata.connectionId = template.connectionId;
            metadata.syncStyle = template.syncStyle || "manual";
            metadata.syncInterval = template.syncInterval || 60;
        }
        fs.writeFileSync(path.join(dirPath, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
        
        await this.updateMetaBindButton(template);
        
        // Reload templates
        await this.loadCustomTemplatesFromVault();
        
        // Dynamically register the command with Obsidian
        this.registerSingleTemplateCommand(template);
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
            
            const btnId = `${t.id}-btn`;
            let existing = data.buttonTemplates.find(b => b.id === btnId);
            
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
            new obsidian.Notice(`Meta Bind button "${btnId}" synchronized! (Note: Reload the Meta Bind plugin or restart Obsidian to apply)`);
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

    async runBackgroundSyncs() {
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
            } else if (t.mode === 'api' && t.syncStyle === 'automatic') {
                const intervalMinutes = t.syncInterval || 60;
                const lastSync = this.lastSyncTimes[t.id] || 0;
                const now = Date.now();
                
                if (now - lastSync >= intervalMinutes * 60 * 1000) {
                    this.lastSyncTimes[t.id] = now;
                    console.log(`[Omni-Logger] Automatic background API sync triggered for template "${t.name}" (ID: ${t.id})`);
                    try {
                        await this.syncApiTemplate(t.id);
                    } catch(e) {
                        console.error(`Automatic sync failed for template "${t.name}":`, e);
                    }
                }
            }
        }

        // Built-in Git Logger background sync
        if (this.settings.gitSyncStyle === 'automatic') {
            const gitInterval = this.settings.gitSyncInterval || 60;
            const lastGitSync = this.lastSyncTimes['git'] || 0;
            const now = Date.now();
            if (now - lastGitSync >= gitInterval * 60 * 1000) {
                this.lastSyncTimes['git'] = now;
                console.log(`[Omni-Logger] Automatic background Git sync triggered`);
                this.logGitHistory();
            }
        }

        // Built-in Google Health background sync
        if (this.settings.googleHealthSyncStyle === 'automatic') {
            const healthInterval = this.settings.googleHealthSyncInterval || 60;
            const lastHealthSync = this.lastSyncTimes['google-health'] || 0;
            const now = Date.now();
            if (now - lastHealthSync >= healthInterval * 60 * 1000) {
                this.lastSyncTimes['google-health'] = now;
                console.log(`[Omni-Logger] Automatic background Google Health sync triggered`);
                try {
                    await this.pullGoogleHealthData();
                } catch(e) {
                    console.error("Automatic Google Health sync failed:", e);
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
        } else if (provider === 'openai') {
            let apiKey = await this.getSecret(this.settings.openaiApiKeyId || 'omni-logger-openai-api-key', 'openaiApiKey');
            if (!apiKey) {
                throw new Error("OpenAI API Key not configured! Please configure it in settings.");
            }
            const url = 'https://api.openai.com/v1/chat/completions';
            const messages = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            const userContent = [];
            if (promptText) {
                userContent.push({ type: 'text', text: promptText });
            }
            if (imageBase64 && imageMimeType) {
                const base64Data = imageBase64.startsWith('data:') ? imageBase64 : `data:${imageMimeType};base64,${imageBase64}`;
                userContent.push({
                    type: 'image_url',
                    image_url: { url: base64Data }
                });
            }
            messages.push({ role: 'user', content: userContent.length === 1 && userContent[0].type === 'text' ? userContent[0].text : userContent });

            const payload = {
                model: model || 'gpt-4o-mini',
                messages: messages,
                response_format: { type: "json_object" }
            };

            const response = await obsidian.requestUrl({
                url: url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (response.status !== 200) {
                throw new Error(`OpenAI API error ${response.status}: ${response.text}`);
            }

            const resData = response.json;
            return resData.choices[0].message.content.trim();
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

    getBLEDevicesDir() {
        const path = require('path');
        return path.join(this.app.vault.adapter.getBasePath(), '.obsidian', 'plugins', 'omni-logger', 'bluetooth_devices');
    }

    listPairedDevices() {
        const fs = require('fs');
        const path = require('path');
        const devDir = this.getBLEDevicesDir();
        if (!fs.existsSync(devDir)) return [];
        try {
            return fs.readdirSync(devDir)
                .filter(f => f.endsWith('.json'))
                .map(f => {
                    try {
                        const data = JSON.parse(fs.readFileSync(path.join(devDir, f), 'utf8'));
                        return data;
                    } catch (e) { return null; }
                })
                .filter(Boolean);
        } catch (e) {
            console.error("[Omni-Logger] Failed to list bluetooth_devices/:", e);
            return [];
        }
    }

    savePairedDevice(deviceObj) {
        const fs = require('fs');
        const path = require('path');
        const devDir = this.getBLEDevicesDir();
        fs.mkdirSync(devDir, { recursive: true });
        const fileName = `${deviceObj.name}.json`;
        fs.writeFileSync(path.join(devDir, fileName), JSON.stringify(deviceObj, null, 2), 'utf8');
    }

    removePairedDevice(deviceName) {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(this.getBLEDevicesDir(), `${deviceName}.json`);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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
                if (fallbackSettingKey) {
                    this.settings[fallbackSettingKey] = "";
                    await this.saveSettings();
                }
                return;
            } catch (e) {
                try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Keychain] setSecret in secretStorage failed: ${e.message}\n`); } catch(e) {}
                console.error(`Failed to set secret ${secretId} in secretStorage:`, e);
            }
        }
        if (fallbackSettingKey) {
            this.settings[fallbackSettingKey] = value;
            try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Keychain] setSecret fallback done\n`); } catch(e) {}
            await this.saveSettings();
        }
    }

    async storeSecret(secretId, value) {
        return this.setSecret(secretId, '', value);
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
        const token = await this.getAccessTokenForConnection('google-health');
        if (!token) {
            throw new Error("Google Health Access Token not found. Please connect the Google Health API connection first.");
        }
        return token;
    }

    async pullGoogleHealthData() {
        const googleTemplates = ['google-sleep', 'google-hrv', 'google-hydration', 'google-nutrition'];
        for (const tid of googleTemplates) {
            let t = this.settings.customTemplates?.find(temp => temp.id === tid);
            if (!t) {
                t = this.getBuiltInGoogleTemplate(tid);
            }
            if (!t) continue;
            // Only pull if enabled in settings
            const cat = tid.replace('google-', '');
            
            let isEnabled = false;
            if (cat === 'nutrition') {
                const subMetrics = ['caffeine', 'alcohol', 'calories', 'protein'];
                isEnabled = subMetrics.some(sub => {
                    const subCfg = this.settings.healthSyncConfig?.[sub];
                    return !subCfg || subCfg.enabled !== false;
                });
            } else {
                const cfg = this.settings.healthSyncConfig?.[cat];
                isEnabled = !cfg || cfg.enabled !== false;
            }
            
            if (isEnabled) {
                try {
                    await this.syncApiTemplate(tid);
                } catch(e) {
                    console.warn(`Failed to sync category ${cat}:`, e);
                }
            }
        }
    }

    async syncApiTemplate(templateId) {
        let t = this.settings.customTemplates?.find(temp => temp.id === templateId);
        if (!t) {
            t = this.getBuiltInGoogleTemplate(templateId);
        }
        if (!t || t.mode !== 'api') return;
        
        try {
            const payloadText = await this.fetchPayloadForTemplate(t);
            let extracted = {};
            if (['google-sleep', 'google-hrv', 'google-hydration', 'google-nutrition'].includes(t.id)) {
                extracted = this.parseGoogleHealthPayloadLocally(t.id, payloadText);
            } else {
                const fs = require('fs');
                const path = require('path');
                const vaultPath = this.app.vault.adapter.getBasePath();
                const folderName = this.settings.ingredientsFolder || 'Omni_Templates';
                const cleanDirName = t.name.replace(/[^a-zA-Z0-9 _-]/g, '');
                const parserPath = path.join(vaultPath, folderName, cleanDirName, 'parser.py');
                
                let parsedLocally = false;
                if (fs.existsSync(parserPath)) {
                    const tempInputPath = path.join(vaultPath, folderName, cleanDirName, 'temp_input.txt');
                    fs.writeFileSync(tempInputPath, payloadText, 'utf8');
                    
                    try {
                        const resultText = await this.runPythonScript(parserPath, `"${tempInputPath}"`, true);
                        try { fs.unlinkSync(tempInputPath); } catch(e) {}
                        extracted = JSON.parse(resultText);
                        parsedLocally = true;
                        console.log(`Successfully parsed ${t.name} locally via Python parser.py`);
                    } catch(e) {
                        console.warn(`Local Python parser.py failed for ${t.name}, falling back to LLM:`, e);
                        try { fs.unlinkSync(tempInputPath); } catch(err) {}
                    }
                }
                
                if (!parsedLocally) {
                    const provider = this.settings.executorProvider || 'gemini';
                    const model = this.settings.executorModel || 'gemini-2.5-flash';
                    
                    const llmResponse = await this.callLLM(
                        provider,
                        model,
                        t.prompt,
                        `Here is the API response payload for today:\n${payloadText}`
                    );
                    
                    extracted = JSON.parse(llmResponse);
                }
            }
            
            // Map LLM output keys to target keys configured by the user
            const dataToWrite = {};
            const syncConfig = this.settings.healthSyncConfig || {};
            
            if (t.id === 'google-sleep') {
                const sleepCfg = syncConfig.sleep || { enabled: true, destination: "frontmatter", key: "Sleep_hours" };
                const sleepKey = sleepCfg.key || 'Sleep_hours';
                // Try finding sleep hours value from LLM response
                const sleepVal = extracted.Sleep || extracted.Sleep_hours || extracted.sleep || extracted.duration || "";
                const wakeupVal = extracted.Wakeup || extracted.wake_up || extracted.wakeup || "";
                if (sleepVal) dataToWrite[sleepKey] = sleepVal;
                if (wakeupVal) dataToWrite['wake_up'] = wakeupVal;
            } else if (t.id === 'google-hrv') {
                const hrvCfg = syncConfig.hrv || { enabled: true, destination: "frontmatter", key: "HRV" };
                const hrvKey = hrvCfg.key || 'HRV';
                const hrvVal = extracted.HRV || extracted.hrv || extracted.averageHeartRateVariabilityMilliseconds || extracted.rmssd || "";
                if (hrvVal) dataToWrite[hrvKey] = hrvVal;
            } else if (t.id === 'google-hydration') {
                const hydCfg = syncConfig.hydration || { enabled: true, destination: "frontmatter", key: "hydration" };
                const hydKey = hydCfg.key || 'hydration';
                const hydVal = extracted.hydration || extracted.volume || extracted.milliliters || extracted.amount || "";
                if (hydVal) dataToWrite[hydKey] = hydVal;
            } else if (t.id === 'google-nutrition') {
                const subMetrics = ['caffeine', 'alcohol', 'calories', 'protein'];
                subMetrics.forEach(sub => {
                    const cfg = syncConfig[sub] || { enabled: true, destination: "frontmatter", key: sub };
                    if (cfg.enabled) {
                        const key = cfg.key || sub;
                        let val = extracted[sub];
                        if (val === undefined) val = extracted[sub.toUpperCase()];
                        if (val === undefined) val = extracted[sub.charAt(0).toUpperCase() + sub.slice(1)];
                        
                        if (val !== undefined && val !== "") {
                            dataToWrite[key] = val;
                        }
                    }
                });
            } else {
                // For custom API templates, map if single key configured, otherwise write all extracted keys
                if (t.key) {
                    const keys = Object.keys(extracted);
                    if (keys.length === 1) {
                        dataToWrite[t.key] = extracted[keys[0]];
                    } else {
                        // Rename the key that matches t.key or t.name case-insensitively
                        const match = keys.find(k => k.toLowerCase() === t.key.toLowerCase() || k.toLowerCase().includes(t.name.toLowerCase()));
                        if (match) {
                            dataToWrite[t.key] = extracted[match];
                            keys.forEach(k => {
                                if (k !== match) dataToWrite[k] = extracted[k];
                            });
                        } else {
                            Object.assign(dataToWrite, extracted);
                        }
                    }
                } else {
                    Object.assign(dataToWrite, extracted);
                }
            }
            
            await this.writeCustomTemplateData(dataToWrite, t);
            new obsidian.Notice(`Sync complete for template: ${t.name}`);
        } catch(e) {
            console.error(`Sync failed for template ${t.name}:`, e);
            new obsidian.Notice(`Sync failed for ${t.name}: ${e.message}`);
            throw e;
        }
    }

    parseGoogleHealthPayloadLocally(templateId, payloadText) {
        try {
            const data = JSON.parse(payloadText);
            
            if (templateId === 'google-sleep') {
                const dataPoints = data.dataPoints || [];
                let longestSession = null;
                let maxMinutes = -1;
                for (const pt of dataPoints) {
                    const minutes = parseInt(pt.sleep?.summary?.minutesAsleep || "0");
                    if (minutes > maxMinutes) {
                        maxMinutes = minutes;
                        longestSession = pt;
                    }
                }
                
                if (longestSession) {
                    const minutesAsleep = parseInt(longestSession.sleep?.summary?.minutesAsleep || "0");
                    const hours = Math.floor(minutesAsleep / 60);
                    const mins = minutesAsleep % 60;
                    const sleepStr = `${hours}:${mins < 10 ? '0' : ''}${mins}`;
                    
                    let wakeupStr = "";
                    const endTimeStr = longestSession.sleep?.interval?.endTime;
                    if (endTimeStr) {
                        const offsetSecStr = longestSession.sleep?.interval?.endUtcOffset || "0s";
                        const offsetSec = parseInt(offsetSecStr.replace("s", ""));
                        const utcTime = new Date(endTimeStr).getTime();
                        const localTime = new Date(utcTime + offsetSec * 1000);
                        const localHours = localTime.getUTCHours();
                        const localMins = localTime.getUTCMinutes();
                        wakeupStr = `${localHours}:${localMins < 10 ? '0' : ''}${localMins}`;
                    }
                    return { Sleep: sleepStr, Wakeup: wakeupStr };
                }
                return { Sleep: "0:00", Wakeup: "" };
            }
            
            if (templateId === 'google-hrv') {
                const hrvLogs = data.hrvLogs || [];
                let totalHrv = 0;
                let hrvCount = 0;
                for (const pt of hrvLogs) {
                    const val = pt.dailyHeartRateVariability?.averageHeartRateVariabilityMilliseconds;
                    if (typeof val === 'number') {
                        totalHrv += val;
                        hrvCount++;
                    }
                }
                const averageHrv = hrvCount > 0 ? Math.round(totalHrv / hrvCount) : 0;
                return { HRV: averageHrv };
            }
            
            if (templateId === 'google-hydration') {
                const dataPoints = data.dataPoints || [];
                let totalMl = 0;
                for (const pt of dataPoints) {
                    const log = pt.hydrationLog || pt.value?.hydrationLog || {};
                    // Check milliliters first
                    const ml = log.amountConsumed?.milliliters || log.amountConsumedMilliliters || 0;
                    if (ml > 0) {
                        totalMl += ml;
                    } else {
                        // Fallback to liters
                        const litersVal = log.volume?.liters || log.volumeLiters || (typeof log.volume === 'number' ? log.volume : 0);
                        if (litersVal > 0) {
                            totalMl += litersVal * 1000;
                        }
                    }
                }
                return { hydration: Math.round(totalMl) };
            }
            
            if (templateId === 'google-nutrition') {
                const nutritionLogs = data.nutritionLogs || [];
                const alcoholConsumptionLogs = data.alcoholConsumptionLogs || [];
                
                const result = {};
                
                if (nutritionLogs.length > 0) {
                    let caffeineMg = 0;
                    let proteinGrams = 0;
                    let totalCalories = 0;
                    
                    for (const pt of nutritionLogs) {
                        const log = pt.nutritionLog || pt.value || {};
                        const energyKcal = log.energy?.kcal || log.energy?.kilocalories || 0;
                        totalCalories += energyKcal;
                        
                        const nutrients = log.nutrients || [];
                        for (const n of nutrients) {
                            const name = (n.nutrient || "").toUpperCase();
                            const grams = n.quantity?.grams || 0;
                            
                            if (name === "PROTEIN") {
                                proteinGrams += grams;
                            } else if (name === "CAFFEINE") {
                                caffeineMg += grams * 1000;
                            } else if (name === "ENERGY" || name === "CALORIES") {
                                const kcal = n.quantity?.kcal || n.quantity?.kilocalories || n.quantity?.calories || 0;
                                totalCalories += kcal;
                            }
                        }
                    }
                    result.caffeine = Math.round(caffeineMg);
                    result.protein = Math.round(proteinGrams);
                    result.calories = Math.round(totalCalories);
                }
                
                if (alcoholConsumptionLogs.length > 0) {
                    let alcoholMg = 0;
                    for (const pt of alcoholConsumptionLogs) {
                        const log = pt.alcoholConsumption || pt.value || {};
                        const grams = log.quantity?.grams || log.grams || 0;
                        alcoholMg += grams * 1000;
                    }
                    result.alcohol = Math.round(alcoholMg);
                }
                
                return result;
            }
        } catch (e) {
            console.error("Error in parseGoogleHealthPayloadLocally:", e);
        }
        return {};
    }

    async fetchPayloadForTemplate(t) {
        if (t.connectionId === 'google-health') {
            const token = await this.getGoogleAccessToken();
            const now = new Date();
            const startTime = new Date();
            startTime.setDate(now.getDate() - 1);
            startTime.setHours(12, 0, 0, 0);
            const endTime = new Date();
            endTime.setHours(12, 0, 0, 0);
            
            const startIso = startTime.toISOString();
            const endIso = endTime.toISOString();
            
            const localTzOffset = -now.getTimezoneOffset();
            const localTzSign = localTzOffset >= 0 ? '+' : '-';
            const localTzHours = String(Math.floor(Math.abs(localTzOffset) / 60)).padStart(2, '0');
            const localTzMins = String(Math.abs(localTzOffset) % 60).padStart(2, '0');
            const localTz = `${localTzSign}${localTzHours}:${localTzMins}`;
            
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            const dayStartIso = `${dateStr}T00:00:00${localTz}`;
            const dayEndIso = `${dateStr}T23:59:59${localTz}`;

            if (t.id === 'google-sleep') {
                const filter = `sleep.interval.end_time >= "${startIso}" AND sleep.interval.end_time < "${endIso}"`;
                const sleepUrl = `https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints?filter=${encodeURIComponent(filter)}`;
                const response = await obsidian.requestUrl({ url: sleepUrl, headers: { 'Authorization': `Bearer ${token}` } });
                return JSON.stringify(response.json || response.text);
            } else if (t.id === 'google-hrv') {
                const hrvUrl = "https://health.googleapis.com/v4/users/me/dataTypes/daily-heart-rate-variability/dataPoints";
                let hrvPoints = [];
                try {
                    let url = hrvUrl + "?pageSize=1000";
                    while (url) {
                        const resHrv = await obsidian.requestUrl({ url: url, headers: { 'Authorization': `Bearer ${token}` } });
                        const points = resHrv.json?.dataPoints || [];
                        hrvPoints.push(...points.filter(pt => {
                            if (pt.dailyHeartRateVariability?.date) {
                                const dObj = pt.dailyHeartRateVariability.date;
                                const dateStr = `${dObj.year}-${String(dObj.month).padStart(2, '0')}-${String(dObj.day).padStart(2, '0')}`;
                                return dateStr === now.toISOString().split('T')[0];
                            }
                            const timeStr = pt.dailyHeartRateVariability?.interval?.startTime || pt.value?.interval?.startTime || pt.startTime || "";
                            return timeStr && timeStr >= dayStartIso && timeStr < dayEndIso;
                        }));
                        if (resHrv.json?.nextPageToken) {
                            url = hrvUrl + "?pageSize=1000&pageToken=" + resHrv.json.nextPageToken;
                        } else {
                            url = null;
                        }
                    }
                } catch(e) {
                    console.warn("Failed to fetch HRV logs:", e);
                }
                return JSON.stringify({ hrvLogs: hrvPoints });
            } else if (t.id === 'google-hydration') {
                const hydUrl = "https://health.googleapis.com/v4/users/me/dataTypes/hydration-log/dataPoints";
                let hydPoints = [];
                try {
                    let url = hydUrl + "?pageSize=1000";
                    while (url) {
                        const response = await obsidian.requestUrl({ url: url, headers: { 'Authorization': `Bearer ${token}` } });
                        const points = response.json?.dataPoints || [];
                        hydPoints.push(...points.filter(pt => {
                            const timeStr = pt.hydrationLog?.interval?.startTime || pt.value?.interval?.startTime || "";
                            return timeStr && timeStr >= dayStartIso && timeStr <= dayEndIso;
                        }));
                        if (response.json?.nextPageToken) {
                            url = hydUrl + "?pageSize=1000&pageToken=" + response.json.nextPageToken;
                        } else {
                            url = null;
                        }
                    }
                } catch(e) {
                    console.warn("Failed to fetch Hydration logs:", e);
                }
                return JSON.stringify({ dataPoints: hydPoints });
            } else if (t.id === 'google-nutrition') {
                const nutritionUrl = "https://health.googleapis.com/v4/users/me/dataTypes/nutrition-log/dataPoints";
                const alcUrl = "https://health.googleapis.com/v4/users/me/dataTypes/alcohol-consumption/dataPoints";
                let nutPoints = [];
                let alcPoints = [];
                
                try {
                    let url = nutritionUrl + "?pageSize=1000";
                    while (url) {
                        const resNut = await obsidian.requestUrl({ url: url, headers: { 'Authorization': `Bearer ${token}` } });
                        const points = resNut.json?.dataPoints || [];
                        nutPoints.push(...points.filter(pt => {
                            const timeStr = pt.nutritionLog?.interval?.startTime || pt.value?.interval?.startTime || "";
                            return timeStr && timeStr >= dayStartIso && timeStr <= dayEndIso;
                        }));
                        if (resNut.json?.nextPageToken) {
                            url = nutritionUrl + "?pageSize=1000&pageToken=" + resNut.json.nextPageToken;
                        } else {
                            url = null;
                        }
                    }
                } catch(e) {
                    console.warn("Failed to fetch nutrition logs:", e);
                }
                
                try {
                    let url = alcUrl + "?pageSize=1000";
                    while (url) {
                        const resAlc = await obsidian.requestUrl({ url: url, headers: { 'Authorization': `Bearer ${token}` } });
                        const points = resAlc.json?.dataPoints || [];
                        alcPoints.push(...points.filter(pt => {
                            const timeStr = pt.alcoholConsumption?.interval?.startTime || pt.value?.interval?.startTime || "";
                            return timeStr && timeStr >= dayStartIso && timeStr <= dayEndIso;
                        }));
                        if (resAlc.json?.nextPageToken) {
                            url = alcUrl + "?pageSize=1000&pageToken=" + resAlc.json.nextPageToken;
                        } else {
                            url = null;
                        }
                    }
                } catch(e) {
                    console.warn("Failed to fetch alcohol logs:", e);
                }
                
                return JSON.stringify({ nutritionLogs: nutPoints, alcoholConsumptionLogs: alcPoints });
            }
        }

        // Otherwise, it is a custom API connection
        return await this.fetchFromApiConnection(t.connectionId);
    }

    async processOCR(base64Data, mimeType, type) {
        const customTemplate = this.settings.customTemplates?.find(t => t.id === type);
        if (!customTemplate) {
            throw new Error(`Template for type "${type}" not found.`);
        }
        const prompt = customTemplate.prompt;
        
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
When that model runs, it will be given a screenshot (if OCR mode) or an API response text (if API mode) and must extract relevant metrics to save to the user's daily note.`;

        if (mode === 'api') {
            instructions += `\nAdditionally, because this is an API mode template with structured JSON/text payload, you MUST write a python script 'parser.py' that can parse this payload locally and deterministically.
The python script will receive the filename of a temporary text file containing the raw payload text as its first argument (sys.argv[1]). It should read that file, parse it, extract the metrics, and print the resulting JSON strictly matching the schema to stdout (with no other text printed).`;
        }

        instructions += `\n\nHere are the details for the custom template:
- Template Name: ${name}
- Mode: ${mode === 'ocr' ? 'OCR (Screenshot)' : 'API (Text/JSON)'}
- Expected Target Output/Appearance:
${targetAppearance}
- Target Destination in Daily Note: ${destination} (can be 'frontmatter', 'dataview' inline fields like 'key:: value', or 'append-log' list/text block)`;

        if (customInstructions) {
            instructions += `\n- Custom Instructions/User Rules to incorporate: ${customInstructions}`;
        }

        instructions += `\n\nPlease write:
1. A system prompt that tells the model:
   a. What role to assume (e.g. an expert data extractor for ${name}).
   b. What specific visual features or text patterns to look for.
   c. Precisely what fields to extract and compile into a JSON object.
   d. Specify the exact JSON schema matching the fields in the user's expected target output.
   e. Emphasize returning ONLY the raw JSON object matching the schema.`;

        if (mode === 'api') {
            instructions += `\n2. A python script that implements this exact parser locally using sys.argv[1]. E.g.:
import sys
import json
# read file from sys.argv[1]
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    payload = f.read()
# Parse payload (using json.loads or regex)
# ...
result = { ... }
print(json.dumps(result))
Ensure only valid JSON is output, and no debug or extra text is printed.`;
        }

        instructions += `\n\nReturn your response strictly as a JSON object matching this schema:
{
  "prompt": "The full system prompt text you generated."${mode === 'api' ? ',\n  "pythonCode": "The full python script code you generated."' : ''}
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
        return { prompt: parsed.prompt, pythonCode: parsed.pythonCode || "" };
    }

    async startOAuth2Flow(connectionId) {
        const conn = this.settings.apiConnections?.find(c => c.id === connectionId);
        if (!conn) {
            throw new Error("Connection not found.");
        }

        const fs = require('fs');
        const path = require('path');
        const http = require('http');

        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const omniLoggerDir = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger`;

        let clientId = conn.clientId;
        let clientSecret = conn.clientSecret;

        // If client credentials are not saved in metadata, check secure storage
        if (!clientId) {
            const secretData = await this.getSecret(`omni-logger-api-client-${conn.id}`, '');
            if (secretData) {
                try {
                    const parsed = JSON.parse(secretData);
                    clientId = parsed.client_id;
                    clientSecret = parsed.client_secret;
                } catch(e) {}
            }
        }

        if (!clientId && conn.id === 'google-health') {
            // Try parsing pasted credentials JSON from settings
            if (this.settings.googleClientJson) {
                try {
                    const credsData = JSON.parse(this.settings.googleClientJson);
                    const web = credsData.installed || credsData.web || credsData;
                    if (web && web.client_id) {
                        clientId = web.client_id;
                        clientSecret = web.client_secret;
                    }
                } catch(e) {
                    console.error("Failed to parse googleClientJson settings:", e);
                }
            }

            // Check fallback path for backward compatibility
            if (!clientId) {
                let credsPath = `${omniLoggerDir}${sep}credentials.json`;
                if (!fs.existsSync(credsPath)) {
                    credsPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}schedule-assistant-focus-timer${sep}credentials.json`;
                }
                if (fs.existsSync(credsPath)) {
                    try {
                        const credsData = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                        const web = credsData.installed || credsData.web;
                        if (web) {
                            clientId = web.client_id;
                            clientSecret = web.client_secret;
                        }
                    } catch(e) {}
                }
            }
        }

        if (!clientId) {
            throw new Error(`OAuth Client ID/Secret not configured for connection "${conn.name}". Please add them via OAuth Client Secrets JSON.`);
        }

        const redirectUri = conn.redirectUri || "http://localhost:8092";
        const scopes = (conn.scopes || []).join(" ");

        const authUrl = `${conn.authUrl}?` +
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
                        url: conn.tokenUrl,
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
                        token_uri: conn.tokenUrl,
                        client_id: clientId,
                        client_secret: clientSecret,
                        refresh_token: tokenResponse.refresh_token
                    };

                    // Securely save in secret storage
                    await this.storeSecret(`omni-logger-oauth-token-${conn.id}`, JSON.stringify(tokenData));

                    if (conn.id === 'google-health') {
                        // Keep backwards compatibility for scripts reading token.json
                        const tokenPath = `${omniLoggerDir}${sep}token.json`;
                        fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2), 'utf8');
                    }

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                        <body style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #1e1e1e; color: #fff;">
                            <h2 style="color: #00ffd0;">Authorization Successful!</h2>
                            <p>Connection "${conn.name}" is now connected to Omni-Logger.</p>
                            <p>You can close this tab and return to Obsidian.</p>
                        </body>
                        </html>
                    `);

                    new obsidian.Notice(`Successfully authorized connection: ${conn.name}!`);
                } catch (err) {
                    console.error("OAuth token exchange failed:", err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end("Authentication failed: " + err.message);
                    new obsidian.Notice(`Authorization failed for "${conn.name}": ` + err.message);
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

        // Parse port from redirectUri
        let port = 8092;
        try {
            const redirectUrlObj = new URL(redirectUri);
            port = parseInt(redirectUrlObj.port) || 80;
        } catch(e) {}

        this.tempOAuthServer.listen(port, () => {
            console.log(`Omni-Logger OAuth temp server listening on port ${port}`);
            window.open(authUrl);
        });

        new obsidian.Notice(`Opening browser to authorize connection: ${conn.name}...`);
    }

    async startGoogleOAuthFlow(connectionId = 'health') {
        return this.startOAuth2Flow(connectionId === 'health' ? 'google-health' : connectionId);
    }

    async getAccessTokenForConnection(connectionId) {
        const conn = this.settings.apiConnections?.find(c => c.id === connectionId);
        if (!conn) return null;

        // Try getting token from secret storage
        let tokenStr = await this.getSecret(`omni-logger-oauth-token-${conn.id}`, '');
        
        if (!tokenStr && conn.id === 'google-health') {
            // Backward compatibility fallback to token.json
            const fs = require('fs');
            const path = require('path');
            const vaultPath = this.app.vault.adapter.getBasePath();
            const sep = vaultPath.includes('/') ? '/' : '\\';
            const tokenPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}token.json`;
            if (fs.existsSync(tokenPath)) {
                tokenStr = fs.readFileSync(tokenPath, 'utf8');
            }
        }

        if (!tokenStr) return null;

        let tokenData;
        try {
            tokenData = JSON.parse(tokenStr);
        } catch(e) {
            return null;
        }

        const expiryStr = tokenData.expiry;
        if (expiryStr) {
            let expiryDt;
            try {
                expiryDt = new Date(expiryStr);
            } catch (e) {
                expiryDt = new Date(Date.now() - 3600 * 1000);
            }

            const nowDt = new Date();
            // If token is still valid (at least 60 seconds remaining), return it
            if (expiryDt.getTime() - nowDt.getTime() > 60 * 1000) {
                return tokenData.token;
            }
        }

        // Token expired. Refresh it!
        console.log(`OAuth access token expired for connection "${conn.name}". Refreshing token...`);
        const url = tokenData.token_uri || conn.tokenUrl || "https://oauth2.googleapis.com/token";

        const bodyDetails = {
            grant_type: "refresh_token",
            client_id: tokenData.client_id,
            client_secret: tokenData.client_secret,
            refresh_token: tokenData.refresh_token
        };
        const body = Object.keys(bodyDetails)
            .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(bodyDetails[key]))
            .join('&');

        try {
            const response = await obsidian.requestUrl({
                url: url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            });

            if (response.status === 200) {
                const resData = response.json;
                tokenData.token = resData.access_token;
                if (resData.expires_in) {
                    const newExpiry = new Date();
                    newExpiry.setSeconds(newExpiry.getSeconds() + resData.expires_in);
                    tokenData.expiry = newExpiry.toISOString();
                }
                
                // Securely save back
                await this.storeSecret(`omni-logger-oauth-token-${conn.id}`, JSON.stringify(tokenData));
                
                if (conn.id === 'google-health') {
                    // Keep backwards compatibility for scripts reading token.json
                    const fs = require('fs');
                    const path = require('path');
                    const vaultPath = this.app.vault.adapter.getBasePath();
                    const sep = vaultPath.includes('/') ? '/' : '\\';
                    const tokenPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}token.json`;
                    fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2), 'utf8');
                }

                return tokenData.token;
            } else {
                console.error("Failed to refresh token:", response.text);
            }
        } catch(e) {
            console.error("Error refreshing token:", e);
        }

        return null;
    }

    async fetchFromApiConnection(connectionId) {
        const conn = this.settings.apiConnections?.find(c => c.id === connectionId);
        if (!conn) throw new Error("API connection not found.");
        
        let headers = {};
        if (conn.customHeaders) {
            try { headers = JSON.parse(conn.customHeaders); } catch(e) {}
        }
        
        if (conn.authType !== 'none') {
            if (conn.authType === 'oauth2') {
                const token = await this.getAccessTokenForConnection(conn.id);
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            } else {
                const secretId = `omni-logger-api-${conn.id}`;
                const token = await this.getSecret(secretId, '');
                if (token) {
                    if (conn.authType === 'bearer') {
                        headers['Authorization'] = `Bearer ${token}`;
                    } else if (conn.authType === 'apikey') {
                        const headerName = conn.apiKeyHeaderName || 'X-API-Key';
                        headers[headerName] = token;
                    } else if (conn.authType === 'cookie') {
                        headers['Cookie'] = token;
                    }
                }
            }
        }
        
        const params = {
            url: conn.url,
            method: conn.method || 'GET',
            headers: headers
        };
        
        const response = await obsidian.requestUrl(params);
        if (response.status !== 200) {
            throw new Error(`API returned status ${response.status}: ${response.text}`);
        }
        return response.text;
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
        const fs = require('fs');
        
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const projectDir = `${vaultPath}${sep}04_Projects${sep}hl7-nl-to-sql`;
        const scriptPath = `${projectDir}${sep}query_lake_obsidian.py`;
        
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
        
        // Use venv python if it exists
        const venvPython = process.platform === 'win32'
            ? path.join(projectDir, '.venv', 'Scripts', 'python.exe')
            : path.join(projectDir, '.venv', 'bin', 'python');
        const pythonCmd = fs.existsSync(venvPython) ? `"${venvPython}"` : 'python';
        
        const cmd = `${pythonCmd} -u "${scriptPath}" "${absoluteActivePath}"`;
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
        const fs = require('fs');
        
        const vaultPath = this.app.vault.adapter.getBasePath();
        const sep = vaultPath.includes('/') ? '/' : '\\';
        const projectDir = `${vaultPath}${sep}04_Projects${sep}hl7-nl-to-sql`;
        const scriptPath = `${projectDir}${sep}ingest_all_samples.py`;
        
        let geminiKey = await this.getSecret(this.settings.geminiApiKeyId || 'omni-logger-gemini-api-key', 'geminiApiKey');
        if (!geminiKey) {
            geminiKey = await this.getSecret('timeblocker-gemini-api-key', 'geminiApiKey');
        }
        const env = Object.assign({}, process.env, {
            GEMINI_API_KEY: geminiKey
        });
        
        // Use venv python if it exists
        const venvPython = process.platform === 'win32'
            ? path.join(projectDir, '.venv', 'Scripts', 'python.exe')
            : path.join(projectDir, '.venv', 'bin', 'python');
        const pythonCmd = fs.existsSync(venvPython) ? `"${venvPython}"` : 'python';
        
        const cmd = `${pythonCmd} -u "${scriptPath}"`;
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

    getLocalDateString() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    runGitLog(repoPath, date, authorFilter) {
        const fs = require('fs');
        const path = require('path');
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            const resolvedPath = path.resolve(repoPath.trim());
            if (!fs.existsSync(resolvedPath)) {
                return resolve({ repoPath: resolvedPath, error: "Directory path does not exist" });
            }

            // Command formats details as hash|time|author|message
            let cmd = `git log --since="${date} 00:00:00" --until="${date} 23:59:59" --pretty=format:"%h|%ad|%an|%s" --date=format:"%H:%M"`;
            if (authorFilter) {
                cmd += ` --author="${authorFilter.replace(/"/g, '\\"')}"`;
            }
            cmd += ` -- .`;

            exec(cmd, { cwd: resolvedPath }, (error, stdout, stderr) => {
                if (error) {
                    if (stderr.includes("not a git repository")) {
                        return resolve({ repoPath: resolvedPath, error: "Not a Git repository" });
                    }
                    return resolve({ repoPath: resolvedPath, error: stderr.trim() || error.message });
                }
                resolve({ repoPath: resolvedPath, stdout: stdout.trim() });
            });
        });
    }

    async logGitHistory() {
        const path = require('path');
        const dailyFile = this.getDailyNoteFile();
        if (!dailyFile) {
            new obsidian.Notice("Daily note not found. Please open or create today's daily note.");
            return;
        }

        // Detect date from daily note file name if format is YYYY-MM-DD.md
        let date = this.getLocalDateString();
        const dateMatch = dailyFile.name.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
        if (dateMatch) {
            date = dateMatch[1];
        }

        const repoList = this.settings.gitRepoPaths
            .split('\n')
            .map(p => p.trim())
            .filter(p => p.length > 0);

        if (repoList.length === 0) {
            new obsidian.Notice("No repositories configured in settings.");
            return;
        }

        new obsidian.Notice(`Fetching git activity for ${date}...`);

        const results = await Promise.all(
            repoList.map(repo => this.runGitLog(repo, date, this.settings.gitAuthor))
        );

        // Collect new commits grouped by repo name
        const newCommitsByRepo = new Map();
        let errors = [];

        results.forEach(res => {
            if (res.error) {
                errors.push(`${path.basename(res.repoPath)}: ${res.error}`);
                return;
            }

            if (!res.stdout) {
                return;
            }

            const repoName = path.basename(res.repoPath);
            const commits = res.stdout.split('\n').filter(l => l.trim().length > 0);

            if (commits.length > 0) {
                if (!newCommitsByRepo.has(repoName)) {
                    newCommitsByRepo.set(repoName, []);
                }
                const existing = newCommitsByRepo.get(repoName);
                const existingHashes = new Set(existing.map(c => c.hash));
                commits.forEach(commitLine => {
                    const [hash, time, author, msg] = commitLine.split('|');
                    // Deduplicate across paths that resolve to the same repo name
                    if (!existingHashes.has(hash)) {
                        existingHashes.add(hash);
                        existing.push({ hash, time, author, msg });
                    }
                });
            }
        });

        if (errors.length > 0) {
            console.warn("Git Logger errors:", errors);
        }

        const startMarker = '<!--START_Antigravity_Git_Log-->';
        const endMarker = '<!--END_Antigravity_Git_Log-->';

        // Read active file content and parse any existing git log block
        try {
            const content = await this.app.vault.read(dailyFile);
            const lines = content.split('\n');

            let startIndex = -1;
            let endIndex = -1;

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(startMarker)) {
                    startIndex = i;
                }
                if (lines[i].includes(endMarker)) {
                    endIndex = i;
                    break;
                }
            }

            // Parse existing entries from the block (if any) so we can merge
            const mergedByRepo = new Map();

            if (startIndex !== -1 && endIndex !== -1) {
                let currentRepo = null;
                for (let i = startIndex; i <= endIndex; i++) {
                    const repoMatch = lines[i].match(/^\*\*(.+)\*\*$/);
                    if (repoMatch) {
                        currentRepo = repoMatch[1];
                        if (!mergedByRepo.has(currentRepo)) {
                            mergedByRepo.set(currentRepo, []);
                        }
                        continue;
                    }
                    const commitMatch = lines[i].match(/^- `([a-f0-9]+)` \*\*(.+?)\*\* \(\*(.+?)\*\) — (.+)$/);
                    if (commitMatch && currentRepo) {
                        mergedByRepo.get(currentRepo).push({
                            hash: commitMatch[1],
                            time: commitMatch[2],
                            author: commitMatch[3],
                            msg: commitMatch[4]
                        });
                    }
                }
            }

            // Merge new commits into existing, deduplicating by hash
            let newCommitsAdded = 0;
            for (const [repoName, commits] of newCommitsByRepo) {
                if (!mergedByRepo.has(repoName)) {
                    mergedByRepo.set(repoName, []);
                }
                const repoEntries = mergedByRepo.get(repoName);
                const existingHashes = new Set(repoEntries.map(c => c.hash));
                for (const commit of commits) {
                    if (!existingHashes.has(commit.hash)) {
                        repoEntries.push(commit);
                        newCommitsAdded++;
                    }
                }
                // Sort entries by time within each repo
                repoEntries.sort((a, b) => a.time.localeCompare(b.time));
            }

            // Build the merged markdown block
            const totalCommits = Array.from(mergedByRepo.values()).reduce((sum, arr) => sum + arr.length, 0);
            let markdownLogs = [];
            for (const [repoName, commits] of mergedByRepo) {
                if (commits.length > 0) {
                    markdownLogs.push(`**${repoName}**`);
                    commits.forEach(c => {
                        markdownLogs.push(`- \`${c.hash}\` **${c.time}** (*${c.author}*) — ${c.msg}`);
                    });
                    markdownLogs.push("");
                }
            }

            let formattedLog = "";
            if (totalCommits > 0) {
                formattedLog = `${startMarker}\n### 🐙 Git Activity (${date})\n\n${markdownLogs.join('\n').trim()}\n${endMarker}`;
            } else {
                formattedLog = `${startMarker}\n### 🐙 Git Activity (${date})\n*No commits logged for today.*\n${endMarker}`;
            }

            if (startIndex !== -1 && endIndex !== -1) {
                // Merge-replace the existing block
                lines.splice(startIndex, endIndex - startIndex + 1, formattedLog);
            } else {
                // Find target heading
                let headingIndex = -1;
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(this.settings.gitTargetHeading)) {
                        headingIndex = i;
                        break;
                    }
                }

                if (headingIndex !== -1) {
                    // Find the end of the target heading section (stop before next header or end of file)
                    let insertIndex = headingIndex + 1;
                    while (insertIndex < lines.length) {
                        if (lines[insertIndex].startsWith('#')) {
                            break;
                        }
                        insertIndex++;
                    }

                    // Insert the log block. Ensure there's a clean line separator if necessary.
                    lines.splice(insertIndex, 0, "", formattedLog);
                } else {
                    // Append section to the end of the file if heading doesn't exist
                    lines.push("", this.settings.gitTargetHeading, "", formattedLog);
                }
            }

            await this.app.vault.modify(dailyFile, lines.join('\n'));
            new obsidian.Notice(`Logged ${totalCommits} total commits (${newCommitsAdded} new) to Daily Note.`);
        } catch (e) {
            console.error("Failed to write to daily note:", e);
            new obsidian.Notice("Failed to update Daily Note: " + e.message);
        }
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

        // =====================================================================
        // 1. 🤖 AI PROVIDER & TEMPLATE GENERATION (Top)
        // =====================================================================
        containerEl.createEl('h3', { text: '🤖 AI Provider & Template Generator' });

        new obsidian.Setting(containerEl)
            .setName('Provider')
            .setDesc('Select the LLM provider for Template Generation & OCR parsing.')
            .addDropdown(dropdown => dropdown
                .addOption('gemini', 'Gemini (Google API)')
                .addOption('ollama', 'Ollama (Local)')
                .addOption('openai', 'OpenAI (GPT)')
                .setValue(this.plugin.settings.templateProvider || 'gemini')
                .onChange(async (value) => {
                    this.plugin.settings.templateProvider = value;
                    if (value === 'ollama' && !this.plugin.settings.templateModel.includes(':')) {
                        this.plugin.settings.templateModel = 'qwen2.5:7b';
                    } else if (value === 'gemini' && this.plugin.settings.templateModel.includes(':')) {
                        this.plugin.settings.templateModel = 'gemini-2.5-flash';
                    } else if (value === 'openai') {
                        this.plugin.settings.templateModel = 'gpt-4o-mini';
                    }
                    await this.plugin.saveSettings();
                    this.display(); // full re-render
                }));

        if (this.plugin.settings.templateProvider === 'gemini') {
            let geminiSecretId = this.plugin.settings.geminiApiKeyId || 'omni-logger-gemini-api-key';
            const geminiSetting = new obsidian.Setting(containerEl)
                .setName('Gemini API Key')
                .setDesc('Used for template prompts and OCR parsing.')
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
        } else if (this.plugin.settings.templateProvider === 'openai') {
            let openaiSecretId = this.plugin.settings.openaiApiKeyId || 'omni-logger-openai-api-key';
            const openaiSetting = new obsidian.Setting(containerEl)
                .setName('OpenAI API Key')
                .setDesc('Used for template prompts and OCR parsing.')
                .addText(text => {
                    text.inputEl.type = 'password';
                    text.setPlaceholder('Enter OpenAI API Key');
                    this.plugin.getSecret(openaiSecretId, 'openaiApiKey').then(secret => {
                        if (secret && secret.length > 10) {
                            text.setValue(secret.substring(0, 8) + '...' + secret.substring(secret.length - 4));
                        }
                    });
                    text.onChange(async (value) => {
                        if (value && value.length > 20) {
                            await this.plugin.setSecret(openaiSecretId, 'openaiApiKey', value);
                            let displayStr = value.substring(0, 8) + '...' + value.substring(value.length - 4);
                            text.setValue(displayStr);
                            new obsidian.Notice("OpenAI API Key saved!");
                        } else if (value.trim() === '') {
                            await this.plugin.setSecret(openaiSecretId, 'openaiApiKey', '');
                        }
                    });
                })
                .addButton(btn => btn
                    .setButtonText('Test')
                    .onClick(async () => {
                        const key = await this.plugin.getSecret(openaiSecretId, 'openaiApiKey');
                        if (!key) {
                            new obsidian.Notice('OpenAI API Key is empty.');
                            return;
                        }
                        btn.setButtonText('Testing...');
                        try {
                            const res = await requestWithTimeout({
                                url: 'https://api.openai.com/v1/models',
                                method: 'GET',
                                headers: { 'Authorization': `Bearer ${key}` }
                            });
                            if (res.status === 200) {
                                new obsidian.Notice('OpenAI API connection successful!');
                                updateBadge(openaiBadge, true, 'Connected');
                            } else {
                                new obsidian.Notice(`OpenAI API error: Status ${res.status}`);
                                updateBadge(openaiBadge, false, 'Error');
                            }
                        } catch(e) {
                            new obsidian.Notice(`OpenAI API connection failed: ${e.message}`);
                            updateBadge(openaiBadge, false, 'Error');
                        } finally {
                            btn.setButtonText('Test');
                        }
                    })
                );
            const openaiBadge = createStatusBadge(openaiSetting.nameEl);
            this.plugin.getSecret(openaiSecretId, 'openaiApiKey').then(key => {
                if(key && key.length > 10) {
                    requestWithTimeout({ url: 'https://api.openai.com/v1/models', method: 'GET', headers: { 'Authorization': `Bearer ${key}` } })
                    .then(res => updateBadge(openaiBadge, res.status===200, 'Connected'))
                    .catch(() => updateBadge(openaiBadge, false, 'Error'));
                }
            });
            
            new obsidian.Setting(containerEl)
                .setName('Model')
                .setDesc('OpenAI model to use.')
                .addDropdown(dropdown => dropdown
                    .addOption('gpt-4o-mini', 'GPT-4o Mini')
                    .addOption('gpt-4o', 'GPT-4o')
                    .setValue(this.plugin.settings.templateModel || 'gpt-4o-mini')
                    .onChange(async (value) => {
                        this.plugin.settings.templateModel = value;
                        await this.plugin.saveSettings();
                    }));
        } else {
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

        // =====================================================================
        // 1B. ⚡ EXECUTION AI SETTINGS
        // =====================================================================
        containerEl.createEl('h3', { text: '⚡ Execution AI Settings' });

        new obsidian.Setting(containerEl)
            .setName('Execution Provider')
            .setDesc('Select the LLM provider for executing data extraction on raw payloads.')
            .addDropdown(dropdown => dropdown
                .addOption('gemini', 'Gemini (Google API)')
                .addOption('ollama', 'Ollama (Local)')
                .addOption('openai', 'OpenAI (GPT)')
                .setValue(this.plugin.settings.executorProvider || 'gemini')
                .onChange(async (value) => {
                    this.plugin.settings.executorProvider = value;
                    if (value === 'ollama' && !this.plugin.settings.executorModel.includes(':')) {
                        this.plugin.settings.executorModel = 'qwen2.5:7b';
                    } else if (value === 'gemini' && this.plugin.settings.executorModel.includes(':')) {
                        this.plugin.settings.executorModel = 'gemini-2.5-flash';
                    } else if (value === 'openai') {
                        this.plugin.settings.executorModel = 'gpt-4o-mini';
                    }
                    await this.plugin.saveSettings();
                    this.display(); // full re-render
                }));

        if (this.plugin.settings.executorProvider === 'gemini') {
            new obsidian.Setting(containerEl)
                .setName('Execution Model')
                .setDesc('Gemini model to use for execution.')
                .addDropdown(dropdown => dropdown
                    .addOption('gemini-2.5-flash', 'Gemini 2.5 Flash')
                    .addOption('gemini-2.5-pro', 'Gemini 2.5 Pro')
                    .setValue(this.plugin.settings.executorModel || 'gemini-2.5-flash')
                    .onChange(async (value) => {
                        this.plugin.settings.executorModel = value;
                        await this.plugin.saveSettings();
                    }));
        } else if (this.plugin.settings.executorProvider === 'openai') {
            new obsidian.Setting(containerEl)
                .setName('Execution Model')
                .setDesc('OpenAI model to use for execution.')
                .addDropdown(dropdown => dropdown
                    .addOption('gpt-4o-mini', 'GPT-4o Mini')
                    .addOption('gpt-4o', 'GPT-4o')
                    .setValue(this.plugin.settings.executorModel || 'gpt-4o-mini')
                    .onChange(async (value) => {
                        this.plugin.settings.executorModel = value;
                        await this.plugin.saveSettings();
                    }));
        } else {
            new obsidian.Setting(containerEl)
                .setName('Execution Model')
                .setDesc('Enter Ollama model name for execution.')
                .addText(text => text
                    .setPlaceholder('qwen2.5:7b')
                    .setValue(this.plugin.settings.executorModel || 'qwen2.5:7b')
                    .onChange(async (value) => {
                        this.plugin.settings.executorModel = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // =====================================================================
        // 1C. 🦙 OLLAMA CONNECTION SETTINGS
        // =====================================================================
        if (this.plugin.settings.templateProvider === 'ollama' || this.plugin.settings.executorProvider === 'ollama') {
            containerEl.createEl('h3', { text: '🦙 Ollama Connection Settings' });

            const ollamaSetting = new obsidian.Setting(containerEl)
                .setName('Ollama Server URL')
                .setDesc('Local or VPN URL for Ollama API (e.g., http://localhost:11434 or http://10.x.x.x:11434).')
                .addText(text => text
                    .setPlaceholder('http://localhost:11434')
                    .setValue(this.plugin.settings.ollamaUrl || 'http://localhost:11434')
                    .onChange(async (value) => {
                        this.plugin.settings.ollamaUrl = value.trim();
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
        }

        // =====================================================================
        // 2. 🔌 SOURCES (Middle)
        // =====================================================================
        containerEl.createEl('hr');
        
        const connectionsHeader = containerEl.createDiv({ style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;' });
        connectionsHeader.createEl('h3', { text: '🔌 Sources', style: 'margin:0;' });
        
        const headerButtons = connectionsHeader.createDiv({ style: 'display:flex; gap:10px;' });
        
        const addApiBtn = headerButtons.createEl('button', { text: '+ Add API Connection', cls: 'mod-cta' });
        addApiBtn.onclick = () => {
            new OmniApiWizardModal(this.app, this.plugin, () => this.display()).open();
        };

        const scanBleBtn = headerButtons.createEl('button', { text: '+ Pair BLE Device', cls: 'mod-cta' });
        scanBleBtn.onclick = () => {
            new OmniBleManagerModal(this.app, this.plugin, () => this.display()).open();
        };

        // ── Card C: Git Logger Integration (Collapsible) ─────────────────────
        const gitLoggerDetails = containerEl.createEl('details');
        gitLoggerDetails.style.marginBottom = '15px';
        gitLoggerDetails.style.border = '1px solid var(--background-modifier-border)';
        gitLoggerDetails.style.borderRadius = '6px';
        gitLoggerDetails.style.padding = '8px';
        
        const gitLoggerSummary = gitLoggerDetails.createEl('summary', { text: '🐙 Git Activity Logger' });
        gitLoggerSummary.style.cursor = 'pointer';
        gitLoggerSummary.style.fontSize = '1.2em';
        gitLoggerSummary.style.fontWeight = 'bold';
        gitLoggerSummary.style.color = 'var(--text-accent)';
        
        const gitLoggerDetailsContainer = gitLoggerDetails.createDiv();
        gitLoggerDetailsContainer.style.paddingTop = '10px';
        
        new obsidian.Setting(gitLoggerDetailsContainer)
            .setName('Repository Paths')
            .setDesc('Enter the absolute folder paths of the git repositories you want to track, one path per line.')
            .addTextArea(text => {
                text.setPlaceholder('C:\\path\\to\\repo1\nC:\\path\\to\\repo2')
                    .setValue(this.plugin.settings.gitRepoPaths || '')
                    .onChange(async (value) => {
                        this.plugin.settings.gitRepoPaths = value;
                        await this.plugin.saveSettings();
                    });
                text.inputEl.rows = 6;
                text.inputEl.style.width = '100%';
            });

        new obsidian.Setting(gitLoggerDetailsContainer)
            .setName('Git Author Filter')
            .setDesc('Only track commits by this author (optional, leave empty to track all commits).')
            .addText(text => text
                .setPlaceholder('e.g., John Doe')
                .setValue(this.plugin.settings.gitAuthor || '')
                .onChange(async (value) => {
                    this.plugin.settings.gitAuthor = value.trim();
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(gitLoggerDetailsContainer)
            .setName('Log Section Heading')
            .setDesc('The heading in your daily note under which the Git Activity section will be placed.')
            .addText(text => text
                .setPlaceholder('## 🪵 Log')
                .setValue(this.plugin.settings.gitTargetHeading || '## 🪵 Log')
                .onChange(async (value) => {
                    this.plugin.settings.gitTargetHeading = value.trim();
                    await this.plugin.saveSettings();
                }));

        new obsidian.Setting(gitLoggerDetailsContainer)
            .setName('Sync Style')
            .setDesc('Choose whether to sync git commits manually or automatically in the background.')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('manual', 'Manual (Button/Palette)')
                    .addOption('automatic', 'Automatic (Background Polling)')
                    .setValue(this.plugin.settings.gitSyncStyle || 'manual')
                    .onChange(async (value) => {
                        this.plugin.settings.gitSyncStyle = value;
                        await this.plugin.saveSettings();
                        toggleGitInterval();
                    });
            });

        const gitIntervalSetting = new obsidian.Setting(gitLoggerDetailsContainer)
            .setName('Sync Frequency (minutes)')
            .setDesc('Time interval between background git checks.')
            .addText(text => text
                .setPlaceholder('60')
                .setValue(String(this.plugin.settings.gitSyncInterval || 60))
                .onChange(async (value) => {
                    this.plugin.settings.gitSyncInterval = parseInt(value) || 60;
                    await this.plugin.saveSettings();
                }));

        const toggleGitInterval = () => {
            if (this.plugin.settings.gitSyncStyle === 'automatic') {
                gitIntervalSetting.settingEl.style.display = '';
            } else {
                gitIntervalSetting.settingEl.style.display = 'none';
            }
        };
        toggleGitInterval();

        // ── Card A: Google Health API Connection ─────────────────────────────
        const googleHealthDetails = containerEl.createEl('details');
        googleHealthDetails.style.marginBottom = '15px';
        googleHealthDetails.style.border = '1px solid var(--background-modifier-border)';
        googleHealthDetails.style.borderRadius = '6px';
        googleHealthDetails.style.padding = '8px';
        if (this.plugin.settings.dataSourceApi === 'google-health') {
            googleHealthDetails.setAttribute('open', '');
        }
        
        const googleHealthHeaderDiv = googleHealthDetails.createEl('summary', { style: 'cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:space-between;' });
        const googleHealthTitleSpan = googleHealthHeaderDiv.createSpan({ text: '🔗 Google Health Integration' });
        googleHealthTitleSpan.style.fontSize = '1.2em';
        googleHealthTitleSpan.style.fontWeight = 'bold';
        googleHealthTitleSpan.style.color = 'var(--text-accent)';
        const googleHealthStatusBadge = createStatusBadge(googleHealthHeaderDiv);
        
        // Auto-check connection status on load
        const checkGoogleHealthStatus = async () => {
            try {
                const token = await this.plugin.getGoogleAccessToken();
                if (token) {
                    const res = await requestWithTimeout({
                        url: 'https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=' + token,
                        method: 'GET'
                    });
                    updateBadge(googleHealthStatusBadge, res.status === 200, res.status === 200 ? 'Connected' : 'Expired');
                } else {
                    updateBadge(googleHealthStatusBadge, false, 'Disconnected');
                }
            } catch (e) {
                updateBadge(googleHealthStatusBadge, false, 'Error');
            }
        };
        checkGoogleHealthStatus();

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

            new obsidian.Setting(googleHealthContainer)
                .setName('Sync Style')
                .setDesc('Choose whether to sync Google Health data manually or automatically in the background.')
                .addDropdown(dropdown => {
                    dropdown
                        .addOption('manual', 'Manual (Button/Palette)')
                        .addOption('automatic', 'Automatic (Background Polling)')
                        .setValue(this.plugin.settings.googleHealthSyncStyle || 'manual')
                        .onChange(async (value) => {
                            this.plugin.settings.googleHealthSyncStyle = value;
                            await this.plugin.saveSettings();
                            toggleHealthInterval();
                        });
                });

            const healthIntervalSetting = new obsidian.Setting(googleHealthContainer)
                .setName('Sync Frequency (minutes)')
                .setDesc('Time interval between background Google Health checks.')
                .addText(text => text
                    .setPlaceholder('60')
                    .setValue(String(this.plugin.settings.googleHealthSyncInterval || 60))
                    .onChange(async (value) => {
                        this.plugin.settings.googleHealthSyncInterval = parseInt(value) || 60;
                        await this.plugin.saveSettings();
                    }));

            const toggleHealthInterval = () => {
                if (this.plugin.settings.googleHealthSyncStyle === 'automatic') {
                    healthIntervalSetting.settingEl.style.display = '';
                } else {
                    healthIntervalSetting.settingEl.style.display = 'none';
                }
            };
            toggleHealthInterval();

            // Local registry management tools
            const registryToolsRow = googleHealthContainer.createDiv({ style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding:10px; border:1px solid var(--text-accent); border-radius:6px; background:rgba(var(--color-accent), 0.05);' });
            registryToolsRow.createSpan({ text: '🥗 Local Food Registry:', style: 'font-weight:bold;' });
            const manageRegBtn = registryToolsRow.createEl('button', { text: 'Manage Food Registry Items', cls: 'omni-btn btn-process' });
            manageRegBtn.onclick = () => {
                new OmniFoodLoggerModal(this.app, this.plugin, 'manage').open();
            };

            // Credentials JSON
            new obsidian.Setting(googleHealthContainer)
                .setName('OAuth Client JSON config')
                .setDesc('Paste the content of your downloaded Google OAuth Client Secrets JSON.')
                .addTextArea(text => {
                    text.setPlaceholder('{"web":{"client_id":"..."}}')
                        .setValue(this.plugin.settings.googleClientJson || '')
                        .onChange(async (value) => {
                            this.plugin.settings.googleClientJson = value;
                            await this.plugin.saveSettings();
                        });
                    text.inputEl.rows = 4;
                    text.inputEl.style.width = '100%';
                });

            const instructionsDetails = googleHealthContainer.createEl('details');
            instructionsDetails.style.marginBottom = '15px';
            const summary = instructionsDetails.createEl('summary', { text: 'How to get Google Cloud Credentials' });
            summary.style.cursor = 'pointer';
            
            const instructionText = instructionsDetails.createDiv();
            instructionText.style.paddingTop = '10px';
            instructionText.innerHTML = `
                <ol>
                    <li>Go to the <a href="https://console.cloud.google.com/">Google Cloud Console</a>.</li>
                    <li>Create a project and enable the <b>Google Health API</b> (NOT Fitness API).</li>
                    <li>Configure the OAuth consent screen with the following scopes:
                        <ul>
                            <li><code>https://www.googleapis.com/auth/googlehealth.sleep.readonly</code></li>
                            <li><code>https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly</code></li>
                            <li><code>https://www.googleapis.com/auth/googlehealth.nutrition.readonly</code></li>
                            <li><code>https://www.googleapis.com/auth/googlehealth.nutrition.writeonly</code></li>
                        </ul>
                    </li>
                    <li>Go to <b>Credentials</b> -> Create Credentials -> <b>OAuth client ID</b>.</li>
                    <li>Select Application type: <b>Web application</b>.</li>
                    <li>Add <code>http://localhost:8092</code> to Authorized redirect URIs.</li>
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
                       this.plugin.startOAuth2Flow('google-health').catch(e => {
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
                               updateBadge(googleHealthStatusBadge, true, 'Connected');
                           } else {
                               throw new Error(`Google API returned status ${res.status}`);
                           }
                           setTimeout(() => btn.setButtonText("Test Connection"), 2000);
                       } catch (e) {
                           new obsidian.Notice("Connection failed: " + e.message);
                           btn.setButtonText("Failed");
                           updateBadge(googleHealthStatusBadge, false, 'Error');
                           setTimeout(() => btn.setButtonText("Test Connection"), 2000);
                       }
                   });
            });



            // Collapsible OAuth Scopes configuration
            const scopesDetails = googleHealthContainer.createEl('details');
            scopesDetails.style.marginTop = '15px';
            scopesDetails.createEl('summary', { text: '🔐 Google Health OAuth Scopes Settings', style: 'cursor:pointer; font-weight:bold;' });
            
            const scopesGrid = scopesDetails.createDiv();
            scopesGrid.style.display = 'grid';
            scopesGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
            scopesGrid.style.gap = '8px';
            scopesGrid.style.marginTop = '10px';
            scopesGrid.style.marginBottom = '15px';

            const defaultScopes = [
                { label: "Sleep (Read)", scope: "https://www.googleapis.com/auth/googlehealth.sleep.readonly" },
                { label: "HRV & Vitals (Read)", scope: "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly" },
                { label: "Nutrition (Read)", scope: "https://www.googleapis.com/auth/googlehealth.nutrition.readonly" },
                { label: "Nutrition (Write)", scope: "https://www.googleapis.com/auth/googlehealth.nutrition.writeonly" }
            ];

            defaultScopes.forEach(item => {
                const label = scopesGrid.createEl('label', { style: 'display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.9em;' });
                const checkbox = label.createEl('input', { type: 'checkbox' });
                checkbox.checked = (this.plugin.settings.requestedScopes || []).includes(item.scope);
                
                checkbox.onChange = async () => {
                    let current = this.plugin.settings.requestedScopes || [];
                    if (checkbox.checked) {
                        if (!current.includes(item.scope)) current.push(item.scope);
                    } else {
                        current = current.filter(s => s !== item.scope);
                    }
                    this.plugin.settings.requestedScopes = current;
                    await this.plugin.saveSettings();
                };
                label.createSpan({ text: item.label });
            });

            // Collapsible Metric Mapping configuration
            const mappingsDetails = googleHealthContainer.createEl('details');
            mappingsDetails.style.marginTop = '15px';
            mappingsDetails.createEl('summary', { text: '📊 Metric Mapping Sync Definitions', style: 'cursor:pointer; font-weight:bold;' });

            const metricsGrid = mappingsDetails.createDiv();
            metricsGrid.style.marginTop = '10px';
            
            const syncConfig = this.plugin.settings.healthSyncConfig || {};
            const keys = Object.keys(syncConfig);
            
            keys.forEach(k => {
                const row = metricsGrid.createDiv({ style: 'display:flex; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap; border-bottom:1px solid var(--background-modifier-border-hover); padding-bottom:6px;' });
                row.createSpan({ text: k.toUpperCase(), style: 'font-weight:bold; width:80px; text-transform:capitalize;' });
                
                const enableLabel = row.createEl('label', { style: 'display:flex; align-items:center; gap:4px; font-size:0.95em;' });
                const enableCheck = enableLabel.createEl('input', { type: 'checkbox' });
                enableCheck.checked = syncConfig[k].enabled;
                enableCheck.onChange = async () => {
                    syncConfig[k].enabled = enableCheck.checked;
                    await this.plugin.saveSettings();
                };
                enableLabel.createSpan({ text: 'Sync' });

                const destSelect = row.createEl('select');
                destSelect.createEl('option', { value: 'frontmatter', text: 'Frontmatter' });
                destSelect.createEl('option', { value: 'inline', text: 'Inline Field' });
                destSelect.createEl('option', { value: 'append', text: 'Append Section' });
                destSelect.value = syncConfig[k].destination;
                destSelect.onChange = async () => {
                    syncConfig[k].destination = destSelect.value;
                    await this.plugin.saveSettings();
                };

                const keyInput = row.createEl('input', { type: 'text', placeholder: 'Target Key (e.g. HRV)', style: 'flex:1; min-width:120px;' });
                keyInput.value = syncConfig[k].key || '';
                keyInput.onChange = async () => {
                    syncConfig[k].key = keyInput.value.trim();
                    await this.plugin.saveSettings();
                };
            });
        }

        // ── Card D: Clipboard / OCR Ingestion (Collapsible) ─────────────────
        const ocrDetails = containerEl.createEl('details');
        ocrDetails.style.marginBottom = '15px';
        ocrDetails.style.border = '1px solid var(--background-modifier-border)';
        ocrDetails.style.borderRadius = '6px';
        ocrDetails.style.padding = '8px';
        if (this.plugin.settings.enableClipboardOcr) {
            ocrDetails.setAttribute('open', '');
        }
        
        const ocrSummary = ocrDetails.createEl('summary', { style: 'cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:space-between;' });
        const ocrTitleSpan = ocrSummary.createSpan({ text: '📋 Clipboard / OCR Ingestion' });
        ocrTitleSpan.style.fontSize = '1.2em';
        ocrTitleSpan.style.fontWeight = 'bold';
        ocrTitleSpan.style.color = 'var(--text-accent)';
        
        const ocrStatusBadge = createStatusBadge(ocrSummary);
        const updateOcrBadge = () => {
            const hasOcr = this.plugin.settings.enableClipboardOcr !== false;
            updateBadge(ocrStatusBadge, hasOcr, hasOcr ? 'Active' : 'Disabled');
        };
        updateOcrBadge();
        
        const ocrDetailsContainer = ocrDetails.createDiv();
        ocrDetailsContainer.style.paddingTop = '10px';
        
        new obsidian.Setting(ocrDetailsContainer)
            .setName('Enable Clipboard Ingestion')
            .setDesc('Enable automatic parsing of screenshots or image data copied to the clipboard for OCR ingestion.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.enableClipboardOcr || false)
                .onChange(async (value) => {
                    this.plugin.settings.enableClipboardOcr = value;
                    await this.plugin.saveSettings();
                    updateOcrBadge();
                }));

        // ── Cards B+: Custom API Connections Dashboard ───────────────────────
        const customApiConns = (this.plugin.settings.apiConnections || []).filter(c => c.id !== 'google-health');
        customApiConns.forEach(c => {
            const apiDetails = containerEl.createEl('details');
            apiDetails.style.marginBottom = '15px';
            apiDetails.style.border = '1px solid var(--background-modifier-border)';
            apiDetails.style.borderRadius = '6px';
            apiDetails.style.padding = '8px';

            const apiHeaderDiv = apiDetails.createEl('summary', { style: 'cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:space-between;' });
            const apiTitleSpan = apiHeaderDiv.createSpan({ text: `🔌 Connection: ${c.name}` });
            apiTitleSpan.style.fontSize = '1.2em';
            apiTitleSpan.style.fontWeight = 'bold';
            apiTitleSpan.style.color = 'var(--text-accent)';
            const apiStatusBadge = createStatusBadge(apiHeaderDiv);

            const checkConnectionStatus = async () => {
                try {
                    let hasAccess = false;
                    if (c.authType === 'none') {
                        hasAccess = true;
                    } else if (c.authType === 'oauth2') {
                        const token = await this.plugin.getAccessTokenForConnection(c.id);
                        hasAccess = !!token;
                    } else {
                        const secret = await this.plugin.getSecret(`omni-logger-api-${c.id}`, 'customApi');
                        hasAccess = !!secret;
                    }
                    updateBadge(apiStatusBadge, hasAccess, hasAccess ? 'Active' : 'Unconfigured');
                } catch(err) {
                    updateBadge(apiStatusBadge, false, 'Error');
                }
            };
            checkConnectionStatus();

            const apiDetailsContainer = apiDetails.createDiv();
            apiDetailsContainer.style.paddingTop = '10px';

            const infoRow = apiDetailsContainer.createDiv({ style: 'font-size:0.9em; color:var(--text-muted); margin-bottom:10px;' });
            infoRow.innerHTML = `<b>Endpoint:</b> <code>${c.url}</code> [${c.method}]<br><b>Auth:</b> ${c.authType}`;

            const controlsRow = apiDetailsContainer.createDiv({ style: 'display:flex; gap:10px;' });

            if (c.authType === 'oauth2') {
                const connectBtn = controlsRow.createEl('button', { text: 'Connect Account', cls: 'mod-cta' });
                connectBtn.onclick = () => {
                    this.plugin.startOAuth2Flow(c.id).catch(e => {
                        new obsidian.Notice("Failed to start OAuth2: " + e.message);
                    });
                };
            }

            const testBtn = controlsRow.createEl('button', { text: 'Test Connection' });
            testBtn.onclick = async () => {
                testBtn.textContent = "Testing...";
                try {
                    const responseText = await this.plugin.fetchFromApiConnection(c.id);
                    new obsidian.Notice(`Connection success! Payload length: ${responseText.length}`);
                    updateBadge(apiStatusBadge, true, 'Connected');
                } catch(e) {
                    new obsidian.Notice(`Connection failed: ${e.message}`);
                    updateBadge(apiStatusBadge, false, 'Error');
                } finally {
                    testBtn.textContent = "Test Connection";
                }
            };

            const addTempBtn = controlsRow.createEl('button', { text: '+ Create Template' });
            addTempBtn.onclick = () => {
                new OmniTemplateCreatorModal(this.app, this.plugin, async () => {
                    await this.plugin.loadCustomTemplatesFromVault();
                    this.display();
                }, `api-${c.id}`).open();
            };

            const deleteConnBtn = controlsRow.createEl('button', { text: 'Delete' });
            deleteConnBtn.style.backgroundColor = 'var(--text-error)';
            deleteConnBtn.style.color = 'var(--text-on-accent)';
            deleteConnBtn.onclick = async () => {
                if (confirm(`Are you sure you want to delete Connection "${c.name}"?`)) {
                    this.plugin.settings.apiConnections = this.plugin.settings.apiConnections.filter(conn => conn.id !== c.id);
                    await this.plugin.saveSettings();
                    
                    await this.plugin.setSecret(`omni-logger-api-${c.id}`, 'customApi', '');
                    await this.plugin.setSecret(`omni-logger-api-client-${c.id}`, 'customApi', '');
                    
                    new obsidian.Notice(`Connection "${c.name}" deleted.`);
                    this.display();
                }
            };
        });
 


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

            const saveTemplateOnTheFly = async (t, destVal, styleVal, intervalVal, deviceVal, configVal) => {
                t.destination = destVal;
                if (styleVal !== undefined) t.syncStyle = styleVal;
                if (intervalVal !== undefined) t.syncInterval = intervalVal;
                if (deviceVal !== undefined) t.deviceName = deviceVal;
                
                if (t.mode === 'ble') {
                    try {
                        const parsedConfig = JSON.parse(configVal);
                        Object.assign(t, parsedConfig);
                    } catch(e) {}
                } else {
                    t.prompt = configVal;
                }

                const isBuiltIn = ['google-sleep', 'google-hrv', 'google-hydration', 'google-nutrition'].includes(t.id);
                if (isBuiltIn) {
                    if (t.id === 'calls') this.plugin.settings.omniCallsInstructions = t.prompt;
                    else if (t.id === 'lumosity') this.plugin.settings.omniLumosityInstructions = t.prompt;
                    else if (t.id === 'health') this.plugin.settings.omniHealthInstructions = t.prompt;
                    else if (t.id === 'google-sleep') {
                        this.plugin.settings.googleHealthSleepPrompt = t.prompt;
                        if (!this.plugin.settings.healthSyncConfig) this.plugin.settings.healthSyncConfig = {};
                        if (!this.plugin.settings.healthSyncConfig.sleep) this.plugin.settings.healthSyncConfig.sleep = {};
                        this.plugin.settings.healthSyncConfig.sleep.destination = destVal;
                    }
                    else if (t.id === 'google-hrv') {
                        this.plugin.settings.googleHealthVitalsPrompt = t.prompt;
                        if (!this.plugin.settings.healthSyncConfig) this.plugin.settings.healthSyncConfig = {};
                        if (!this.plugin.settings.healthSyncConfig.hrv) this.plugin.settings.healthSyncConfig.hrv = {};
                        this.plugin.settings.healthSyncConfig.hrv.destination = destVal;
                    }
                    else if (t.id === 'google-hydration') {
                        this.plugin.settings.googleHealthHydrationPrompt = t.prompt;
                        if (!this.plugin.settings.healthSyncConfig) this.plugin.settings.healthSyncConfig = {};
                        if (!this.plugin.settings.healthSyncConfig.hydration) this.plugin.settings.healthSyncConfig.hydration = {};
                        this.plugin.settings.healthSyncConfig.hydration.destination = destVal;
                    }
                    else if (t.id === 'google-nutrition') {
                        this.plugin.settings.googleHealthNutritionPrompt = t.prompt;
                        if (!this.plugin.settings.healthSyncConfig) this.plugin.settings.healthSyncConfig = {};
                        if (!this.plugin.settings.healthSyncConfig.calories) this.plugin.settings.healthSyncConfig.calories = {};
                        this.plugin.settings.healthSyncConfig.calories.destination = destVal;
                    }
                    await this.plugin.saveSettings();
                    return;
                }

                // Save to settings
                await this.plugin.saveSettings();

                // Save to vault file
                const cleanDirName = t.name.replace(/[^a-zA-Z0-9 _-]/g, '');
                const metadataPath = `${this.app.vault.adapter.getBasePath()}/${this.plugin.settings.ingredientsFolder}/${cleanDirName}/metadata.json`;
                const fs = require('fs');
                
                try {
                    let m = {};
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
                    const dirPath = `${this.app.vault.adapter.getBasePath()}/${this.plugin.settings.ingredientsFolder}/${cleanDirName}`;
                    if (!fs.existsSync(dirPath)) {
                        fs.mkdirSync(dirPath, { recursive: true });
                    }
                    fs.writeFileSync(metadataPath, JSON.stringify(m, null, 2), 'utf8');
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
                    const titleSpan = header.createSpan({ text: `${t.name} (${(t.mode||'').toUpperCase()})` });
                    if (isBuiltIn) {
                        header.createSpan({ 
                            text: 'Built-in', 
                            style: 'font-size:0.75em; background-color:var(--background-modifier-border); color:var(--text-muted); padding:2px 6px; border-radius:4px; margin-left:8px; font-weight:normal;' 
                        });
                    }
                    
                    const controls = header.createDiv();
                    
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
                    
                    let configArea;
                    let styleSelect, intervalInput, intervalRow, warningEl;
                    
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
                        // ──────────────────────────────────────────────────

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
                        intervalInput.value = t.syncInterval || 15;
                        
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
                        
                        styleSelect.onchange = async () => {
                            toggleInterval();
                            updateConfigArea();
                            await saveTemplateOnTheFly(t, destSelect.value, styleSelect.value, parseInt(intervalInput.value) || 15, templateDeviceSelect.value, configArea.value);
                        };
                        intervalInput.onchange = async () => {
                            updateConfigArea();
                            await saveTemplateOnTheFly(t, destSelect.value, styleSelect.value, parseInt(intervalInput.value) || 15, templateDeviceSelect.value, configArea.value);
                        };
                        destSelect.onchange = async () => {
                            updateConfigArea();
                            await saveTemplateOnTheFly(t, destSelect.value, styleSelect.value, parseInt(intervalInput.value) || 15, templateDeviceSelect.value, configArea.value);
                        };
                        configArea.onchange = async () => {
                            await saveTemplateOnTheFly(t, destSelect.value, styleSelect.value, parseInt(intervalInput.value) || 15, templateDeviceSelect.value, configArea.value);
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
                            intervalInput.value = t.syncInterval || 60;

                            const toggleInterval = () => {
                                if (styleSelect.value === 'automatic') {
                                    intervalRow.style.display = 'flex';
                                } else {
                                    intervalRow.style.display = 'none';
                                }
                            };

                            styleSelect.onchange = async () => {
                                t.syncStyle = styleSelect.value;
                                toggleInterval();
                                await saveTemplateOnTheFly(t, destSelect.value, styleSelect.value, parseInt(intervalInput.value) || 60, undefined, promptArea.value);
                            };
                            intervalInput.onchange = async () => {
                                t.syncInterval = parseInt(intervalInput.value) || 60;
                                await saveTemplateOnTheFly(t, destSelect.value, styleSelect.value, parseInt(intervalInput.value) || 60, undefined, promptArea.value);
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
                        const metadataPath = `${this.app.vault.adapter.getBasePath()}/${this.plugin.settings.ingredientsFolder}/${cleanDirName}/metadata.json`;
                        const fs = require('fs');
                        
                        if (t.mode === 'ble') {
                            try {
                                const parsedConfig = JSON.parse(configArea.value);
                                Object.assign(t, parsedConfig);
                                t.destination = destSelect.value;
                                t.syncStyle = styleSelect.value;
                                t.syncInterval = parseInt(intervalInput.value) || 15;
                                if (templateDeviceSelect.value) t.deviceName = templateDeviceSelect.value;
                                
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
                            t.prompt = t._promptArea ? t._promptArea.value : '';
                            if (styleSelect) {
                                t.syncStyle = styleSelect.value;
                                t.syncInterval = parseInt(intervalInput.value) || 60;
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
                                        mode: t.mode,
                                        connectionId: t.connectionId,
                                        syncStyle: t.syncStyle,
                                        syncInterval: t.syncInterval
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
            const cards = this.plugin.settings.dashboardCards || [];

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
                        await this.plugin.saveSettings();
                    };

                    const keyInput = cardRow.createEl('input', { type: 'text', value: card.key });
                    keyInput.style.flex = '2';
                    keyInput.style.minWidth = '100px';
                    keyInput.setAttribute('placeholder', 'Frontmatter Key');
                    keyInput.onchange = async () => {
                        card.key = keyInput.value;
                        await this.plugin.saveSettings();
                    };

                    const unitInput = cardRow.createEl('input', { type: 'text', value: card.unit || '' });
                    unitInput.style.flex = '1';
                    unitInput.style.width = '60px';
                    unitInput.setAttribute('placeholder', 'Unit');
                    unitInput.onchange = async () => {
                        card.unit = unitInput.value;
                        await this.plugin.saveSettings();
                    };

                    const aggSelect = cardRow.createEl('select');
                    [['average', 'Average'], ['sum', 'Sum'], ['diff', 'Diff']].forEach(([v, l]) => {
                        const opt = aggSelect.createEl('option', { value: v, text: l });
                        if (card.agg === v) opt.selected = true;
                    });
                    aggSelect.onchange = async () => {
                        card.agg = aggSelect.value;
                        await this.plugin.saveSettings();
                    };

                    const chartSelect = cardRow.createEl('select');
                    [['line', 'Line Chart'], ['bar', 'Bar Chart'], ['none', 'No Chart']].forEach(([v, l]) => {
                        const opt = chartSelect.createEl('option', { value: v, text: l });
                        if (card.chartType === v) opt.selected = true;
                    });
                    chartSelect.onchange = async () => {
                        card.chartType = chartSelect.value;
                        await this.plugin.saveSettings();
                    };

                    const colorInput = cardRow.createEl('input', { type: 'color', value: card.color || '#6366f1' });
                    colorInput.style.width = '40px';
                    colorInput.onchange = async () => {
                        card.color = colorInput.value;
                        await this.plugin.saveSettings();
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
                        await this.plugin.saveSettings();
                        renderDashboardCardsList();
                    };

                    const downBtn = btnContainer.createEl('button', { text: '▼' });
                    downBtn.disabled = index === cards.length - 1;
                    downBtn.onclick = async () => {
                        const temp = cards[index + 1];
                        cards[index + 1] = card;
                        cards[index] = temp;
                        await this.plugin.saveSettings();
                        renderDashboardCardsList();
                    };

                    const delBtn = btnContainer.createEl('button', { text: '🗑' });
                    delBtn.style.color = 'var(--text-error)';
                    delBtn.onclick = async () => {
                        cards.splice(index, 1);
                        await this.plugin.saveSettings();
                        renderDashboardCardsList();
                    };
                });
            }

            const addRow = cardsContainer.createDiv();
            addRow.style.display = 'flex';
            addRow.style.gap = '8px';
            addRow.style.marginTop = '15px';
            addRow.style.paddingTop = '15px';
            addRow.style.borderTop = '2px dashed var(--background-modifier-border)';
            addRow.style.alignItems = 'center';

            const addLabel = addRow.createEl('input', { type: 'text', placeholder: 'Label (e.g. Sleep Score)' });
            addLabel.style.flex = '2';
            const addKey = addRow.createEl('input', { type: 'text', placeholder: 'Key (e.g. sleep_score)' });
            addKey.style.flex = '2';
            const addUnit = addRow.createEl('input', { type: 'text', placeholder: 'Unit (e.g. hrs)' });
            addUnit.style.flex = '1';

            const addAgg = addRow.createEl('select');
            [['average', 'Average'], ['sum', 'Sum'], ['diff', 'Diff']].forEach(([v, l]) => addAgg.createEl('option', { value: v, text: l }));

            const addChart = addRow.createEl('select');
            [['line', 'Line Chart'], ['bar', 'Bar Chart'], ['none', 'No Chart']].forEach(([v, l]) => addChart.createEl('option', { value: v, text: l }));

            const addColor = addRow.createEl('input', { type: 'color', value: '#6366f1' });
            addColor.style.width = '40px';

            const addBtn = addRow.createEl('button', { text: '＋ Add Card', cls: 'mod-cta' });
            addBtn.onclick = async () => {
                if (!addLabel.value.trim() || !addKey.value.trim()) {
                    new obsidian.Notice('Please provide both a label and a frontmatter key!');
                    return;
                }
                cards.push({
                    key: addKey.value.trim(),
                    label: addLabel.value.trim(),
                    unit: addUnit.value.trim(),
                    agg: addAgg.value,
                    chartType: addChart.value,
                    color: addColor.value
                });
                await this.plugin.saveSettings();
                renderDashboardCardsList();
            };
        };

        renderDashboardCardsList();

    }
}
class OmniLoggerModal extends obsidian.Modal {
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

class OmniBleManagerModal extends obsidian.Modal {
    constructor(app, plugin, onDisplayTab) {
        super(app);
        this.plugin = plugin;
        this.onDisplayTab = onDisplayTab;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '🦷 Bluetooth BLE Device Manager', style: 'margin-bottom:15px; color:var(--text-accent); font-weight:bold;' });
        
        const mainContainer = contentEl.createDiv();

        // Status badge row
        const statusRow = mainContainer.createDiv({ style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;' });
        statusRow.createSpan({ text: 'BLE Sync Status:', style: 'font-weight:bold;' });
        
        const createStatusBadge = (parentEl) => {
            const badge = parentEl.createEl('span');
            badge.style.display = 'inline-block';
            badge.style.width = '10px';
            badge.style.height = '10px';
            badge.style.borderRadius = '50%';
            badge.style.marginLeft = '8px';
            return badge;
        };
        const updateBadge = (badge, ok, tooltip) => {
            badge.style.backgroundColor = ok ? '#30d158' : '#ff453a';
            badge.setAttribute('title', tooltip);
        };

        const bleStatusBadge = createStatusBadge(statusRow);
        const refreshBLEBadge = () => {
            const hasBLE = this.plugin.localSettings?.enableBLESync !== false;
            updateBadge(bleStatusBadge, hasBLE, hasBLE ? 'Ready' : 'Disabled');
        };
        refreshBLEBadge();

        new obsidian.Setting(mainContainer)
            .setName('Enable Background BLE Sync on this Machine')
            .setDesc('Toggle whether background Bluetooth sync tasks run on this specific computer. (Saved locally in local-settings.json).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.localSettings?.enableBLESync !== false)
                .onChange(async (value) => {
                    this.plugin.localSettings.enableBLESync = value;
                    await this.plugin.saveLocalSettings();
                    refreshBLEBadge();
                    if (this.onDisplayTab) this.onDisplayTab();
                }));

        mainContainer.createEl('h4', { text: 'Paired Bluetooth Devices', style: 'margin-top:16px; margin-bottom:4px;' });
        mainContainer.createEl('p', {
            text: 'Device credentials (MAC address, handshake key) are stored locally in bluetooth_devices/ and are never synced or committed to git.',
            cls: 'setting-item-description',
            style: 'margin-bottom:10px;'
        });

        const bleDeviceRow = mainContainer.createDiv({ style: 'display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;' });

        const bleDeviceSelect = bleDeviceRow.createEl('select', { style: 'flex:1; min-width:160px;' });
        const refreshDeviceDropdown = () => {
            bleDeviceSelect.empty();
            const devices = this.plugin.listPairedDevices();
            if (devices.length === 0) {
                bleDeviceSelect.createEl('option', { value: '', text: '— No paired devices —' });
            } else {
                bleDeviceSelect.createEl('option', { value: '', text: '— Select a device —' });
                devices.forEach(d => bleDeviceSelect.createEl('option', { value: d.name, text: `${d.name}  (${d.address})` }));
            }
        };
        refreshDeviceDropdown();

        const removeDeviceBtn = bleDeviceRow.createEl('button', { text: 'Remove Device', cls: 'mod-warning' });
        removeDeviceBtn.onclick = () => {
            const sel = bleDeviceSelect.value;
            if (!sel) { new obsidian.Notice('Select a device to remove.'); return; }
            this.plugin.removePairedDevice(sel);
            refreshDeviceDropdown();
            new obsidian.Notice(`Removed device "${sel}".`);
            if (this.onDisplayTab) this.onDisplayTab();
        };

        new obsidian.Setting(mainContainer)
            .setName('Scan & Pair New Device')
            .setDesc('Scan for nearby BLE devices and save one to the local registry.')
            .addButton(btn => btn
                .setButtonText('Scan Now')
                .onClick(async () => {
                    btn.setButtonText('Scanning...');
                    btn.disabled = true;

                    const child_process = require('child_process');
                    const path = require('path');
                    const fs = require('fs');
                    const vaultPath = this.plugin.app.vault.adapter.getBasePath();
                    const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'omni-logger');
                    const venvPython = require('os').platform() === 'win32'
                        ? path.join(pluginDir, '.venv', 'Scripts', 'python.exe')
                        : path.join(pluginDir, '.venv', 'bin', 'python');
                    const pythonCmd = fs.existsSync(venvPython) ? `"${venvPython}"` : 'python';
                    const scriptPath = path.join(pluginDir, 'ble_scan.py');

                    child_process.exec(`${pythonCmd} "${scriptPath}"`, (err, stdout, stderr) => {
                        btn.setButtonText('Scan Now');
                        btn.disabled = false;
                        if (err) { new obsidian.Notice('Scan failed: ' + (stderr || err.message)); return; }
                        let foundDevices;
                        try { foundDevices = JSON.parse(stdout.trim()); } catch (e) { new obsidian.Notice('Failed to parse scan output.'); return; }
                        if (foundDevices.error) { new obsidian.Notice('Scan failed: ' + foundDevices.error); return; }
                        if (!foundDevices.length) { new obsidian.Notice('No BLE devices found nearby.'); return; }

                        // ── Pair modal ──────────────────────────────────────
                        const modal = new obsidian.Modal(this.plugin.app);
                        modal.titleEl.setText('Pair BLE Device');
                        const { contentEl } = modal;
                        contentEl.style.padding = '16px';

                        contentEl.createEl('p', { text: 'Select the discovered device to pair:', style: 'margin-bottom:8px; font-weight:600;' });
                        const devSelect = contentEl.createEl('select', { style: 'width:100%; margin-bottom:12px;' });
                        foundDevices.forEach(d => devSelect.createEl('option', { value: d.address, text: `${d.name || 'Unknown'}  (${d.address})` }));

                        contentEl.createEl('p', { text: 'Friendly Display Name:', style: 'margin-bottom:6px; font-weight:600;' });
                        const nameInput = contentEl.createEl('input', { type: 'text', style: 'width:100%; margin-bottom:12px;' });
                        nameInput.value = 'Smart Ring';

                        const advToggle = contentEl.createEl('details', { style: 'margin-bottom:12px;' });
                        advToggle.createEl('summary', { text: 'Advanced: secure challenge-response GATT handshake (optional)', style: 'cursor:pointer; font-size:0.9em;' });
                        const advBody = advToggle.createDiv({ style: 'padding:8px 0;' });
                        const loraxCheck = advBody.createEl('input', { type: 'checkbox' });
                        advBody.createSpan({ text: ' Use secure challenge-response handshake', style: 'margin-left:6px;' });
                        advBody.createEl('br');

                        advBody.createEl('label', { text: 'Command UUID:', style: 'font-size:0.85em;' });
                        const cmdUuidInput = advBody.createEl('input', { type: 'text', style: 'width:100%; margin-bottom:6px; font-size:0.85em;' });
                        advBody.createEl('label', { text: 'Response UUID:', style: 'font-size:0.85em;' });
                        const respUuidInput = advBody.createEl('input', { type: 'text', style: 'width:100%; margin-bottom:6px; font-size:0.85em;' });
                        advBody.createEl('label', { text: 'Handshake Key (Base64):', style: 'font-size:0.85em;' });
                        const keyInput = advBody.createEl('input', { type: 'password', style: 'width:100%; font-size:0.85em;' });

                        const pairBtn = contentEl.createEl('button', { text: 'Save to Paired Devices', cls: 'mod-cta', style: 'margin-top:12px; width:100%;' });
                        pairBtn.onclick = () => {
                            const friendlyName = nameInput.value.trim();
                            if (!friendlyName) { new obsidian.Notice('Please enter a friendly name.'); return; }
                            const deviceObj = {
                                name: friendlyName,
                                address: devSelect.value,
                                useLoraxHandshake: loraxCheck.checked,
                                commandUuid: cmdUuidInput.value.trim(),
                                responseUuid: respUuidInput.value.trim(),
                                handshakeKeyBase64: keyInput.value.trim()
                            };
                            this.plugin.savePairedDevice(deviceObj);
                            refreshDeviceDropdown();
                            new obsidian.Notice(`Device "${friendlyName}" paired and saved!`);
                            if (this.onDisplayTab) this.onDisplayTab();
                            modal.close();
                        };
                        modal.open();
                    });
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}

class OmniTemplateCreatorModal extends obsidian.Modal {
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

class OmniFoodLoggerModal extends obsidian.Modal {
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
        
        tabLog.style.cursor = 'pointer';
        tabAdd.style.cursor = 'pointer';
        tabManage.style.cursor = 'pointer';
        
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
                    text: `ID: ${item.id} | Category: ${item.category} | ${item.calories ? item.calories + ' kcal ' : ''}${item.protein_g ? item.protein_g + 'g prot ' : ''}${item.caffeine_mg ? item.caffeine_mg + 'mg caff ' : ''}${item.alcohol_g ? item.alcohol_g + 'g alc ' : ''}`, 
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
                
                if (this.newCategory === "caffeine" && this.newCaffeine > 0) {
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

class OmniApiWizardModal extends obsidian.Modal {
    constructor(app, plugin, onSave) {
        super(app);
        this.plugin = plugin;
        this.onSave = onSave;
        
        // Defaults
        this.connId = "api-" + Date.now();
        this.name = "";
        this.url = "";
        this.method = "GET";
        this.authType = "none";
        this.secretToken = "";
        this.apiKeyHeaderName = "X-API-Key";
        this.customHeaders = "";
        this.authUrl = "https://accounts.google.com/o/oauth2/v2/auth";
        this.tokenUrl = "https://oauth2.googleapis.com/token";
        this.redirectUri = "http://localhost:8092";
        this.scopes = "";
        this.clientId = "";
        this.clientSecret = "";
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: '🔌 Add API Connection Wizard', cls: 'omni-modal-title' });

        const formContainer = contentEl.createDiv();

        new obsidian.Setting(formContainer)
            .setName('Connection Name')
            .setDesc('E.g. "GitHub Events" or "My Custom API"')
            .addText(text => text.onChange(val => this.name = val.trim()));

        new obsidian.Setting(formContainer)
            .setName('API Endpoint URL')
            .setDesc('The endpoint url to request')
            .addText(text => text.onChange(val => this.url = val.trim()));



        new obsidian.Setting(formContainer)
            .setName('Authorization Type')
            .addDropdown(dropdown => dropdown
                .addOption('none', 'None')
                .addOption('bearer', 'Bearer Token')
                .addOption('apikey', 'API Key Header')
                .addOption('cookie', 'Cookie Header')
                .addOption('custom', 'Custom Headers JSON')
                .addOption('oauth2', 'OAuth2 (Google/Arbitrary)')
                .setValue(this.authType)
                .onChange(val => {
                    this.authType = val;
                    renderConditionalFields();
                })
            );

        const conditionalContainer = formContainer.createDiv();

        const renderConditionalFields = () => {
            conditionalContainer.empty();

            if (this.authType === 'bearer' || this.authType === 'cookie') {
                new obsidian.Setting(conditionalContainer)
                    .setName('Secret Token / Cookie Value')
                    .setDesc('Stored securely in your system keychain.')
                    .addText(text => text.setPlaceholder('Enter secret value...').onChange(val => this.secretToken = val.trim()));
            } else if (this.authType === 'apikey') {
                new obsidian.Setting(conditionalContainer)
                    .setName('API Key Value')
                    .setDesc('Stored securely in your system keychain.')
                    .addText(text => text.setPlaceholder('Enter api key...').onChange(val => this.secretToken = val.trim()));

                new obsidian.Setting(conditionalContainer)
                    .setName('Header Name')
                    .setDesc('The key name in the HTTP header (default: X-API-Key).')
                    .addText(text => text.setValue(this.apiKeyHeaderName).onChange(val => this.apiKeyHeaderName = val.trim()));
            } else if (this.authType === 'custom') {
                new obsidian.Setting(conditionalContainer)
                    .setName('Custom Headers JSON')
                    .setDesc('Raw JSON representation of HTTP headers.')
                    .addTextArea(text => text.setPlaceholder('{"X-Custom": "Value"}').onChange(val => this.customHeaders = val.trim()));
            } else if (this.authType === 'oauth2') {
                new obsidian.Setting(conditionalContainer)
                    .setName('Authorization Endpoint URL')
                    .addText(text => text.setValue(this.authUrl).onChange(val => this.authUrl = val.trim()));

                new obsidian.Setting(conditionalContainer)
                    .setName('Token Endpoint URL')
                    .addText(text => text.setValue(this.tokenUrl).onChange(val => this.tokenUrl = val.trim()));

                new obsidian.Setting(conditionalContainer)
                    .setName('Redirect URI')
                    .addText(text => text.setValue(this.redirectUri).onChange(val => this.redirectUri = val.trim()));

                new obsidian.Setting(conditionalContainer)
                    .setName('Scopes')
                    .setDesc('Space-separated list of scopes.')
                    .addTextArea(text => text.setPlaceholder('https://www.googleapis.com/...').onChange(val => this.scopes = val.trim()));

                new obsidian.Setting(conditionalContainer)
                    .setName('Client ID')
                    .addText(text => text.onChange(val => this.clientId = val.trim()));

                new obsidian.Setting(conditionalContainer)
                    .setName('Client Secret')
                    .addText(text => text.onChange(val => this.clientSecret = val.trim()));
            }
        };

        renderConditionalFields();

        // Testing section
        const testSection = contentEl.createDiv();
        testSection.style.marginTop = '20px';
        testSection.style.padding = '10px';
        testSection.style.border = '1px solid var(--background-modifier-border)';
        testSection.style.borderRadius = '4px';

        testSection.createEl('h3', { text: 'Test Connection' });
        const testBtn = testSection.createEl('button', { text: 'Test & Fetch Payload', cls: 'omni-btn' });
        const testResultArea = testSection.createEl('textarea');
        testResultArea.style.width = '100%';
        testResultArea.style.height = '100px';
        testResultArea.style.marginTop = '10px';
        testResultArea.readOnly = true;
        testResultArea.placeholder = 'Test results will appear here...';

        testBtn.onclick = async () => {
            if (!this.url) {
                new obsidian.Notice("Please specify API Endpoint URL first!");
                return;
            }
            testBtn.disabled = true;
            testBtn.setText('Testing...');
            testResultArea.value = 'Sending HTTP request...';
            try {
                // Construct a temporary connection object
                const tempConn = {
                    id: this.connId,
                    name: this.name || "Test",
                    url: this.url,
                    method: this.method,
                    authType: this.authType,
                    apiKeyHeaderName: this.apiKeyHeaderName,
                    customHeaders: this.customHeaders,
                    authUrl: this.authUrl,
                    tokenUrl: this.tokenUrl,
                    redirectUri: this.redirectUri,
                    scopes: this.scopes ? this.scopes.split(/\s+/) : [],
                    clientId: this.clientId,
                    clientSecret: this.clientSecret
                };

                // Add to temporary plugin connections
                if (!this.plugin.settings.apiConnections) this.plugin.settings.apiConnections = [];
                this.plugin.settings.apiConnections.push(tempConn);

                // Store secrets temporarily in memory / keychain
                if (this.secretToken) {
                    await this.plugin.storeSecret(`omni-logger-api-${tempConn.id}`, this.secretToken);
                }
                if (this.clientId && this.clientSecret) {
                    const clientData = JSON.stringify({ client_id: this.clientId, client_secret: this.clientSecret });
                    await this.plugin.storeSecret(`omni-logger-api-client-${tempConn.id}`, clientData);
                }

                let responseText = "";
                if (this.authType === 'oauth2') {
                    const token = await this.plugin.getAccessTokenForConnection(tempConn.id);
                    if (!token) {
                        responseText = `Error: OAuth2 token not found. You must save the connection and click "Connect Account" in the settings dashboard first!`;
                    } else {
                        responseText = await this.plugin.fetchFromApiConnection(tempConn.id);
                    }
                } else {
                    responseText = await this.plugin.fetchFromApiConnection(tempConn.id);
                }

                testResultArea.value = `Status: Success!\nResponse:\n${responseText}`;
                
                // Cleanup temp connection
                this.plugin.settings.apiConnections = this.plugin.settings.apiConnections.filter(c => c.id !== tempConn.id);
            } catch(e) {
                testResultArea.value = `Status: Failed!\nError: ${e.message}`;
                this.plugin.settings.apiConnections = this.plugin.settings.apiConnections.filter(c => c.id !== this.connId);
            } finally {
                testBtn.disabled = false;
                testBtn.setText('Test & Fetch Payload');
            }
        };

        // Footer Actions
        const footer = contentEl.createDiv();
        footer.style.marginTop = '20px';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '10px';

        const cancel = footer.createEl('button', { text: 'Cancel', cls: 'omni-btn btn-cancel' });
        cancel.onclick = () => this.close();

        const save = footer.createEl('button', { text: 'Save Connection', cls: 'omni-btn btn-process' });
        save.onclick = async () => {
            if (!this.name || !this.url) {
                new obsidian.Notice("Please enter Connection Name and Endpoint URL!");
                return;
            }
            
            const newConn = {
                id: this.connId,
                name: this.name,
                url: this.url,
                method: this.method,
                authType: this.authType,
                apiKeyHeaderName: this.apiKeyHeaderName,
                customHeaders: this.customHeaders,
                authUrl: this.authUrl,
                tokenUrl: this.tokenUrl,
                redirectUri: this.redirectUri,
                scopes: this.scopes ? this.scopes.split(/\s+/) : [],
                clientId: this.clientId,
                clientSecret: ''
            };

            // Store secrets in keychain securely
            if (this.secretToken) {
                await this.plugin.storeSecret(`omni-logger-api-${newConn.id}`, this.secretToken);
            }
            if (this.clientId && this.clientSecret) {
                const clientData = JSON.stringify({ client_id: this.clientId, client_secret: this.clientSecret });
                await this.plugin.storeSecret(`omni-logger-api-client-${newConn.id}`, clientData);
            }

            if (!this.plugin.settings.apiConnections) {
                this.plugin.settings.apiConnections = [];
            }
            this.plugin.settings.apiConnections.push(newConn);
            await this.plugin.saveSettings();
            
            new obsidian.Notice(`Connection "${this.name}" saved!`);
            this.onSave();
            this.close();
        };
    }

    onClose() {
        this.contentEl.empty();
    }
}

module.exports = OmniLoggerPlugin;

