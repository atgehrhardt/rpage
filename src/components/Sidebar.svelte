<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  
  export let activeView = 'automations';
  export let visible = true;
  
  let isExpanded = true;
  let isMobile = false;
  const dispatch = createEventDispatcher();
  
  function toggleSidebar() {
    if (!isMobile) {
      isExpanded = !isExpanded;
    }
  }
  
  function navigateTo(route: string) {
    dispatch('navigate', route);
    if (isMobile) {
      closeMobileSidebar();
    }
  }
  
  function closeMobileSidebar() {
    dispatch('closeSidebar');
  }
  
  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth <= 768;
      isExpanded = !isMobile;
    };
    
    // Initial check
    checkMobile();
    
    // Listen for resize events
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });
</script>

<div class="sidebar-backdrop" class:visible={isMobile && visible} on:click={closeMobileSidebar}></div>

<aside class={`sidebar ${isExpanded ? 'expanded' : 'collapsed'} ${isMobile ? 'mobile' : ''}`} class:visible>
  <div class="sidebar-header">
    {#if isMobile}
      <button class="close-btn" on:click={closeMobileSidebar}>
        <span class="material-icons">close</span>
      </button>
    {:else}
      <button class="toggle-btn" on:click={toggleSidebar}>
        <span class="material-icons">{isExpanded ? 'chevron_left' : 'chevron_right'}</span>
      </button>
    {/if}
  </div>
  
  <nav class="sidebar-nav">
    <ul>
      <li class={activeView === 'automations' ? 'active' : ''}>
        <button on:click={() => navigateTo('automations')}>
          <span class="material-icons">smart_toy</span>
          {#if isExpanded || isMobile}<span>Automations</span>{/if}
        </button>
      </li>
      <li class={activeView === 'logs' ? 'active' : ''}>
        <button on:click={() => navigateTo('logs')}>
          <span class="material-icons">receipt_long</span>
          {#if isExpanded || isMobile}<span>Logs</span>{/if}
        </button>
      </li>
      <li class={activeView === 'outputs' ? 'active' : ''}>
        <button on:click={() => navigateTo('outputs')}>
          <span class="material-icons">image</span>
          {#if isExpanded || isMobile}<span>Outputs</span>{/if}
        </button>
      </li>
      <li class={activeView === 'settings' ? 'active' : ''}>
        <button on:click={() => navigateTo('settings')}>
          <span class="material-icons">settings</span>
          {#if isExpanded || isMobile}<span>Settings</span>{/if}
        </button>
      </li>
    </ul>
  </nav>
</aside>

<style>
  .sidebar-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 5;
    display: none;
  }
  
  .sidebar-backdrop.visible {
    display: block;
  }
  
  .sidebar {
    background-color: var(--surface);
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 10;
    height: auto;
    min-height: calc(100vh - 63px); /* Subtract header height */
  }
  
  .expanded {
    width: 240px;
  }
  
  .collapsed {
    width: 60px;
  }
  
  .sidebar.mobile {
    position: fixed;
    top: 0;
    left: -280px;
    height: 100%;
    width: 280px;
    box-shadow: 2px 0 10px rgba(0, 0, 0, 0.3);
    transition: left 0.3s ease;
  }
  
  .sidebar.mobile.visible {
    left: 0;
  }
  
  .sidebar-header {
    padding: 1rem;
    display: flex;
    justify-content: flex-end;
  }
  
  .collapsed .sidebar-header {
    justify-content: center;
  }
  
  .toggle-btn, .close-btn {
    background: transparent;
    border: none;
    color: var(--on-surface);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .toggle-btn:hover, .close-btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .sidebar-nav {
    flex: 1;
    overflow-y: visible;
  }
  
  .sidebar-nav ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .sidebar-nav li {
    margin-bottom: 0.5rem;
  }
  
  .sidebar-nav button {
    width: calc(100% - 1rem);
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    color: var(--on-surface);
    cursor: pointer;
    gap: 1rem;
    text-align: left;
    border-radius: 4px;
    margin: 0 0.5rem;
  }
  
  .collapsed .sidebar-nav button {
    justify-content: center;
  }
  
  .sidebar-nav button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .sidebar-nav li.active button {
    background-color: var(--primary);
    color: var(--on-primary);
  }
  
  /* Mobile specific adjustments */
  .sidebar.mobile .sidebar-nav button {
    padding: 1rem 1.5rem;
    font-size: 1.1rem;
  }
  
  .sidebar.mobile .sidebar-header {
    padding: 1rem;
    display: flex;
    justify-content: flex-end;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  /* Hide sidebar on small screens by default */
  @media (max-width: 768px) {
    .sidebar:not(.mobile) {
      display: none;
    }
  }
</style>