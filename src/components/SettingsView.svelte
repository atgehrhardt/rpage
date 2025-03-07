<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { loadSettings, saveSettings, loadAutomations } from '../utils/storage';
  import { showToast, showBrowserNotification } from '../utils/notificationUtils';
  import type { Automation } from '../types';
  import { fetchAPI } from '../utils/api';
  import type { LogEntry } from '../stores/logsStore';
  
  const dispatch = createEventDispatcher();
  
  // Settings options with defaults
  let notificationsEnabled = true;
  let darkTheme = true;
  let keepOutputDays = 7;
  
  // Modals
  let showingExportModal = false;
  let showingImportModal = false;
  let dragActive = false;
  
  // Automations
  let automations: Automation[] = [];
  let selectedAutomations: Record<string, boolean> = {};
  
  // Load settings on mount
  onMount(async () => {
    const settings = await loadSettings();
    notificationsEnabled = settings.notificationsEnabled;
    darkTheme = settings.darkTheme;
    keepOutputDays = settings.keepOutputDays;
    
    // Apply dark mode setting on load
    applyDarkMode(darkTheme);
    
    // Load automations
    loadAutomationsList();
  });
  
  // Load automations
  async function loadAutomationsList(forceRefresh = false) {
    console.log('Loading automations list', forceRefresh ? '(forced refresh)' : '');
    
    // Clear API cache for automations if force refresh is requested
    if (forceRefresh) {
      try {
        // Force API to bypass cache
        const response = await fetch('/api/automations?nocache=' + Date.now());
        const data = await response.json();
        
        if (data.success && Array.isArray(data.data)) {
          automations = data.data;
        } else {
          // Fallback to regular loading
          automations = await loadAutomations();
        }
      } catch (error) {
        console.error('Error force-refreshing automations:', error);
        automations = await loadAutomations();
      }
    } else {
      // Regular loading
      automations = await loadAutomations();
    }
    
    // Initialize selection state
    selectedAutomations = {};
    automations.forEach(automation => {
      selectedAutomations[automation.id] = true;
    });
  }
  
  // Apply dark mode
  function applyDarkMode(enabled) {
    if (enabled) {
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.body.classList.remove('dark-mode');
    }
  }
  
  // Handle dark theme toggle
  function handleDarkThemeChange() {
    applyDarkMode(darkTheme);
    
    // Also update localStorage immediately for instant persistence
    try {
      const currentSettings = localStorage.getItem('rpage-settings');
      const settings = currentSettings ? JSON.parse(currentSettings) : {
        notificationsEnabled: notificationsEnabled,
        keepOutputDays: keepOutputDays
      };
      
      // Update the dark theme setting
      settings.darkTheme = darkTheme;
      
      // Save back to localStorage
      localStorage.setItem('rpage-settings', JSON.stringify(settings));
      console.log('Immediately saved theme to localStorage:', darkTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme to localStorage:', error);
    }
    
    // Then save to server
    saveSettingsHandler();
  }
  
  // Handle notification toggle
  function handleNotificationsChange() {
    saveSettingsHandler();
  }
  
  // Handle output days change
  function handleOutputDaysChange() {
    saveSettingsHandler();
  }
  
  function saveSettingsHandler() {
    const settings = {
      notificationsEnabled,
      darkTheme,
      keepOutputDays
    };
    
    // Save to file
    saveSettings(settings);
    
    // Show browser notification if enabled
    if (notificationsEnabled) {
      showBrowserNotification('Settings Saved', {
        body: 'Your settings have been updated.',
        icon: '/logo.svg'
      });
    }
    
    // Always show in-app notification
    showToast('Settings updated', 'success');
    
    // Notify parent component
    dispatch('save', settings);
  }
  
  // Export/Import functions
  async function showExportModal() {
    // Always fetch fresh automations from the database
    await loadAutomationsList(true);
    showingExportModal = true;
  }
  
  function showImportModal() {
    showingImportModal = true;
  }
  
  async function exportLogs() {
    try {
      showToast('Fetching logs...', 'info');
      
      // Fetch all logs from the server - force cache bypass to get fresh logs
      const timestamp = Date.now();
      
      // Direct fetch to bypass any caching
      const response = await fetch(`/api/logs?limit=1000&nocache=${timestamp}`);
      
      // Parse response
      const data = await response.json();
      let logs: LogEntry[] = [];
      
      if (data?.success && Array.isArray(data.data)) {
        logs = data.data;
      } else if (data && Array.isArray(data)) {
        logs = data;
      } else {
        // Fallback to direct endpoint
        const directResponse = await fetch(`/api/logs-direct?limit=1000&nocache=${timestamp}`);
        const directData = await directResponse.json();
        if (Array.isArray(directData)) {
          logs = directData;
        }
      }
      
      if (logs.length === 0) {
        showToast('No logs to export', 'info');
        return;
      }
      
      // Format logs into a readable text format
      let logText = `# Rpage Automation Logs\n`;
      logText += `# Exported: ${new Date().toISOString()}\n`;
      logText += `# Total Logs: ${logs.length}\n\n`;
      
      logs.forEach((log, index) => {
        logText += `========== LOG #${index + 1} ==========\n`;
        logText += `Automation: ${log.automationName}\n`;
        logText += `Status: ${log.status}\n`;
        logText += `Time: ${new Date(log.timestamp).toLocaleString()}\n`;
        logText += `ID: ${log.automationId}\n`;
        logText += `\n----- OUTPUT -----\n\n`;
        logText += `${log.output || '[No output]'}\n\n`;
        logText += `==========================\n\n`;
      });
      
      // Create and download the file
      const blob = new Blob([logText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `rpage-logs-${new Date().toISOString().split('T')[0]}.log`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      showToast(`Exported ${logs.length} logs`, 'success');
    } catch (error) {
      console.error('Error exporting logs:', error);
      showToast('Failed to export logs', 'error');
    }
  }
  
  function closeModals() {
    showingExportModal = false;
    showingImportModal = false;
    dragActive = false;
  }
  
  function toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    Object.keys(selectedAutomations).forEach(id => {
      selectedAutomations[id] = checked;
    });
    selectedAutomations = { ...selectedAutomations };
  }
  
  function exportAutomations() {
    // Get selected automations
    const automationsToExport = automations.filter(auto => selectedAutomations[auto.id]);
    
    if (automationsToExport.length === 0) {
      showToast('Please select at least one automation to export', 'error');
      return;
    }
    
    // Create clean version of automations without internal IDs or status
    const cleanAutomations = automationsToExport.map(auto => {
      // Create a new object with only the fields we want to export
      const { id, status, createdAt, updatedAt, ...exportableData } = auto;
      return exportableData;
    });
    
    // Create export file
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      automations: cleanAutomations
    };
    
    // Convert to JSON and download
    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `rpage-automations-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    showToast(`Exported ${automationsToExport.length} automations`, 'success');
    closeModals();
  }
  
  // Import file handlers
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragActive = true;
  }
  
  function handleDragLeave() {
    dragActive = false;
  }
  
  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragActive = false;
    
    if (event.dataTransfer?.files) {
      handleFiles(event.dataTransfer.files);
    }
  }
  
  function handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      handleFiles(input.files);
    }
  }
  
  function handleFiles(files: FileList) {
    if (files.length === 0) return;
    
    const file = files[0];
    
    // Check file is JSON
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      showToast('Please select a JSON file', 'error');
      return;
    }
    
    // Read file
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const importData = JSON.parse(content);
        
        // Validate import data
        if (!importData.automations || !Array.isArray(importData.automations)) {
          throw new Error('Invalid import file format');
        }
        
        // Import each automation
        const importedCount = await importAutomations(importData.automations);
        
        showToast(`Imported ${importedCount} automations`, 'success');
        closeModals();
        
        // Notify parent to refresh - send a detailed refresh event
        dispatch('refresh', { 
          type: 'automations',
          count: importedCount,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Import error:', error);
        showToast(`Import failed: ${error.message}`, 'error');
      }
    };
    
    reader.readAsText(file);
  }
  
  async function importAutomations(automationsToImport: Automation[]): Promise<number> {
    let importedCount = 0;
    
    // Get existing automation IDs to ensure we don't have conflicts
    const existingAutomations = await loadAutomations();
    const existingIds = new Set(existingAutomations.map(auto => auto.id));
    
    // Import each automation
    for (const automation of automationsToImport) {
      try {
        // Generate a guaranteed unique ID
        let uniqueId: string;
        do {
          // Create a unique ID using current timestamp and random string
          uniqueId = `import-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        } while (existingIds.has(uniqueId));
        
        // Add ID to our set to prevent duplicates in the same batch
        existingIds.add(uniqueId);
        
        // Create new automation with all required fields
        const newAutomation = { 
          ...automation,
          id: uniqueId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'idle'
        };
        
        // Save to API
        const response = await fetchAPI('/automations', {
          method: 'POST',
          body: JSON.stringify(newAutomation)
        });
        
        if (response.success) {
          importedCount++;
        } else {
          console.error('Error response from API:', response);
        }
      } catch (error) {
        console.error('Error importing automation:', error);
      }
    }
    
    return importedCount;
  }
