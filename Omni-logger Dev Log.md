---
status: 🟢 Active
type: LifeOS
repo: omni-logger
---

[[Omni-Logger Case Study Note]]

## Dev Log History
```dataviewjs
const current = dv.current();
if (!current || !current.file) return;
const currentFileName = current.file.name;

// 1. Determine project keywords and git repository names to match
const cleanName = currentFileName
    .replace(/dev log/i, "")
    .replace(/project/i, "")
    .trim()
    .toLowerCase();

const slugName = cleanName.replace(/[^a-z0-9]+/g, "-");

// Collect repo candidates
let candidates = new Set([cleanName, slugName]);

// Support explicit repo names listed in the note's frontmatter
if (current.repo) {
    const repos = Array.isArray(current.repo) ? current.repo : [current.repo];
    for (const r of repos) {
        if (r) {
            candidates.add(r.trim().toLowerCase());
            candidates.add(r.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"));
        }
    }
}

// Add known hardcoded fallbacks to maintain compatibility automatically
if (currentFileName.includes("Schedule Assistant")) {
    candidates.add("schedule-assistant-focus-timer");
    candidates.add("timeblocker and task timer");
}
if (currentFileName.includes("DRG")) {
    candidates.add("dynamical representation geometry");
}

const candidateList = Array.from(candidates);

// Filter out generic keywords for message-level matching
const genericNames = new Set(["untitled", "untitled.md", "dev log", "project", "log", "history", ""]);
const msgKeywords = candidateList.filter(c => c && !genericNames.has(c));

// 2. Fetch and process daily notes from "02_Journal/01_Daily"
const pages = dv.pages('"02_Journal/01_Daily"').sort(p => p.file.name, "desc");
const rows = [];

for (const p of pages) {
    const logs = [];
    
    // Check if this daily note explicitly links to this project page
    const projects = [].concat(p.Project || []);
    const isLinkedToThisProject = projects.some(proj => {
        if (proj && typeof proj === 'object' && proj.path) {
            return proj.path === current.file.path;
        }
        return String(proj).includes(currentFileName);
    });

    // A. Parse manual log entries (from Dev_Log or Log fields)
    const devLogs = [].concat(p.Dev_Log || []).concat(p.Log || []);
    for (const dl of devLogs) {
        if (!dl) continue;
        const dlStr = String(dl);
        const matchesManual = isLinkedToThisProject || 
                              dlStr.includes(currentFileName) || 
                              candidateList.some(cand => dlStr.toLowerCase().includes(cand));
        if (matchesManual && !logs.includes(dlStr)) {
            logs.push(dlStr);
        }
    }
    
    // B. Parse Antigravity Git Logs
    const content = await dv.io.load(p.file.path);
    if (content) {
        const gitLogRegex = /<!--\s*START(?:_|-)(?:antigravity|Antigravity)(?:_|-)(?:git|Git)(?:_|-)(?:log|Log)\s*-->([\s\S]*?)<!--\s*END(?:_|-)(?:antigravity|Antigravity)(?:_|-)(?:git|Git)(?:_|-)(?:log|Log)\s*-->/i;
        const match = content.match(gitLogRegex);
        if (match) {
            const gitBlock = match[1];
            const lines = gitBlock.split(/\r?\n/);
            let currentRepo = "";
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith("**") && line.endsWith("**")) {
                    currentRepo = line.replace(/\*\*/g, '').trim().toLowerCase();
                } else if (line.startsWith("- ") && currentRepo) {
                    const commitLower = line.toLowerCase();
                    const repoMatches = candidateList.some(cand => 
                        currentRepo === cand || 
                        currentRepo.includes(cand) || 
                        cand.includes(currentRepo)
                    );
                    const messageMatches = msgKeywords.some(kw => commitLower.includes(kw));
                    
                    if (repoMatches || messageMatches) {
                        const logLine = "🐙 **Git Log**: " + line.substring(2);
                        if (!logs.includes(logLine)) {
                            logs.push(logLine);
                        }
                    }
                }
            }
        }
    }
    
    // C. Add to table if logs were found for this day
    if (logs.length > 0) {
        rows.push([p.file.link, logs.join("<br>")]);
    }
}

dv.table(["Date", "Notes"], rows);
```

## ToDo
- [ ] **Omni-Logger Decomposition & Aggregator Roadmap**:
  - [ ] **`obsidian-health-connect`**: Google Health Connect v4 API sync + Nutrition Fact / Meal Photo OCR modal + Google Health writeback & daily note macros.
  - [ ] **`obsidian-omni-vision` (General OCR Hub)**: Configurable screenshot & image parser (Lumosity brain scores, work call summaries, receipts) with customizable prompt recipes + local `parser.py` / LLM fallback.
  - [ ] **`obsidian-ble-hub` (Device-Agnostic Bluetooth Sync)**: Web Bluetooth GATT sniffer + LLM characteristic byte mapping generator (Puffco Peak Pro / Proxy profile for `Puffco_odometer` and `First_dab`).
  - [ ] **Central Dashboard & Aggregator**: Unified dashboard note / widget layer with LLM composite readiness calculations, Meta-Bind controls, and inter-plugin event bus (`app.workspace.trigger('omni:metric-updated')`).
- [ ] Food Logger OCR: Add clipboard / image OCR modal to parse nutrition facts labels & meal photos into structured `FoodItem` JSON and auto-register them into the Stored Food Registry (`storedFoods` / Go-To Items) for 1-click Google Health API logging. (Added: 2026-07-14)
- [ ] Modular TypeScript refactor for Omni-Logger (break down monolithic main.js into clean src/ modules: OCR engine, clipboard watcher, vitals parser, and modal UI) (Added: 2026-08-19)
- [x] Test standalone health-connect-readiness plugin spin-off (GCP v4 API sync, Meta Bind buttons, food logger, and readiness dashboard). (Added: 2026-08-18, Completed: 2026-08-21)
- [ ] Time-of-day bins for timed entries & weight logging rations in Omni-Logger. (Added: 2026-08-08)

