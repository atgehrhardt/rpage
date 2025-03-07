<script lang="ts">
  import { onMount } from 'svelte';
  import Header from './components/Header.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import AutomationList from './components/AutomationList.svelte';
  import AutomationEditor from './components/AutomationEditor.svelte';
  import LogsView from './components/LogsView.svelte';
  import OutputsView from './components/OutputsView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import { automations, selectedAutomation } from './stores/automationStore';
  import { runAutomationById, fetchAPI } from './utils/api';
  import { loadSettings } from './utils/storage';
  
  // State
  let isEditing = false;
  let currentView = 'automations'; // 'automations', 'logs', 'settings'
  let sidebarVisible = false;
  
  // Try to apply theme immediately from localStorage before component mount
  // This runs before onMount to prevent flash of wrong theme
  function applyInitialTheme() {
    try {
      // Try to get theme from localStorage first for immediate styling
      const savedSettings = localStorage.getItem('rpage-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings && settings.darkTheme !== undefined) {
          if (settings.darkTheme) {
            document.documentElement.classList.add('dark-mode');
            document.body.classList.add('dark-mode');
          } else {
            document.documentElement.classList.remove('dark-mode');
            document.body.classList.remove('dark-mode');
          }
          console.log('[App] Applied theme from localStorage', settings.darkTheme ? 'dark' : 'light');
          return;
        }
      }
      
      // If no localStorage theme, default to dark mode
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
    } catch (error) {
      console.error('[App] Error applying initial theme, defaulting to dark:', error);
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
    }
  }
  
  // Apply theme immediately on script execution
  applyInitialTheme();
  
  // Load settings and initialize theme on mount
  onMount(async () => {
    console.log('[App] Component mounting...');
    try {
      // Log API endpoint we're trying to access for debugging
      console.log('[App] Will try to load settings from API');
      
      try {
        console.log('[App] Loading settings...');
        const settings = await loadSettings();
        console.log('[App] Settings loaded:', settings);
        
        // Apply theme from settings (should match localStorage, but just to be sure)
        if (settings.darkTheme) {
          document.documentElement.classList.add('dark-mode');
          document.body.classList.add('dark-mode');
        } else {
          document.documentElement.classList.remove('dark-mode');
          document.body.classList.remove('dark-mode');
        }
      } catch (settingsError) {
        console.error('[App] Error loading settings, using defaults:', settingsError);
        // Continue with default settings - app can still function
      }
      
      // Initialize store data
      console.log('[App] Initializing stores...');
      
      try {
        // Verify automations store
        const unsubscribeAutomations = automations.subscribe(items => {
          console.log(`[App] Automations store contains ${items.length} items`);
        });
        unsubscribeAutomations();
      } catch (storeError) {
        console.error('[App] Error initializing automations store:', storeError);
        // App can potentially still function with store errors
      }
      
      // Check if we're on mobile
      const checkMobile = () => {
        sidebarVisible = window.innerWidth > 768;
      };
      
      // Initial check
      checkMobile();
      
      // Listen for resize events
      window.addEventListener('resize', checkMobile);
      
      console.log('[App] Initialization complete!');
      
      return () => {
        window.removeEventListener('resize', checkMobile);
      };
    } catch (error) {
      console.error('[App] Error during initialization:', error);
      alert('An error occurred during app initialization. Check console for details.');
    }
  });

  function handleAddAutomation() {
    selectedAutomation.set({
      id: crypto.randomUUID(),
      name: 'New Automation',
      description: '',
      script: '',
      status: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    isEditing = true;
  }
  
  function handleEditAutomation() {
    isEditing = true;
  }
  
  function handleCancelEdit() {
    isEditing = false;
  }
  
  async function handleSaveAutomation(event: CustomEvent) {
    const automation = event.detail;
    const updatedAutomation = { ...automation, updatedAt: new Date().toISOString() };
    
    // Update the store which will trigger the saveAutomations function
    automations.update(items => {
      const index = items.findIndex(item => item.id === automation.id);
      if (index >= 0) {
        // Update existing automation
        items[index] = updatedAutomation;
        return [...items];
      } else {
        // Add new automation
        return [...items, updatedAutomation];
      }
    });
    
    isEditing = false;
  }
  
  function handleRunAutomation(event: CustomEvent) {
    const automationId = event.detail;
    runAutomationById(automationId);
  }
  
  async function handleDeleteAutomation(event: CustomEvent) {
    const automationId = event.detail;
    
    try {
      // First delete from the API/database
      await fetchAPI(`/automations/${automationId}`, {
        method: 'DELETE'
      });
      
      // Then update the store to reflect the change
      automations.update(items => items.filter(item => item.id !== automationId));
    } catch (error) {
      console.error(`Error deleting automation ${automationId}:`, error);
      // Still delete from the store even if API fails
      automations.update(items => items.filter(item => item.id !== automationId));
    }
  }
  
  function handleNavigate(event: CustomEvent) {
    currentView = event.detail;
    isEditing = false;
  }
  
  function handleSaveSettings(event: CustomEvent) {
    // In a real app, we would save these settings
    const settings = event.detail;
    console.log('Saving settings:', settings);
    
    // Show a notification to demonstrate functionality
    if (settings.notificationsEnabled) {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('Settings Saved', {
            body: 'Your preferences have been updated.',
            icon: '/logo.svg'
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission();
        }
      }
    }
  }
  
  function handleToggleSidebar(event: CustomEvent) {
    sidebarVisible = event.detail;
  }
  
  function handleCloseSidebar() {
    sidebarVisible = false;
  }
  
  async function handleRefresh(event: CustomEvent) {
    console.log('Refresh event received:', event.detail);
    
    // If the refresh is for automations, refresh the automations store
    if (event.detail.type === 'automations') {
      try {
        // Force a refresh of the automations data
        const response = await fetchAPI('/automations?nocache=' + Date.now());
        if (response.success && Array.isArray(response.data)) {
          // Update the store with fresh data
          automations.set(response.data);
          console.log(`Refreshed automations store with ${response.data.length} items`);
          
          // If we're in the automations view, navigate there again to trigger a refresh
          if (currentView === 'automations') {
            // Force a re-render by switching views briefly
            const originalView = currentView;
            currentView = 'settings';
            setTimeout(() => {
              currentView = originalView;
            }, 10);
          }
        }
      } catch (error) {
        console.error('Error refreshing automations:', error);
      }
    }
  }
</script>

<main class="app">
  <Header 
    on:navigate={handleNavigate} 
    on:toggleSidebar={handleToggleSidebar}
    sidebarVisible={sidebarVisible}
  />
  <div class="app-container">
    <Sidebar 
      on:navigate={handleNavigate} 
      on:closeSidebar={handleCloseSidebar}
      activeView={currentView}
      visible={sidebarVisible}
    />
    <div class="content">
      {#key currentView}
        {#if currentView === 'automations'}
          {#if isEditing}
            <AutomationEditor 
              on:save={handleSaveAutomation} 
              on:cancel={handleCancelEdit} 
            />
          {:else}
            <AutomationList 
              on:add={handleAddAutomation}
              on:edit={handleEditAutomation}
              on:run={handleRunAutomation}
              on:delete={handleDeleteAutomation}
            />
          {/if}
        {:else if currentView === 'logs'}
          <LogsView />
        {:else if currentView === 'outputs'}
          <OutputsView />
        {:else if currentView === 'settings'}
          <SettingsView on:save={handleSaveSettings} on:refresh={handleRefresh} />
        {/if}
      {/key}
    </div>
  </div>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background-color: var(--background);
    color: var(--on-background);
  }
  
  :global(body) {
    /* Light mode theme (default) */
    --primary: #6200ee;
    --primary-variant: #3700b3;
    --secondary: #03dac6;
    --background: #f5f5f5;
    --surface: #ffffff;
    --error: #b00020;
    --on-primary: #ffffff;
    --on-secondary: #000000;
    --on-background: #121212;
    --on-surface: #121212;
    --on-error: #ffffff;
  }
  
  :global(body.dark-mode) {
    /* Dark mode theme */
    --primary: #6200ee;
    --primary-variant: #3700b3;
    --secondary: #03dac6;
    --background: #121212;
    --surface: #1e1e1e;
    --error: #cf6679;
    --on-primary: #ffffff;
    --on-secondary: #000000;
    --on-background: #e1e1e1;
    --on-surface: #e1e1e1;
    --on-error: #000000;
  }
  
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  
  .app-container {
    display: flex;
    flex: 1;
  }
  
  .content {
    flex: 1;
    padding: 20px;
  }
  
  /* Responsive layout */
  @media (max-width: 768px) {
    .app-container {
      flex-direction: column;
    }
  }
</style>