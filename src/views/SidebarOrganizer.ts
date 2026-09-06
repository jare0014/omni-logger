import { App } from "obsidian";
import * as fs from "fs";
import * as path from "path";

export function organizeCustomPluginsSidebar(app: App): void {
    const vaultPath = (app.vault.adapter as any).getBasePath ? (app.vault.adapter as any).getBasePath() : "";
    const sep = vaultPath.includes('/') ? '/' : '\\';
    const logPath = `${vaultPath}${sep}.obsidian${sep}plugins${sep}omni-logger${sep}debug_display.log`;
    
    const log = (msg: string) => {
        try { fs.appendFileSync(logPath, `[${new Date().toISOString()}] [Sidebar] ${msg}\n`); } catch(e) {}
    };
    
    log("Sidebar organize start");
    const settingModal = document.querySelector('.modal.mod-settings');
    if (!settingModal) {
        log("settingModal missing");
        return;
    }
    
    const sidebar = settingModal.querySelector('.vertical-tab-header');
    if (!sidebar) {
        log("sidebar missing");
        return;
    }
    
    const communitySection = sidebar.querySelector('.vertical-tab-header-group-items[data-section="community-plugins"]');
    if (!communitySection) {
        log("communitySection missing");
        return;
    }
    
    let folderContainer = communitySection.querySelector('.custom-plugins-folder-container');
    if (folderContainer) {
        log("folderContainer already exists");
        return;
    }
    
    const targetPluginIds = [
        'always-on-memory-agent',
        'schedule-assistant-focus-timer',
        'omni-logger',
        'google-keep-sync',
        'grind-manager',
        'knowledge-pipeline',
        'git-logger'
    ];
    
    const targetElements: HTMLElement[] = [];
    const navItems = communitySection.querySelectorAll('.vertical-tab-nav-item');
    log("Found navItems count: " + navItems.length);
    navItems.forEach(item => {
        const id = item.getAttribute('data-setting-id');
        if (id && targetPluginIds.includes(id)) {
            targetElements.push(item as HTMLElement);
        }
    });
    
    log("Target elements found: " + targetElements.length);
    if (targetElements.length === 0) return;
    
    const folderHeader = document.createElement('div');
    folderHeader.className = 'vertical-tab-nav-item custom-plugins-folder-header';
    folderHeader.style.fontWeight = '600';
    folderHeader.style.cursor = 'pointer';
    folderHeader.style.display = 'flex';
    folderHeader.style.alignItems = 'center';
    folderHeader.style.justifyContent = 'space-between';
    folderHeader.style.padding = '8px 12px';
    folderHeader.style.marginTop = '8px';
    folderHeader.style.borderTop = '1px solid var(--background-modifier-border)';
    
    const headerTitle = document.createElement('span');
    headerTitle.textContent = '📦 Custom Plugins';
    folderHeader.appendChild(headerTitle);
    
    const chevron = document.createElement('span');
    chevron.textContent = '▼';
    chevron.style.fontSize = '0.75rem';
    chevron.style.transition = 'transform 0.2s ease';
    folderHeader.appendChild(chevron);
    
    const newFolderContainer = document.createElement('div');
    newFolderContainer.className = 'custom-plugins-folder-container';
    newFolderContainer.style.transition = 'max-height 0.25s ease-out, opacity 0.2s ease';
    newFolderContainer.style.overflow = 'hidden';
    
    let isCollapsed = localStorage.getItem('custom-plugins-settings-collapsed') === 'true';
    if (isCollapsed) {
        newFolderContainer.style.maxHeight = '0px';
        newFolderContainer.style.opacity = '0';
        chevron.style.transform = 'rotate(-90deg)';
    } else {
        newFolderContainer.style.maxHeight = '500px';
        newFolderContainer.style.opacity = '1';
    }
    
    folderHeader.onclick = (e) => {
        e.stopPropagation();
        isCollapsed = !isCollapsed;
        localStorage.setItem('custom-plugins-settings-collapsed', String(isCollapsed));
        if (isCollapsed) {
            newFolderContainer.style.maxHeight = '0px';
            newFolderContainer.style.opacity = '0';
            chevron.style.transform = 'rotate(-90deg)';
        } else {
            newFolderContainer.style.maxHeight = '500px';
            newFolderContainer.style.opacity = '1';
            chevron.style.transform = 'rotate(0deg)';
        }
    };
    
    const firstTarget = targetElements[0];
    log("Inserting folderHeader and folderContainer before: " + firstTarget.getAttribute('data-setting-id'));
    try {
        communitySection.insertBefore(folderHeader, firstTarget);
        communitySection.insertBefore(newFolderContainer, firstTarget);
        log("Header and container inserted successfully");
    } catch(e: any) {
        log("Error inserting header/container: " + e.message);
    }
    
    targetElements.forEach(item => {
        log("Moving nav item: " + item.getAttribute('data-setting-id'));
        item.style.paddingLeft = '24px';
        item.classList.add('custom-plugin-sub-item');
        try {
            newFolderContainer.appendChild(item);
            log("Moved " + item.getAttribute('data-setting-id'));
        } catch(e: any) {
            log("Error moving " + item.getAttribute('data-setting-id') + ": " + e.message);
        }
    });
    log("Sidebar organize end");
}

export function hookSettingsSidebar(app: App, plugin: any): void {
    const setting = (app as any).setting;
    if (setting && setting.open) {
        if (!setting.open.__antigravityHooked) {
            const originalOpen = setting.open;
            setting.open = function() {
                const result = originalOpen.apply(this, arguments);
                setTimeout(() => {
                    const activeOmni = (app as any).plugins.getPlugin('omni-logger');
                    if (activeOmni && typeof activeOmni.organizeCustomPluginsSidebar === 'function') {
                        activeOmni.organizeCustomPluginsSidebar();
                    }
                    const activeTimer = (app as any).plugins.getPlugin('schedule-assistant-focus-timer');
                    if (activeTimer && typeof activeTimer.organizeCustomPluginsSidebar === 'function') {
                        activeTimer.organizeCustomPluginsSidebar();
                    }
                }, 50);
                return result;
            };
            setting.open.__antigravityHooked = true;
            setting.open.__originalOpen = originalOpen;
        }
    }
}
