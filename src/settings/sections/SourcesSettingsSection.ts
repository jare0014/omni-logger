import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../../main";
import { OmniApiWizardModal } from "../../views/modals/OmniApiWizardModal";
import { OmniBleManagerModal } from "../../views/modals/OmniBleManagerModal";
import { OmniFoodLoggerModal } from "../../views/modals/OmniFoodLoggerModal";
import { OmniTemplateCreatorModal } from "../../views/modals/OmniTemplateCreatorModal";
import { requestWithTimeout, createStatusBadge, updateBadge } from "../SettingsHelpers";

export class SourcesSettingsSection {
    constructor(
        private app: obsidian.App,
        private plugin: OmniLoggerPlugin,
        private containerEl: HTMLElement,
        private onFullRefresh: () => void
    ) {}

    render(): void {
        const { containerEl } = this;

        // =====================================================================
        // 2. 🔌 SOURCES (Middle)
        // =====================================================================
        containerEl.createEl('hr');
        
        const connectionsHeader = containerEl.createDiv({ style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;' });
        connectionsHeader.createEl('h3', { text: '🔌 Sources', style: 'margin:0;' });
        
        const headerButtons = connectionsHeader.createDiv({ style: 'display:flex; gap:10px;' });
        
        const addApiBtn = headerButtons.createEl('button', { text: '+ Add API Connection', cls: 'mod-cta' });
        addApiBtn.onclick = () => {
            new OmniApiWizardModal(this.app, this.plugin, () => this.onFullRefresh()).open();
        };

        const scanBleBtn = headerButtons.createEl('button', { text: '+ Pair BLE Device', cls: 'mod-cta' });
        scanBleBtn.onclick = () => {
            new OmniBleManagerModal(this.app, this.plugin, () => this.onFullRefresh()).open();
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

        const toggleGitInterval = () => {
            if (this.plugin.settings.gitSyncStyle === 'automatic') {
                gitIntervalSetting.settingEl.style.display = '';
            } else {
                gitIntervalSetting.settingEl.style.display = 'none';
            }
        };

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
                    this.onFullRefresh();
                }));

        if (this.plugin.settings.dataSourceApi === 'google-health') {
            const googleHealthContainer = googleHealthDetailsContainer.createDiv();
            googleHealthContainer.style.padding = '15px';
            googleHealthContainer.style.border = '1px solid var(--background-modifier-border)';
            googleHealthContainer.style.borderRadius = '8px';
            googleHealthContainer.style.marginTop = '10px';
            googleHealthContainer.style.backgroundColor = 'var(--background-secondary)';

            const toggleHealthInterval = () => {
                if (this.plugin.settings.googleHealthSyncStyle === 'automatic') {
                    healthIntervalSetting.settingEl.style.display = '';
                } else {
                    healthIntervalSetting.settingEl.style.display = 'none';
                }
            };

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
                    text.setPlaceholder('{"web":{"client_id":"..."}}');
                    this.plugin.getSecret('omni-logger-google-credentials', 'googleClientJson').then(val => {
                        text.setValue(val || '');
                    });
                    text.onChange(async (value) => {
                        await this.plugin.setSecret('omni-logger-google-credentials', 'googleClientJson', value.trim());
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
                       } catch (e: any) {
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
                
                checkbox.onchange = async () => {
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
            
            const syncConfig = (this.plugin.settings as any).healthSyncConfig || {};
            const keys = Object.keys(syncConfig);
            
            keys.forEach(k => {
                const row = metricsGrid.createDiv({ style: 'display:flex; align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap; border-bottom:1px solid var(--background-modifier-border-hover); padding-bottom:6px;' });
                row.createSpan({ text: k.toUpperCase(), style: 'font-weight:bold; width:80px; text-transform:capitalize;' });
                
                const enableLabel = row.createEl('label', { style: 'display:flex; align-items:center; gap:4px; font-size:0.95em;' });
                const enableCheck = enableLabel.createEl('input', { type: 'checkbox' });
                enableCheck.checked = syncConfig[k].enabled;
                enableCheck.onchange = async () => {
                    syncConfig[k].enabled = enableCheck.checked;
                    await this.plugin.saveSettings();
                };
                enableLabel.createSpan({ text: 'Sync' });

                const destSelect = row.createEl('select');
                destSelect.createEl('option', { value: 'frontmatter', text: 'Frontmatter' });
                destSelect.createEl('option', { value: 'inline', text: 'Inline Field' });
                destSelect.createEl('option', { value: 'append', text: 'Append Section' });
                destSelect.value = syncConfig[k].destination;
                destSelect.onchange = async () => {
                    syncConfig[k].destination = destSelect.value;
                    await this.plugin.saveSettings();
                };

                const keyInput = row.createEl('input', { type: 'text', placeholder: 'Target Key (e.g. HRV)', style: 'flex:1; min-width:110px;' });
                keyInput.value = syncConfig[k].key || '';
                keyInput.onchange = async () => {
                    syncConfig[k].key = keyInput.value.trim();
                    await this.plugin.saveSettings();
                };

                // Per-Scope Sync Style (Manual vs Automatic) & Interval
                const scopeStyleSelect = row.createEl('select');
                scopeStyleSelect.createEl('option', { value: 'manual', text: 'Manual' });
                scopeStyleSelect.createEl('option', { value: 'automatic', text: 'Auto Sync' });
                scopeStyleSelect.value = syncConfig[k].syncStyle || 'manual';

                const scopeIntervalInput = row.createEl('input', { type: 'number', placeholder: 'Mins', style: 'width:65px;' });
                scopeIntervalInput.value = String(syncConfig[k].syncInterval || 60);
                scopeIntervalInput.style.display = (scopeStyleSelect.value === 'automatic') ? '' : 'none';

                scopeStyleSelect.onchange = async () => {
                    syncConfig[k].syncStyle = scopeStyleSelect.value;
                    scopeIntervalInput.style.display = (scopeStyleSelect.value === 'automatic') ? '' : 'none';
                    await this.plugin.saveSettings();
                };

                scopeIntervalInput.onchange = async () => {
                    scopeIntervalInput.value = String(parseInt(scopeIntervalInput.value) || 60);
                    syncConfig[k].syncInterval = parseInt(scopeIntervalInput.value) || 60;
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
                } catch(e: any) {
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
                    this.onFullRefresh();
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
                    this.onFullRefresh();
                }
            };
        });
    }
}
