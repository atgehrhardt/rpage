<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let sidebarVisible = false;
  let isMobile = false;
  
  function navigateToSettings() {
    dispatch('navigate', 'settings');
  }
  
  function navigateToAutomations() {
    dispatch('navigate', 'automations');
  }
  
  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    dispatch('toggleSidebar', sidebarVisible);
  }
  
  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth <= 768;
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

<header>
  {#if isMobile}
    <button class="menu-toggle" on:click={toggleSidebar}>
      <span class="material-icons">menu</span>
    </button>
  {/if}
  
  <div class="logo-container" on:click={navigateToAutomations}>
    <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="logo">
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#6200ee;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#03dac6;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="80" height="80" rx="20" fill="url(#logo-gradient)" />
      <circle cx="65" cy="35" r="10" fill="#ffffff" />
      <path d="M30,40 L70,40 L70,70 L30,70 Z" fill="none" stroke="#ffffff" stroke-width="5" />
      <path d="M40,55 L60,55" stroke="#ffffff" stroke-width="5" stroke-linecap="round" />
      <path d="M40,62 L50,62" stroke="#ffffff" stroke-width="5" stroke-linecap="round" />
    </svg>
    <h1>Rpage</h1>
  </div>
  
  <div class="header-right">
    <button class="btn-icon" on:click={navigateToSettings}>
      <span class="material-icons">settings</span>
    </button>
  </div>
</header>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background-color: var(--surface);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    z-index: 10;
  }
  
  .logo-container {
    display: flex;
    align-items: center;
    gap: 1rem;
    cursor: pointer;
  }
  
  .logo {
    height: 2.5rem;
    width: auto;
  }
  
  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--on-surface);
  }
  
  .header-right {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-icon, .menu-toggle {
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
  
  .btn-icon:hover, .menu-toggle:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .menu-toggle {
    margin-right: 0.5rem;
  }
  
  /* Mobile styles */
  @media (max-width: 768px) {
    .logo-container {
      margin: 0 auto;
    }
  }
</style>