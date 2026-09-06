import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../../main";
import { requestWithTimeout, createStatusBadge, updateBadge } from "../SettingsHelpers";

export class AiProviderSettingsSection {
    constructor(
        private plugin: OmniLoggerPlugin,
        private containerEl: HTMLElement,
        private onFullRefresh: () => void
    ) {}

    render(): void {
        const { containerEl } = this;

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
                    this.onFullRefresh();
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
                        text.setValue(secret || '');
                    });
                    text.onChange(async (value) => {
                        await this.plugin.setSecret(geminiSecretId, 'geminiApiKey', value.trim());
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
                        } catch(e: any) {
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
            
            const templateGeminiOptions = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];
            let templateModelVal = this.plugin.settings.templateModel || 'gemini-3.5-flash-lite';
            let isTemplateCustom = (!templateGeminiOptions.includes(templateModelVal) && templateModelVal !== '') || templateModelVal === 'custom';

            new obsidian.Setting(containerEl)
                .setName('Model')
                .setDesc('Gemini model to use for templates.')
                .addDropdown(dropdown => {
                    dropdown
                        .addOption('gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite (Fast & Ultra-Light)')
                        .addOption('gemini-3.5-flash', 'Gemini 3.5 Flash')
                        .addOption('gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite')
                        .addOption('gemini-2.5-flash', 'Gemini 2.5 Flash')
                        .addOption('gemini-2.5-pro', 'Gemini 2.5 Pro')
                        .addOption('custom', 'Custom...');
                    dropdown.setValue(isTemplateCustom ? 'custom' : templateModelVal)
                        .onChange(async (value) => {
                            if (value === 'custom') {
                                this.plugin.settings.templateModel = this.plugin.settings.customTemplateModel || 'custom';
                            } else {
                                this.plugin.settings.templateModel = value;
                            }
                            await this.plugin.saveSettings();
                            this.onFullRefresh();
                        });
                });

            if (isTemplateCustom || this.plugin.settings.templateModel === 'custom') {
                new obsidian.Setting(containerEl)
                    .setName('Custom Model Name')
                    .setDesc('Enter custom model identifier (e.g. qwen2.5:14b).')
                    .addText(text => text
                        .setPlaceholder('Enter model name...')
                        .setValue(this.plugin.settings.customTemplateModel || (isTemplateCustom ? templateModelVal : ''))
                        .onChange(async (value) => {
                            this.plugin.settings.customTemplateModel = value.trim();
                            this.plugin.settings.templateModel = value.trim();
                            await this.plugin.saveSettings();
                        }));
            }
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
                        } catch(e: any) {
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
                        this.plugin.settings.executorModel = 'gemini-3.5-flash-lite';
                    } else if (value === 'openai') {
                        this.plugin.settings.executorModel = 'gpt-4o-mini';
                    }
                    await this.plugin.saveSettings();
                    this.onFullRefresh();
                }));

        if (this.plugin.settings.executorProvider === 'gemini') {
            const executorGeminiOptions = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'];
            let executorModelVal = this.plugin.settings.executorModel || 'gemini-3.5-flash-lite';
            let isExecutorCustom = (!executorGeminiOptions.includes(executorModelVal) && executorModelVal !== '') || executorModelVal === 'custom';

            new obsidian.Setting(containerEl)
                .setName('Execution Model')
                .setDesc('Gemini model to use for execution.')
                .addDropdown(dropdown => {
                    dropdown
                        .addOption('gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite (Fast & Ultra-Light)')
                        .addOption('gemini-3.5-flash', 'Gemini 3.5 Flash')
                        .addOption('gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite')
                        .addOption('gemini-2.5-flash', 'Gemini 2.5 Flash')
                        .addOption('gemini-2.5-pro', 'Gemini 2.5 Pro')
                        .addOption('custom', 'Custom...');
                    dropdown.setValue(isExecutorCustom ? 'custom' : executorModelVal)
                        .onChange(async (value) => {
                            if (value === 'custom') {
                                this.plugin.settings.executorModel = this.plugin.settings.customExecutorModel || 'custom';
                            } else {
                                this.plugin.settings.executorModel = value;
                            }
                            await this.plugin.saveSettings();
                            this.onFullRefresh();
                        });
                });

            if (isExecutorCustom || this.plugin.settings.executorModel === 'custom') {
                new obsidian.Setting(containerEl)
                    .setName('Custom Execution Model Name')
                    .setDesc('Enter custom model identifier (e.g. qwen2.5:14b).')
                    .addText(text => text
                        .setPlaceholder('Enter model name...')
                        .setValue(this.plugin.settings.customExecutorModel || (isExecutorCustom ? executorModelVal : ''))
                        .onChange(async (value) => {
                            this.plugin.settings.customExecutorModel = value.trim();
                            this.plugin.settings.executorModel = value.trim();
                            await this.plugin.saveSettings();
                        }));
            }
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
                        } catch(e: any) {
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
    }
}