</script>

<div class="settings-view">
  <div class="settings-header">
    <h2>Settings</h2>
  </div>
  
  <div class="settings-container">
    <div class="settings-section">
      <h3>Appearance</h3>
      <div class="setting-item">
        <div class="setting-label">
          <span>Dark Theme</span>
          <p class="setting-description">Use dark color scheme</p>
        </div>
        <label class="toggle">
          <input type="checkbox" bind:checked={darkTheme} on:change={handleDarkThemeChange}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
    
    <div class="settings-section">
      <h3>Notifications</h3>
      <div class="setting-item">
        <div class="setting-label">
          <span>Browser Notifications</span>
          <p class="setting-description">Show desktop notifications when automations complete</p>
        </div>
        <label class="toggle">
          <input type="checkbox" bind:checked={notificationsEnabled} on:change={handleNotificationsChange}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
    
    <div class="settings-section">
      <h3>Data Management</h3>
      <div class="setting-item">
        <div class="setting-label">
          <span>Keep Output History</span>
          <p class="setting-description">Number of days to keep automation outputs</p>
        </div>
        <div class="number-input">
          <input type="number" min="1" max="30" bind:value={keepOutputDays} on:change={handleOutputDaysChange}>
          <span>days</span>
        </div>
      </div>
      
      <div class="setting-item export-import-buttons">
        <div class="setting-label">
          <span>Automations Management</span>
          <p class="setting-description">Export or import your automations</p>
        </div>
        <div class="button-group">
          <button class="btn-secondary" on:click={showExportModal}>
            <span class="material-icons">file_download</span>
            Export
          </button>
          <button class="btn-secondary" on:click={showImportModal}>
            <span class="material-icons">file_upload</span>
            Import
          </button>
        </div>
      </div>
      
      <div class="setting-item">
        <div class="setting-label">
          <span>Logs Management</span>
          <p class="setting-description">Export your automation logs</p>
        </div>
        <div class="button-group">
          <button class="btn-secondary" on:click={exportLogs}>
            <span class="material-icons">file_download</span>
            Export Logs
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

