# Obsidian Omni-Logger Plugin

A premium, local-first consolidated dashboard and synchronizer that integrates multimodal clipboard screenshots and Google Health (v4) telemetry directly into your daily journal notes.

It supports pulling sleep, HRV, caffeine, alcohol, hydration, protein, and calories, and provides an OCR screenshot ingestion loop using either cloud-based Google Gemini or local offline Ollama models.

---

## 🚀 Key Features

*   **Google Health API v4 Sync:** Automatically queries Google Health REST endpoints to synchronize sleep, HRV, and nutrition biometrics.
*   **Decoupled Database Model:** Writes to Google Health as the single source of truth; synchronization pulls health values into your daily notes dynamically based on your custom destination configuration.
*   **Food Ingestion & Registry Wizard:** Interactive UI command to log meals directly to Google Health and easily add/register custom foods to your database.
*   **Flexible Metadata Destinations:** Sync health variables directly to frontmatter YAML properties, inline Dataview fields, or appended bottom logs.
*   **Multimodal OCR Screenshot Ingestion:** Grab clipboard images (e.g. from `Win+Shift+S`) or drag-and-drop captures to automatically parse and log call statistics, focus intervals, or brain-training (Lumosity) scores.
*   **Flexible LLM Provider Routing:** Run parsing locally using **Ollama** (offline, no API key required) or scale via **Google Gemini**.
*   **Local Git Commit Logging Integration:** Automatically aggregates native `git log` commit history across multiple local repositories in the background, logging daily progress without blocking the main Electron UI.

---

## 🛠️ Integration & Setup

### 1. Clone into Plugins
Clone this repository directly into your Obsidian vault's plugins folder:
```bash
cd YourVault/.obsidian/plugins/
git clone https://github.com/jare0014/omni-logger.git
cd omni-logger
npm install
```

### 2. Configure Python Helpers
The plugin invokes python scripts in the background for clipboard manipulation and local health sync. Ensure dependencies are installed:
```bash
pip install requests pillow
```

### 3. Setup Google Health API Credentials
To enable Fitbit and Google Health sync:
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a project and enable the **Google Health API** (v4).
3.  Set up your OAuth consent screen and add these scopes:
    *   `https://www.googleapis.com/auth/googlehealth.sleep.readonly`
    *   `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`
    *   `https://www.googleapis.com/auth/googlehealth.nutrition` (handles general nutrition, hydration, and alcohol)
4.  Create an **OAuth Web Client ID** and set the redirect URL to:
    `http://localhost:8080/`
5.  In Obsidian Settings -> **Omni-Logger**, enter your Client ID and Client Secret, choose your desired sync scopes, and click **Connect Google Health** to complete authentication.

---

## ⚙️ Configuration Options

### Synced Metrics Target Grid
Configure exactly where and how each biometric value is logged on your daily notes:
*   **Toggle:** Enable or disable syncing.
*   **Target Key:** Customize the property key (e.g. `caffeine`, `hydration`, `HRV`).
*   **Format Type:** Choose between:
    *   `yaml` (YAML frontmatter block)
    *   `inline` (Inline Dataview fields `Key:: Value`)
    *   `log` (Appended daily text log at the bottom)

### LLM Ingestion Prompts
Fully customizable templates are split into individual textareas in the settings panel:
*   **Sleep/Biometric Prompts:** OCR instructions for parsing Fitbit sleep summaries.
*   **Vitals Prompts:** Instructions for heart rate and HRV charts.
*   **Nutrition/Hydration Prompts:** Instructions for logging meals.

---

## 🥗 Logging Food & Drinks

The plugin implements a strict read/write decoupling where Google Health acts as the single source of truth.

### Tapping the Meta-Bind Button
Add a Meta-Bind button in your daily note template referencing the registered action:
```meta-bind-button
label: 🥗 Log Food
icon: salad
style: primary
action:
  type: command
  command: omni-logger:open-food-logger
```

### Using the Wizard
Tapping the button or running **`Open Food Ingestion & Registry`** from the command palette opens a modal where you can:
1.  **Log Food:** Select a food item (like *Double Espresso* or *IPA*), input servings, and post it securely to Google Health.
2.  **Add to Registry:** Input custom food items, specify their default serving size, and assign nutritional macros (milligrams of caffeine, grams of alcohol, protein, and calories) to add them to your local registry (`health_go_to_items.json`).
