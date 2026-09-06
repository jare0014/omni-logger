import { App, requestUrl } from "obsidian";
import { OmniPluginSettings } from "../models/OmniSettings";
import { KeychainService } from "./KeychainService";
import { DailyNoteWriter } from "./DailyNoteWriter";

export class AiLlmService {
    private app: App;
    private settings: OmniPluginSettings;
    private keychain: KeychainService;
    private dailyWriter: DailyNoteWriter;

    constructor(app: App, settings: OmniPluginSettings, keychain: KeychainService, dailyWriter: DailyNoteWriter) {
        this.app = app;
        this.settings = settings;
        this.keychain = keychain;
        this.dailyWriter = dailyWriter;
    }

    public async callLLM(
        provider: string,
        model: string,
        systemPrompt: string,
        promptText: string,
        imageBase64: string | null = null,
        imageMimeType: string | null = null
    ): Promise<string> {
        if (provider === 'gemini') {
            let apiKey = await this.keychain.getSecret(this.settings.geminiApiKeyId || 'omni-logger-gemini-api-key', 'geminiApiKey');
            if (!apiKey) {
                apiKey = await this.keychain.getSecret('timeblocker-gemini-api-key', 'geminiApiKey');
            }
            if (!apiKey) {
                throw new Error("Gemini API Key not configured! Please configure it in settings.");
            }
            
            let apiModel = model;
            if (model.startsWith("gemini-3.5") || model.startsWith("gemini-3.1")) {
                apiModel = model.toLowerCase().includes("lite") ? "gemini-2.5-flash-lite" : "gemini-2.5-flash";
            }
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${apiKey}`;
            const parts: any[] = [];
            
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
            
            const payload: any = {
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
            
            const response = await requestUrl({
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
            
            const payload: any = {
                model: model,
                system: systemPrompt || "",
                prompt: promptText || "",
                stream: false,
                format: "json"
            };
            
            if (imageBase64) {
                const base64Data = imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64;
                payload['images'] = [base64Data];
            }
            
            const response = await requestUrl({
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
            let apiKey = await this.keychain.getSecret(this.settings.openaiApiKeyId || 'omni-logger-openai-api-key', 'openaiApiKey');
            if (!apiKey) {
                throw new Error("OpenAI API Key not configured! Please configure it in settings.");
            }
            const url = 'https://api.openai.com/v1/chat/completions';
            const messages: any[] = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            const userContent: any[] = [];
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

            const response = await requestUrl({
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

    public async processOCR(base64Data: string, mimeType: string, type: string): Promise<void> {
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
        
        const dailyFile = this.dailyWriter.getDailyNoteFile();
        if (!dailyFile) {
            throw new Error("Daily note not found!");
        }
        
        let content = await this.app.vault.read(dailyFile);
        
        if (type === 'calls') {
            content = this.dailyWriter.updateCallsInContent(content, data);
        } else if (type === 'lumosity') {
            const startTime = data.start_time || "08:00 AM";
            const scores = data.scores || [];
            content = this.dailyWriter.updateLumosityInContent(content, startTime, scores);
        } else if (type === 'health') {
            content = this.dailyWriter.updateFrontmatterProperties(content, data);
        } else if (customTemplate) {
            await this.dailyWriter.writeCustomTemplateData(data, customTemplate);
            return;
        }
        
        await this.app.vault.modify(dailyFile, content);
    }

    public async processCustomAPI(inputText: string, templateId: string): Promise<void> {
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
        await this.dailyWriter.writeCustomTemplateData(data, customTemplate);
    }
}
