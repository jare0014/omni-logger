import { App, Notice } from "obsidian";
import * as fs from "fs";
import * as path from "path";
import { OmniPluginSettings } from "../models/OmniSettings";
import { AiLlmService } from "./AiLlmService";

export class CustomTemplateService {
    private app: App;
    private settings: OmniPluginSettings;
    private aiLlm: AiLlmService;
    private onTemplateUpdated?: (template: any) => void;

    constructor(
        app: App,
        settings: OmniPluginSettings,
        aiLlm: AiLlmService,
        onTemplateUpdated?: (template: any) => void
    ) {
        this.app = app;
        this.settings = settings;
        this.aiLlm = aiLlm;
        this.onTemplateUpdated = onTemplateUpdated;
    }

    public async loadCustomTemplatesFromVault(): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
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
        
        const templates: any[] = [];
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
                    let metadata: any = { destination: 'frontmatter', id: 'custom-' + Date.now() };
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

    public async saveCustomTemplateToVault(template: any, exampleInput: string, targetAppearance: string, instructions: string): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
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
        const metadata: any = {
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
        await this.loadCustomTemplatesFromVault();
        
        if (this.onTemplateUpdated) {
            this.onTemplateUpdated(template);
        }
    }

    public async deleteCustomTemplateFromVault(templateName: string): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const folderName = this.settings.ingredientsFolder || 'Omni_Templates';
        
        const cleanName = templateName.replace(/[^a-zA-Z0-9 _-]/g, '');
        const dirPath = path.join(vaultPath, folderName, cleanName);
        
        const template = this.settings.customTemplates?.find(t => t.name === templateName);
        if (template) {
            await this.removeMetaBindButton(template.id);
        }
        
        if (fs.existsSync(dirPath)) {
            try {
                if ((fs as any).rmSync) {
                    (fs as any).rmSync(dirPath, { recursive: true, force: true });
                } else {
                    fs.rmdirSync(dirPath, { recursive: true });
                }
            } catch(e) {
                console.error("Failed to delete template folder:", e);
            }
        }
        
        await this.loadCustomTemplatesFromVault();
    }

    public async updateMetaBindButton(t: any): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const metaBindPath = path.join(vaultPath, '.obsidian', 'plugins', 'obsidian-meta-bind-plugin', 'data.json');
        
        if (!fs.existsSync(metaBindPath)) return;
        
        try {
            const data = JSON.parse(fs.readFileSync(metaBindPath, 'utf8'));
            if (!data.buttonTemplates) data.buttonTemplates = [];
            
            const btnId = `${t.id}-btn`;
            let existing = data.buttonTemplates.find((b: any) => b.id === btnId);
            
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
            new Notice(`Meta Bind button "${btnId}" synchronized!`);
        } catch (e) {
            console.error("Failed to update Meta Bind button:", e);
        }
    }

    public async removeMetaBindButton(id: string): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
        const metaBindPath = path.join(vaultPath, '.obsidian', 'plugins', 'obsidian-meta-bind-plugin', 'data.json');
        
        if (!fs.existsSync(metaBindPath)) return;
        
        try {
            const data = JSON.parse(fs.readFileSync(metaBindPath, 'utf8'));
            if (!data.buttonTemplates) return;
            
            const btnId = `${id}-btn`;
            const initialLen = data.buttonTemplates.length;
            data.buttonTemplates = data.buttonTemplates.filter((b: any) => b.id !== btnId);
            
            if (data.buttonTemplates.length < initialLen) {
                fs.writeFileSync(metaBindPath, JSON.stringify(data, null, 2), 'utf8');
                new Notice(`Removed Meta Bind button template "${btnId}".`);
            }
        } catch (e) {
            console.error("Failed to remove Meta Bind button:", e);
        }
    }

    public async generateCustomTemplatePrompt(
        name: string,
        mode: string,
        exampleInput: string,
        targetAppearance: string,
        destination: string,
        customInstructions: string = ""
    ): Promise<{ prompt: string; pythonCode: string }> {
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
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    payload = f.read()
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
        
        const textResponse = await this.aiLlm.callLLM(
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

    public async loadGoToItems(): Promise<any[]> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
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

    public async saveGoToItems(items: any[]): Promise<void> {
        const vaultPath = (this.app.vault.adapter as any).getBasePath ? (this.app.vault.adapter as any).getBasePath() : "";
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
}
