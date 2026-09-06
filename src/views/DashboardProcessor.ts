import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../main";

declare const Chart: any;

export async function registerDashboardCodeBlock(plugin: OmniLoggerPlugin): Promise<void> {
    plugin.registerMarkdownCodeBlockProcessor("omni-dashboard-test", async (source, el, ctx) => {
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
        
        let configDays = plugin.settings.dashboardDateRange || 14;
        let configExcludeWeekends = plugin.settings.dashboardExcludeWeekends !== false;
        let configStart: string | null = null;
        let configEnd: string | null = null;
        
        const yamlOverrides: Record<string, boolean> = {};
        
        if (source) {
            const YAML = require('yaml');
            try {
                const parsedConfig = YAML.parse(source);
                if (parsedConfig) {
                    if (parsedConfig.days !== undefined) configDays = parseInt(parsedConfig.days, 10);
                    if (parsedConfig['exclude-weekends'] !== undefined) configExcludeWeekends = !!parsedConfig['exclude-weekends'];
                    if (parsedConfig.start !== undefined) configStart = String(parsedConfig.start).trim();
                    if (parsedConfig.end !== undefined) configEnd = String(parsedConfig.end).trim();
                    
                    for (let key in parsedConfig) {
                        if (key.startsWith('exclude-weekends-')) {
                            const target = key.replace('exclude-weekends-', '').trim();
                            yamlOverrides[target] = !!parsedConfig[key];
                        }
                    }
                    if (parsedConfig.metrics && typeof parsedConfig.metrics === 'object') {
                        for (let mKey in parsedConfig.metrics) {
                            const mCfg = parsedConfig.metrics[mKey];
                            if (mCfg && mCfg['exclude-weekends'] !== undefined) {
                                yamlOverrides[mKey] = !!mCfg['exclude-weekends'];
                            }
                        }
                    }
                    if (parsedConfig.groups && typeof parsedConfig.groups === 'object') {
                        for (let gKey in parsedConfig.groups) {
                            const gCfg = parsedConfig.groups[gKey];
                            if (gCfg && gCfg['exclude-weekends'] !== undefined) {
                                yamlOverrides[gKey] = !!gCfg['exclude-weekends'];
                            }
                        }
                    }
                }
            } catch(e) {}
        }

        // Load local custom parser if it exists
        let localParser: any = null;
        try {
            const fs = require('fs');
            const path = require('path');
            const basePath = (plugin.app.vault.adapter as any).getBasePath ? (plugin.app.vault.adapter as any).getBasePath() : '';
            const localParserPath = path.join(basePath, '.obsidian', 'plugins', 'omni-logger', 'local-parser.js');
            if (fs.existsSync(localParserPath)) {
                const localContent = fs.readFileSync(localParserPath, 'utf8');
                const moduleObj = { exports: {} };
                const fn = new Function('module', 'exports', 'require', localContent);
                fn(moduleObj, moduleObj.exports, require);
                localParser = moduleObj.exports;
            }
        } catch (e) {
            console.error("Failed to load local parser:", e);
        }

        const dailyFiles = plugin.app.vault.getMarkdownFiles().filter(file => {
            const norm = file.path.replace(/\\/g, '/');
            return norm.includes('02_Journal/01_Daily') && file.name.match(/^\d{4}-\d{2}-\d{2}\.md$/);
        }).sort((a, b) => a.name.localeCompare(b.name));

        const dataset: any[] = [];
        const parserState = { prevOdom: null };
        for (let file of dailyFiles) {
            const dateStr = file.basename;
            const content = await plugin.app.vault.read(file);
            const cache = plugin.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter || {};
            
            const inlineData: Record<string, string> = {};
            const inlineRegex = /^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?)?([a-zA-Z0-9_\-]+)(?:::|:)\s*(.+)$/gm;
            let match;
            while ((match = inlineRegex.exec(content)) !== null) {
                inlineData[match[1].trim()] = match[2].trim();
            }

            const getVal = (key: string) => {
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

            const parsedRow: any = { date: dateStr };
            const settingsCards = (localParser && Array.isArray(localParser.extraCards)) ? localParser.extraCards : [];
            settingsCards.forEach((card: any) => {
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

            // Run local parser if loaded
            if (localParser && typeof localParser.parseMetrics === 'function') {
                try {
                    localParser.parseMetrics(frontmatter, inlineData, parsedRow, parserState, getVal, content);
                } catch (e) {
                    console.error("Local metrics parser error on file " + file.name + ":", e);
                }
            }
            
            dataset.push(parsedRow);
        }

        if (dataset.length === 0) {
            wrapper.createDiv({ text: 'No daily notes data found.' });
            return;
        }

        dataset.sort((a, b) => a.date.localeCompare(b.date));

        let rangeData: any[] = [];
        if (configStart || configEnd) {
            rangeData = dataset.filter(d => {
                if (configStart && d.date < configStart) return false;
                if (configEnd && d.date > configEnd) return false;
                return true;
            });
        } else {
            rangeData = dataset.slice(-configDays);
        }

        if (rangeData.length === 0) {
            wrapper.createDiv({ text: 'No daily notes data found in the specified range.' });
            return;
        }

        const latest = rangeData[rangeData.length - 1];
        const baselineDays = rangeData.slice(0, -1);
        
        const filteredBaseline = configExcludeWeekends
            ? baselineDays.filter(d => {
                const day = (window as any).moment(d.date).day();
                return day !== 0 && day !== 6;
            })
            : baselineDays;

        const dbContainer = wrapper.createDiv({ cls: 'omni-db-container' });
        const header = dbContainer.createDiv({ cls: 'omni-db-header' });
        header.createEl('h2', { text: 'Readiness & Productivity Dashboard', cls: 'omni-db-title' });

        const dateRangeLabel = (configStart || configEnd)
            ? `Range: ${configStart || 'Start'} to ${configEnd || 'End'}`
            : `Range: ${configDays} days`;
        header.createEl('p', { 
            text: `Latest Update: ${latest.date} | Historical baseline computed over prior ${filteredBaseline.length} days (${dateRangeLabel})`, 
            cls: 'omni-db-subtitle' 
        });

        const grid = dbContainer.createDiv({ cls: 'omni-db-grid' });
        
        // Build the full cards list dynamically from local-parser.js
        const cards: any[] = (localParser && Array.isArray(localParser.extraCards)) ? [...localParser.extraCards] : [];

        const getExcludeWeekendsForMetric = (metricKey: string, groupName: string) => {
            if (yamlOverrides[metricKey] !== undefined) return yamlOverrides[metricKey];
            if (groupName && yamlOverrides[groupName] !== undefined) return yamlOverrides[groupName];
            const card = cards.find(c => c.key === metricKey);
            if (card && card.excludeWeekends !== undefined) return card.excludeWeekends;
            return configExcludeWeekends;
        };

        cards.forEach(card => {
            if (card.showTile === false) return;
            const cardEl = grid.createDiv({ cls: 'omni-db-card' });
            
            let excludeWeekends = getExcludeWeekendsForMetric(card.key, card.chartGroup);
            
            const headerRow = cardEl.createDiv();
            headerRow.style.display = 'flex';
            headerRow.style.justifyContent = 'space-between';
            headerRow.style.alignItems = 'center';
            headerRow.style.marginBottom = '8px';

            const titleEl = headerRow.createEl('h4', { text: card.label, cls: 'omni-db-card-title' });
            titleEl.style.margin = '0';

            const badgeEl = document.createElement('span');
            badgeEl.style.cursor = 'pointer';
            badgeEl.style.fontSize = '0.75em';
            badgeEl.style.padding = '2px 8px';
            badgeEl.style.borderRadius = '12px';
            badgeEl.style.fontWeight = '500';
            badgeEl.style.transition = 'all 0.2s';
            badgeEl.style.display = 'inline-block';
            badgeEl.style.border = '1px solid var(--background-modifier-border)';

            const setBadgeStyle = () => {
                if (excludeWeekends) {
                    badgeEl.textContent = 'Excl Wknd';
                    badgeEl.style.background = 'linear-gradient(90deg, #818cf8, #ec4899)';
                    badgeEl.style.color = '#ffffff';
                    badgeEl.style.border = 'none';
                } else {
                    badgeEl.textContent = 'Incl Wknd';
                    badgeEl.style.background = 'var(--background-secondary-alt)';
                    badgeEl.style.color = 'var(--text-muted)';
                    badgeEl.style.border = '1px solid var(--background-modifier-border)';
                }
            };

            badgeEl.onclick = async (e) => {
                e.stopPropagation();
                excludeWeekends = !excludeWeekends;
                setBadgeStyle();
                updateCardBaseline();
                
                const localCards = (localParser && Array.isArray(localParser.extraCards)) ? localParser.extraCards : [];
                const targetCard = localCards.find((c: any) => c.key === card.key);
                if (targetCard) {
                    targetCard.excludeWeekends = excludeWeekends;
                    await (plugin as any).saveLocalParserCards(localCards);
                }
            };

            setBadgeStyle();
            headerRow.appendChild(badgeEl);
            
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

            const trendEl = cardEl.createDiv();
            
            const updateCardBaseline = () => {
                const metricBaseline = excludeWeekends
                    ? baselineDays.filter(d => {
                        const day = (window as any).moment(d.date).day();
                        return day !== 0 && day !== 6;
                    })
                    : baselineDays;

                let sum = 0, count = 0;
                metricBaseline.forEach(d => {
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
                trendEl.textContent = trendText;
                trendEl.className = `omni-db-card-trend ${trendClass}`;
            };

            updateCardBaseline();
        });

        const chartsGrid = dbContainer.createDiv({ cls: 'omni-db-charts-grid' });
        const chartCards = cards.filter(c => c.chartType && c.chartType !== 'none');
        
        const groups: Record<string, any[]> = {};
        chartCards.forEach(card => {
            const groupName = (card.chartGroup || '').trim();
            if (groupName) {
                if (!groups[groupName]) groups[groupName] = [];
                groups[groupName].push(card);
            } else {
                groups[`_standalone_${card.key}`] = [card];
            }
        });

        const canvases: any[] = [];
        let chartIdx = 0;
        for (let gName in groups) {
            const groupCards = groups[gName];
            const isStandalone = gName.startsWith('_standalone_');
            const displayTitle = isStandalone ? groupCards[0].label : gName;
            
            const chartBox = chartsGrid.createDiv({ cls: 'omni-db-chart-container' });
            
            const chartHeader = chartBox.createDiv();
            chartHeader.style.display = 'flex';
            chartHeader.style.justifyContent = 'space-between';
            chartHeader.style.alignItems = 'center';
            chartHeader.style.marginBottom = '16px';
            
            const chartRangeLabel = (configStart || configEnd) ? 'Range' : `${configDays}-Day`;
            const titleEl = chartHeader.createEl('h4', { text: `${displayTitle} Trend (${chartRangeLabel})`, cls: 'omni-db-chart-title' });
            titleEl.style.margin = '0';
            titleEl.style.borderLeft = '3px solid var(--interactive-accent)';
            titleEl.style.paddingLeft = '8px';
            
            let chartExcludeWeekends = false;
            const groupName = isStandalone ? '' : gName;
            if (groupName && yamlOverrides[groupName] !== undefined) {
                chartExcludeWeekends = yamlOverrides[groupName];
            } else if (isStandalone && yamlOverrides[groupCards[0].key] !== undefined) {
                chartExcludeWeekends = yamlOverrides[groupCards[0].key];
            } else {
                const targetKey = groupName || groupCards[0].key;
                if ((plugin.settings as any).groupExcludeWeekends && (plugin.settings as any).groupExcludeWeekends[targetKey] !== undefined) {
                    chartExcludeWeekends = (plugin.settings as any).groupExcludeWeekends[targetKey];
                } else if (isStandalone) {
                    const card = groupCards[0];
                    chartExcludeWeekends = (card && card.excludeWeekends === true);
                } else {
                    const groupCardsWithConfig = groupCards.filter(c => c.excludeWeekends !== undefined);
                    if (groupCardsWithConfig.length > 0) {
                        chartExcludeWeekends = groupCardsWithConfig.some(c => c.excludeWeekends === true);
                    } else {
                        chartExcludeWeekends = configExcludeWeekends;
                    }
                }
            }
            
            const chartBadgeEl = document.createElement('span');
            chartBadgeEl.style.cursor = 'pointer';
            chartBadgeEl.style.fontSize = '0.75em';
            chartBadgeEl.style.padding = '2px 8px';
            chartBadgeEl.style.borderRadius = '12px';
            chartBadgeEl.style.fontWeight = '500';
            chartBadgeEl.style.transition = 'all 0.2s';
            chartBadgeEl.style.display = 'inline-block';
            chartBadgeEl.style.border = '1px solid var(--background-modifier-border)';

            const setChartBadgeStyle = () => {
                if (chartExcludeWeekends) {
                    chartBadgeEl.textContent = 'Excl Wknd';
                    chartBadgeEl.style.background = 'linear-gradient(90deg, #818cf8, #ec4899)';
                    chartBadgeEl.style.color = '#ffffff';
                    chartBadgeEl.style.border = 'none';
                } else {
                    chartBadgeEl.textContent = 'Incl Wknd';
                    chartBadgeEl.style.background = 'var(--background-secondary-alt)';
                    chartBadgeEl.style.color = 'var(--text-muted)';
                    chartBadgeEl.style.border = '1px solid var(--background-modifier-border)';
                }
            };
            setChartBadgeStyle();
            chartHeader.appendChild(chartBadgeEl);
            
            const canvasWrapper = chartBox.createDiv({ cls: 'omni-db-chart-canvas-wrapper' });
            const canvas = canvasWrapper.createEl('canvas', { attr: { id: `omni_chart_g_${chartIdx++}` } });
            
            const canvasObj = { 
                canvas, 
                cards: groupCards, 
                title: displayTitle, 
                get excludeWeekends() { return chartExcludeWeekends; },
                set excludeWeekends(v: boolean) { chartExcludeWeekends = v; setChartBadgeStyle(); }
            };
            
            chartBadgeEl.onclick = async (e) => {
                e.stopPropagation();
                canvasObj.excludeWeekends = !canvasObj.excludeWeekends;
                renderSingleChart(canvasObj);
                
                if (!(plugin.settings as any).groupExcludeWeekends) {
                    (plugin.settings as any).groupExcludeWeekends = {};
                }
                const targetKey = groupName || canvasObj.cards[0].key;
                (plugin.settings as any).groupExcludeWeekends[targetKey] = canvasObj.excludeWeekends;
                await plugin.saveSettings();
            };
            
            canvases.push(canvasObj);
        }

        const renderSingleChart = (canvasObj: any) => {
            const { canvas, cards: groupCards } = canvasObj;
            const chartExcludeWeekends = canvasObj.excludeWeekends;
            
            const isDark = document.body.classList.contains("theme-dark");
            const textColor = isDark ? "#b3b3b3" : "#555555";
            const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
            
            const filteredChartData = chartExcludeWeekends
                ? rangeData.filter(d => {
                    const day = (window as any).moment(d.date).day();
                    return day !== 0 && day !== 6;
                })
                : rangeData;

            const labels = filteredChartData.map(d => d.date.substring(5));
            const ctx = canvas.getContext('2d');
            const chartId = `instance_${canvas.id}`;
            if ((window as any)[chartId]) (window as any)[chartId].destroy();
            
            const hasBar = groupCards.some((c: any) => c.chartType === 'bar');
            const mainType = hasBar ? 'bar' : 'line';
            
            const datasets = groupCards.map((card: any) => {
                const color = card.color || '#6366f1';
                return {
                    type: card.chartType,
                    label: card.label,
                    data: filteredChartData.map(d => d[card.key] !== undefined && d[card.key] !== null ? d[card.key] : null),
                    borderColor: color,
                    backgroundColor: card.chartType === 'bar' ? color + '66' : color + '1a',
                    borderWidth: 2,
                    tension: 0.3,
                    spanGaps: true
                };
            });
            
            (window as any)[chartId] = new Chart(ctx, {
                type: mainType,
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { 
                            display: groupCards.length > 1,
                            position: 'top',
                            labels: { color: textColor, font: { size: 9 } }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 9 } }
                        },
                        y: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 9 } },
                            beginAtZero: hasBar
                        }
                    }
                }
            });
        };

        const renderAllCharts = () => {
            canvases.forEach(canvasObj => renderSingleChart(canvasObj));
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

export async function archiveWeeklyReport(plugin: OmniLoggerPlugin): Promise<void> {
    const moment = (window as any).moment;
    const now = moment();
    const startOfLastWeek = moment().subtract(7, 'days').startOf('day');
    const endOfLastWeek = moment().subtract(1, 'days').endOf('day');
    
    const weekNum = now.week();
    const yearNum = now.year();
    const reportFilename = `${yearNum}-W${String(weekNum).padStart(2, '0')}.md`;
    
    const dailyFiles = plugin.app.vault.getMarkdownFiles().filter(file => {
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
    
    let localParser: any = null;
    try {
        const fs = require('fs');
        const path = require('path');
        const basePath = (plugin.app.vault.adapter as any).getBasePath ? (plugin.app.vault.adapter as any).getBasePath() : '';
        const localParserPath = path.join(basePath, '.obsidian', 'plugins', 'omni-logger', 'local-parser.js');
        if (fs.existsSync(localParserPath)) {
            const localContent = fs.readFileSync(localParserPath, 'utf8');
            const moduleObj = { exports: {} };
            const fn = new Function('module', 'exports', 'require', localContent);
            fn(moduleObj, moduleObj.exports, require);
            localParser = moduleObj.exports;
        }
    } catch (e) {
        console.error("Failed to load local parser for weekly report:", e);
    }
    
    const cards: any[] = (localParser && Array.isArray(localParser.extraCards)) ? localParser.extraCards : [];
    markdown += `## 📈 Summary Metrics\n\n`;
    markdown += `| Date | ` + cards.map(c => c.label).join(' | ') + ` |\n`;
    markdown += `| --- | ` + cards.map(() => '---').join(' | ') + ` |\n`;
    
    const parsedRows: any[] = [];
    for (let file of dailyFiles) {
        const dateStr = file.basename;
        const content = await plugin.app.vault.read(file);
        const cache = plugin.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter || {};
        
        const inlineData: Record<string, string> = {};
        const inlineRegex = /^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?)?([a-zA-Z0-9_\-]+)(?:::|:)\s*(.+)$/gm;
        let match;
        while ((match = inlineRegex.exec(content)) !== null) {
            inlineData[match[1].trim()] = match[2].trim();
        }
        
        const getVal = (key: string) => {
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
        
        const rowVals: any[] = [];
        const rowData: any = { date: dateStr };
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
            
            let displayVal: any = val;
            if (card.unit === 'hrs') displayVal = (Math.round(val * 100) / 100) + ' hrs';
            else if (card.unit) displayVal = val + ' ' + card.unit;
            rowVals.push(displayVal);
        });
        parsedRows.push(rowData);
        markdown += `| **${dateStr}** | ` + rowVals.join(' | ') + ` |\n`;
    }
    
    markdown += `\n### 📊 Weekly Baselines & Averages\n\n`;
    const averages: string[] = [];
    cards.forEach(card => {
        let sum = 0, count = 0;
        parsedRows.forEach(row => {
            if (row[card.key] !== undefined && row[card.key] !== null) {
                sum += row[card.key];
                count++;
            }
        });
        const avg = count > 0 ? (sum / count) : 0;
        let displayAvg: any = Math.round(avg * 100) / 100;
        if (card.unit) displayAvg += ' ' + card.unit;
        averages.push(`*   **${card.label}:** ${displayAvg}`);
    });
    markdown += averages.join('\n') + `\n`;
    
    const folderPath = '08_Health/Reports/Weekly';
    const fullFilePath = `${folderPath}/${reportFilename}`;
    
    const fs = require('fs');
    const path = require('path');
    const vaultPath = (plugin.app.vault.adapter as any).getBasePath ? (plugin.app.vault.adapter as any).getBasePath() : '';
    const absFolderPath = path.join(vaultPath, folderPath.replace(/\//g, path.sep));
    const absFilePath = path.join(vaultPath, fullFilePath.replace(/\//g, path.sep));
    
    if (!fs.existsSync(absFolderPath)) {
        fs.mkdirSync(absFolderPath, { recursive: true });
    }
    
    fs.writeFileSync(absFilePath, markdown, 'utf8');
    new obsidian.Notice(`Archived weekly health report as: ${fullFilePath}`);
}
