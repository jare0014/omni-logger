import * as obsidian from "obsidian";
import type OmniLoggerPlugin from "../../main";

export class OmniBleManagerModal extends obsidian.Modal {
    constructor(app, plugin, onDisplayTab) {
        super(app);
        this.plugin = plugin;
        this.onDisplayTab = onDisplayTab;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl('h2', { text: '🦷 Bluetooth BLE Device Manager', style: 'margin-bottom:15px; color:var(--text-accent); font-weight:bold;' });
        
        const mainContainer = contentEl.createDiv();

        // Status badge row
        const statusRow = mainContainer.createDiv({ style: 'display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;' });
        statusRow.createSpan({ text: 'BLE Sync Status:', style: 'font-weight:bold;' });
        
        const createStatusBadge = (parentEl) => {
            const badge = parentEl.createEl('span');
            badge.style.display = 'inline-block';
            badge.style.width = '10px';
            badge.style.height = '10px';
            badge.style.borderRadius = '50%';
            badge.style.marginLeft = '8px';
            return badge;
        };
        const updateBadge = (badge, ok, tooltip) => {
            badge.style.backgroundColor = ok ? '#30d158' : '#ff453a';
            badge.setAttribute('title', tooltip);
        };

        const bleStatusBadge = createStatusBadge(statusRow);
        const refreshBLEBadge = () => {
            const hasBLE = this.plugin.localSettings?.enableBLESync !== false;
            updateBadge(bleStatusBadge, hasBLE, hasBLE ? 'Ready' : 'Disabled');
        };
        refreshBLEBadge();

        new obsidian.Setting(mainContainer)
            .setName('Enable Background BLE Sync on this Machine')
            .setDesc('Toggle whether background Bluetooth sync tasks run on this specific computer. (Saved locally in local-settings.json).')
            .addToggle(toggle => toggle
                .setValue(this.plugin.localSettings?.enableBLESync !== false)
                .onChange(async (value) => {
                    this.plugin.localSettings.enableBLESync = value;
                    await this.plugin.saveLocalSettings();
                    refreshBLEBadge();
                    if (this.onDisplayTab) this.onDisplayTab();
                }));

        mainContainer.createEl('h4', { text: 'Paired Bluetooth Devices', style: 'margin-top:16px; margin-bottom:4px;' });
        mainContainer.createEl('p', {
            text: 'Device credentials (MAC address, handshake key) are stored locally in bluetooth_devices/ and are never synced or committed to git.',
            cls: 'setting-item-description',
            style: 'margin-bottom:10px;'
        });

        const bleDeviceRow = mainContainer.createDiv({ style: 'display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;' });

        const bleDeviceSelect = bleDeviceRow.createEl('select', { style: 'flex:1; min-width:160px;' });
        const refreshDeviceDropdown = () => {
            bleDeviceSelect.empty();
            const devices = this.plugin.listPairedDevices();
            if (devices.length === 0) {
                bleDeviceSelect.createEl('option', { value: '', text: '— No paired devices —' });
            } else {
                bleDeviceSelect.createEl('option', { value: '', text: '— Select a device —' });
                devices.forEach(d => bleDeviceSelect.createEl('option', { value: d.name, text: `${d.name}  (${d.address})` }));
            }
        };
        refreshDeviceDropdown();

        const removeDeviceBtn = bleDeviceRow.createEl('button', { text: 'Remove Device', cls: 'mod-warning' });
        removeDeviceBtn.onclick = () => {
            const sel = bleDeviceSelect.value;
            if (!sel) { new obsidian.Notice('Select a device to remove.'); return; }
            this.plugin.removePairedDevice(sel);
            refreshDeviceDropdown();
            new obsidian.Notice(`Removed device "${sel}".`);
            if (this.onDisplayTab) this.onDisplayTab();
        };

        new obsidian.Setting(mainContainer)
            .setName('Scan & Pair New Device')
            .setDesc('Scan for nearby BLE devices and save one to the local registry.')
            .addButton(btn => btn
                .setButtonText('Scan Now')
                .onClick(async () => {
                    btn.setButtonText('Scanning...');
                    btn.disabled = true;

                    const child_process = require('child_process');
                    const path = require('path');
                    const fs = require('fs');
                    const vaultPath = this.plugin.app.vault.adapter.getBasePath();
                    const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'omni-logger');
                    const venvPython = require('os').platform() === 'win32'
                        ? path.join(pluginDir, '.venv', 'Scripts', 'python.exe')
                        : path.join(pluginDir, '.venv', 'bin', 'python');
                    const pythonCmd = fs.existsSync(venvPython) ? `"${venvPython}"` : 'python';
                    const scriptPath = path.join(pluginDir, 'ble_scan.py');

                    child_process.exec(`${pythonCmd} "${scriptPath}"`, (err, stdout, stderr) => {
                        btn.setButtonText('Scan Now');
                        btn.disabled = false;
                        if (err) { new obsidian.Notice('Scan failed: ' + (stderr || err.message)); return; }
                        let foundDevices;
                        try { foundDevices = JSON.parse(stdout.trim()); } catch (e) { new obsidian.Notice('Failed to parse scan output.'); return; }
                        if (foundDevices.error) { new obsidian.Notice('Scan failed: ' + foundDevices.error); return; }
                        if (!foundDevices.length) { new obsidian.Notice('No BLE devices found nearby.'); return; }

                        // ── Pair modal ──────────────────────────────────────
                        const modal = new obsidian.Modal(this.plugin.app);
                        modal.titleEl.setText('Pair BLE Device');
                        const { contentEl } = modal;
                        contentEl.style.padding = '16px';

                        contentEl.createEl('p', { text: 'Select the discovered device to pair:', style: 'margin-bottom:8px; font-weight:600;' });
                        const devSelect = contentEl.createEl('select', { style: 'width:100%; margin-bottom:12px;' });
                        foundDevices.forEach(d => devSelect.createEl('option', { value: d.address, text: `${d.name || 'Unknown'}  (${d.address})` }));

                        contentEl.createEl('p', { text: 'Friendly Display Name:', style: 'margin-bottom:6px; font-weight:600;' });
                        const nameInput = contentEl.createEl('input', { type: 'text', style: 'width:100%; margin-bottom:12px;' });
                        nameInput.value = 'Smart Ring';

                        const advToggle = contentEl.createEl('details', { style: 'margin-bottom:12px;' });
                        advToggle.createEl('summary', { text: 'Advanced: secure challenge-response GATT handshake (optional)', style: 'cursor:pointer; font-size:0.9em;' });
                        const advBody = advToggle.createDiv({ style: 'padding:8px 0;' });
                        const loraxCheck = advBody.createEl('input', { type: 'checkbox' });
                        advBody.createSpan({ text: ' Use secure challenge-response handshake', style: 'margin-left:6px;' });
                        advBody.createEl('br');

                        advBody.createEl('label', { text: 'Command UUID:', style: 'font-size:0.85em;' });
                        const cmdUuidInput = advBody.createEl('input', { type: 'text', style: 'width:100%; margin-bottom:6px; font-size:0.85em;' });
                        advBody.createEl('label', { text: 'Response UUID:', style: 'font-size:0.85em;' });
                        const respUuidInput = advBody.createEl('input', { type: 'text', style: 'width:100%; margin-bottom:6px; font-size:0.85em;' });
                        advBody.createEl('label', { text: 'Handshake Key (Base64):', style: 'font-size:0.85em;' });
                        const keyInput = advBody.createEl('input', { type: 'password', style: 'width:100%; font-size:0.85em;' });

                        const pairBtn = contentEl.createEl('button', { text: 'Save to Paired Devices', cls: 'mod-cta', style: 'margin-top:12px; width:100%;' });
                        pairBtn.onclick = () => {
                            const friendlyName = nameInput.value.trim();
                            if (!friendlyName) { new obsidian.Notice('Please enter a friendly name.'); return; }
                            const deviceObj = {
                                name: friendlyName,
                                address: devSelect.value,
                                useLoraxHandshake: loraxCheck.checked,
                                commandUuid: cmdUuidInput.value.trim(),
                                responseUuid: respUuidInput.value.trim(),
                                handshakeKeyBase64: keyInput.value.trim()
                            };
                            this.plugin.savePairedDevice(deviceObj);
                            refreshDeviceDropdown();
                            new obsidian.Notice(`Device "${friendlyName}" paired and saved!`);
                            if (this.onDisplayTab) this.onDisplayTab();
                            modal.close();
                        };
                        modal.open();
                    });
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}

