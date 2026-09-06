import * as obsidian from "obsidian";

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
    googleHealthHydrationPrompt: 'Examine the raw Google Fitness API JSON payload representing hydration. Summarize total water intake in fluid ounces (fl oz). Note: The payload contains volumes in liters or milliliters (e.g. 0.25 liters = 250 ml = 8.45 fl oz). To convert milliliters to fluid ounces, divide milliliters by 29.5735 (or round to nearest integer). Your output MUST be a valid JSON object with keys like "hydration". Example: { "hydration": 25 }',
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
    openaiApiKey: '',
    localParserPrompt: "Calculate generic custom computed metrics. Example: calculate total active minutes by summing morning_exercise and evening_exercise (chartGroup: 'Fitness'). Calculate average focus score from study_sessions array (chartGroup: 'Productivity').",
    customAvailableKeys: [],
    blacklistedKeys: []
};



export { DEFAULT_SETTINGS };
