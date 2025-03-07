<script>
  import { onMount } from 'svelte';
  import { fetchAPI } from './utils/api';
  
  let apiReady = false;
  let logs = [];
  let outputs = [];
  let automations = [];
  let loading = true;
  
  onMount(async () => {
    console.log("SimpleApp: Mounting and checking server status");
    try {
      // Try to check if API is running
      try {
        const response = await fetchAPI('/automations');
        if (response) {
          apiReady = true;
          automations = response.success && response.data ? response.data : 
                        Array.isArray(response) ? response : [];
          console.log(`SimpleApp: Found ${automations.length} automations`);
        }
      } catch (e) {
        console.error("SimpleApp: Error checking automations:", e);
      }
      
      // Try to check if logs are accessible
      try {
        const response = await fetchAPI('/logs');
        logs = response.success && response.data ? response.data : 
               Array.isArray(response) ? response : [];
        console.log(`SimpleApp: Found ${logs.length} logs`);
      } catch (e) {
        console.error("SimpleApp: Error checking logs:", e);
      }
      
      // Try to check if outputs are accessible
      try {
        const response = await fetchAPI('/outputs');
        outputs = response.success && response.files ? response.files : 
                 Array.isArray(response) ? response : [];
        console.log(`SimpleApp: Found ${outputs.length} outputs`);
      } catch (e) {
        console.error("SimpleApp: Error checking outputs:", e);
      }
    } catch (error) {
      console.error("SimpleApp: Error during initialization:", error);
    } finally {
      loading = false;
    }
  });
</script>

<div class="simple-app">
  <h1>Rpage - Diagnostics Mode</h1>
  
  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Checking system status...</p>
    </div>
  {:else}
    <div class="status-panel">
      <h2>System Status</h2>
      <div class="status-item">
        <span class="label">API Connection:</span>
        <span class="status {apiReady ? 'success' : 'error'}">
          {apiReady ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div class="status-item">
        <span class="label">Automations:</span>
        <span class="status {automations.length > 0 ? 'success' : 'warning'}">
          {automations.length} found
        </span>
      </div>
      
      <div class="status-item">
        <span class="label">Logs:</span>
        <span class="status {logs.length > 0 ? 'success' : 'warning'}">
          {logs.length} found
        </span>
      </div>
      
      <div class="status-item">
        <span class="label">Outputs:</span>
        <span class="status {outputs.length > 0 ? 'success' : 'warning'}">
          {outputs.length} found
        </span>
      </div>
    </div>
    
    <div class="troubleshooting">
      <h2>Troubleshooting</h2>
      <ul>
        <li>Make sure the API server is running: <code>node server.cjs</code></li>
        <li>Check browser console for additional error messages</li>
        <li>Verify that the database file exists in the data directory</li>
        <li>Try restarting the application</li>
      </ul>
    </div>
    
    <div class="actions">
      <button on:click={() => window.location.reload()}>Reload Page</button>
    </div>
  {/if}
</div>

<style>
  .simple-app {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    font-family: system-ui, -apple-system, sans-serif;
    color: #e1e1e1;
    background-color: #1e1e1e;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }
  
  h1 {
    text-align: center;
    margin-bottom: 2rem;
    color: #6200ee;
    font-size: 2rem;
    font-weight: 600;
  }
  
  h2 {
    color: #03dac6;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.5rem;
    margin-top: 2rem;
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    border-left-color: #6200ee;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .status-panel {
    margin-bottom: 2rem;
  }
  
  .status-item {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  .label {
    font-weight: bold;
  }
  
  .status {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
  }
  
  .success {
    background-color: rgba(76, 175, 80, 0.2);
    color: #81c784;
  }
  
  .warning {
    background-color: rgba(255, 152, 0, 0.2);
    color: #ffb74d;
  }
  
  .error {
    background-color: rgba(244, 67, 54, 0.2);
    color: #e57373;
  }
  
  .troubleshooting ul {
    padding-left: 1.5rem;
    line-height: 1.6;
  }
  
  code {
    background-color: rgba(0, 0, 0, 0.3);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
  }
  
  .actions {
    margin-top: 2rem;
    display: flex;
    justify-content: center;
  }
  
  button {
    background-color: #6200ee;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  button:hover {
    background-color: #3700b3;
  }
</style>