import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../../main";

export class OmniApiWizardModal extends obsidian.Modal {
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