{#if showingExportModal}
  <div class="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <h3>Export Automations</h3>
        <button class="modal-close" on:click={closeModals}>
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">
        <p>Select the automations you want to export:</p>
        
        <div class="select-all">
          <label>
            <input type="checkbox" on:change={toggleSelectAll} checked={Object.values(selectedAutomations).every(v => v)}>
            Select all
          </label>
        </div>
        
        <div class="checkbox-list">
          {#each automations as automation}
            <div class="checkbox-item">
              <label>
                <input type="checkbox" bind:checked={selectedAutomations[automation.id]}>
                <span>{automation.name}</span>
              </label>
            </div>
          {/each}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModals}>Cancel</button>
        <button class="btn-primary" on:click={exportAutomations}>Export</button>
      </div>
    </div>
  </div>
{/if}

{#if showingImportModal}
  <div class="modal-backdrop">
    <div class="modal">
      <div class="modal-header">
        <h3>Import Automations</h3>
        <button class="modal-close" on:click={closeModals}>
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">
        <p>Upload a JSON file containing automations to import.</p>
        
        <div 
          class="dropzone"
          class:drag-active={dragActive}
          on:dragover={handleDragOver}
          on:dragleave={handleDragLeave}
          on:drop={handleDrop}
          on:click={() => document.getElementById('file-input').click()}
        >
          <span class="material-icons">file_upload</span>
          <div class="dropzone-text">Drag and drop a file here</div>
          <div class="dropzone-subtext">or click to select a file</div>
          <input 
            type="file" 
            id="file-input" 
            accept=".json,application/json" 
            style="display:none" 
            on:change={handleFileInput}
          />
        </div>
        
        <p class="help-text">
          <span class="material-icons" style="font-size: 1rem; vertical-align: middle;">info</span>
          The imported automations will be added to your existing automations.
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" on:click={closeModals}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .settings-view {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
  }
  
  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  h2 {
    margin: 0;
    color: var(--on-background);
  }
  
  .btn-primary {
    background-color: var(--primary);
    color: var(--on-primary);
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .btn-primary:hover {
    background-color: var(--primary-variant);
  }
  
  .settings-container {
    background-color: var(--surface);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .settings-section {
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .settings-section:last-child {
    border-bottom: none;
  }
  
  .settings-section h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1.1rem;
    color: var(--on-surface);
  }
  
  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 0;
  }
  
  .setting-item:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  .setting-label {
    flex: 1;
  }
  
  .setting-label span {
    display: block;
    font-weight: 500;
    margin-bottom: 0.25rem;
  }
  
  .setting-description {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
  }
  
  /* Toggle Switch */
  .toggle {
    position: relative;
    display: inline-block;
    width: 50px;
    height: 24px;
  }
  
  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #aaaaaa;
    transition: .3s;
    border-radius: 24px;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
  }
  
  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: .3s;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  input:checked + .toggle-slider {
    background: var(--primary);
  }
  
  input:checked + .toggle-slider:before {
    transform: translateX(26px);
  }
  
  /* Number input */
  .number-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .number-input input {
    width: 50px;
    background-color: var(--input-background);
    border: 1px solid var(--input-border);
    border-radius: 4px;
    padding: 0.5rem;
    color: var(--on-surface);
    font-size: 0.9rem;
    text-align: center;
  }
  
  /* Button group */
  .button-group {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-secondary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: var(--button-background);
    border: 1px solid var(--button-border);
    color: var(--on-surface);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }
  
  .btn-secondary:hover {
    background-color: var(--button-hover);
  }

  .btn-secondary .material-icons {
    font-size: 1.2rem;
  }

  /* Export/Import buttons section */
  .export-import-buttons {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  /* Modal styles */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 100;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .modal {
    background-color: var(--surface);
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .modal-header h3 {
    margin: 0;
  }
  
  .modal-close {
    background: transparent;
    border: none;
    color: var(--on-surface);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
  }
  
  .modal-body {
    padding: 1.5rem;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  /* Checkbox list styles */
  .checkbox-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 1rem 0;
    max-height: 300px;
    overflow-y: auto;
  }
  
  .checkbox-item {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    border-radius: 4px;
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  .checkbox-item:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .checkbox-item label {
    display: flex;
    align-items: center;
    width: 100%;
    cursor: pointer;
  }
  
  .checkbox-item input {
    margin-right: 0.5rem;
  }
  
  /* File dropzone */
  .dropzone {
    border: 2px dashed rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    cursor: pointer;
    margin: 1rem 0;
    transition: all 0.2s;
  }
  
  .dropzone:hover, .dropzone.drag-active {
    border-color: var(--primary);
    background-color: rgba(98, 0, 238, 0.05);
  }
  
  .dropzone .material-icons {
    font-size: 3rem;
    margin-bottom: 1rem;
    color: rgba(255, 255, 255, 0.5);
  }
  
  .dropzone-text {
    margin-bottom: 0.5rem;
  }
  
  .dropzone-subtext {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
  }
  
  /* Select all */
  .select-all {
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
  }
  
  .select-all label {
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  
  .select-all input {
    margin-right: 0.5rem;
  }
  
  /* Help text */
  .help-text {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  /* Primary button styles for modals */
  .btn-primary {
    background-color: var(--primary);
    color: var(--on-primary);
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background-color 0.2s;
  }
  
  .btn-primary:hover {
    background-color: var(--primary-variant);
  }
  
  /* Toast styles are defined globally in global.css */
</style>