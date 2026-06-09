# Obsidian Omni-Logger Plugin

A consolidated dashboard and synchronizer that integrates multimodal clipboard screenshots and Fitbit health telemetry into your daily journal notes.

## 🚀 Key Features

* **Clipboard Image Ingestion:** Hooks directly into OS-level clipboard buffers via Python `Pillow` to capture screenshots (e.g. from `Win+Shift+S`) in a single paste keystroke, skipping manual file dialogs.
* **Google Health API v4 Sync:** Automatically queries Google Health endpoints to synchronize sleep and Heart Rate Variability (HRV) metrics.
* **API Constraint Handling:** Conforms sleep queries and HRV lookups strictly to restricted Google Health API query filter requirements, mapping RMSSD fields and converting API duration strings.
