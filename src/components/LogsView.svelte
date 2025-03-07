<script lang="ts">
  import { 
    logs, 
    loadInitialLogs, 
    loadMoreLogs, 
    isLoadingLogs, 
    hasMoreLogs,
    totalLogCount,
    logsRequested,
    getTruncatedLogOutput
  } from '../stores/logsStore';
  import { onMount, onDestroy } from 'svelte';
  import { showToast } from '../utils/notificationUtils';
  
  // State variables
  let isVisible = false;
  let observer: IntersectionObserver | null = null;
  let containerElement: HTMLElement;
  
  $: logsExist = $logs.length > 0; 
  $: isInitialLoading = $isLoadingLogs && $logs.length === 0;
  
  function getStatusClass(status: string): string {
    switch (status) {
      case 'running': return 'status-running';
      case 'completed': return 'status-completed';
      case 'failed': return 'status-failed';
      default: return 'status-idle';
    }
  }
  
  // Auto-reload data when navigating to this component
  function autoReloadLogs() {
    // Always refresh data when this component becomes visible
    console.log('Auto-refreshing logs...');
    requestInitialLogs();
  }

  // Define visibility change handler at component level
  let visibilityChangeHandler: () => void;

  // Set up intersection observer for lazy loading
  onMount(() => {
    console.log('LogsView mounted, setting up lazy loading...');
    
    // Load logs immediately on mount
    requestInitialLogs();
    
    // Set up visibilitychange handler to automatically reload when tab becomes visible
    visibilityChangeHandler = () => {
      if (document.visibilityState === 'visible' && isVisible) {
        autoReloadLogs();
      }
    };
    document.addEventListener('visibilitychange', visibilityChangeHandler);
    
    // Create an intersection observer
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          isVisible = true;
          
          // Always refresh when component becomes visible
          autoReloadLogs();
        } else {
          isVisible = false;
        }
      });
    }, { 
      threshold: 0.05, // Trigger when just 5% of the element is visible for faster loading
      rootMargin: '300px' // Start loading even earlier
    }); 
    
    // Start observing the container element
    if (containerElement) {
      observer.observe(containerElement);
    }
  });
  
  // Clean up observer on component destroy
  onDestroy(() => {
    if (observer && containerElement) {
      observer.unobserve(containerElement);
      observer.disconnect();
    }
    
    // Remove visibilitychange event listener
    document.removeEventListener('visibilitychange', visibilityChangeHandler);
  });

  // Helper to check if an element is in the viewport
  function isInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }
  
  // Request initial logs to be loaded with debounce
  let initialLoadTimeout: number | null = null;
  function requestInitialLogs(): void {
    if (!$logsRequested && !$isLoadingLogs) {
      // Clear any existing timeout
      if (initialLoadTimeout !== null) {
        clearTimeout(initialLoadTimeout);
      }
      
      // Set a new timeout to debounce multiple calls
      initialLoadTimeout = setTimeout(() => {
        loadInitialLogs().catch(err => {
          console.error('Error loading logs:', err);
        });
        initialLoadTimeout = null;
      }, 50);
    }
  }
  
  async function refreshLogs(): Promise<void> {
    if (!$isLoadingLogs) {
      try {
        console.log('Refreshing logs...');
        await loadInitialLogs();
        console.log('Logs refreshed successfully');
      } catch (err) {
        console.error('Error refreshing logs:', err);
      }
    }
  }
  
  function loadMore(): void {
    if (!$isLoadingLogs && $hasMoreLogs) {
      // Start loading more logs, but don't await
      loadMoreLogs().catch(err => {
        console.error('Error loading more logs:', err);
      });
    }
  }
  
  function clearAllLogs(): void {
    logs.set([]);
    showToast('All logs cleared', 'info');
  }
</script>

<div class="logs-view" bind:this={containerElement}>
  <div class="logs-header">
    <h2>Automation Logs</h2>
    <div class="action-buttons">
      {#if $isLoadingLogs}
        <div class="loading-indicator">
          <div class="small-spinner"></div>
          <span>Loading...</span>
        </div>
      {/if}
    </div>
  </div>
  
  {#if isInitialLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading logs...</p>
    </div>
  {:else if !logsExist}
    <div class="empty-state">
      <span class="material-icons">receipt_long</span>
      <p>No logs available</p>
      <p class="sub-text">Run automations to see their outputs here</p>
    </div>
  {:else}
    <div class="logs-list">
      {#each $logs as log, index (log.id)}
        <!-- Only render the visible items and a small buffer to improve performance -->
        {#if index < 20}
          <div class="log-item">
            <div class="log-header">
              <div class="log-title">
                <h3>{log.automationName}</h3>
                <span class={`status-badge ${getStatusClass(log.status)}`}>
                  {log.status}
                </span>
              </div>
              <div class="log-timestamp">
                {new Date(log.timestamp).toLocaleString()}
              </div>
            </div>
            <!-- Use details/summary for collapsible logs to reduce DOM load -->
            <details>
              <summary>View Log Output</summary>
              <pre class="log-content">{getTruncatedLogOutput(log)}</pre>
            </details>
          </div>
        {:else if index === 20}
          <!-- Show message about hidden logs -->
          <div class="more-logs-message">
            {$logs.length - 20} more logs available. Load more to view.
          </div>
        {/if}
      {/each}
      
      <!-- Load more section -->
      <div class="load-more-container">
        {#if $hasMoreLogs}
          <button 
            class="load-more-btn" 
            on:click={loadMore} 
            disabled={$isLoadingLogs}
          >
            {#if $isLoadingLogs}
              <div class="small-spinner"></div>
              Loading...
            {:else}
              Load More Logs
            {/if}
          </button>
        {:else if $logs.length > 0}
          <div class="all-loaded-message">
            All logs loaded ({$logs.length} items)
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .logs-view {
    width: 100%;
    contain: content; /* Improve layout performance */
  }
  
  .logs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  .action-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  
  h2 {
    margin: 0;
    color: var(--on-background);
  }
  
  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: var(--on-surface-variant);
    background-color: rgba(255, 255, 255, 0.05);
    padding: 0.3rem 0.75rem;
    border-radius: 4px;
  }
  
  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    background-color: var(--surface);
    border-radius: 8px;
    text-align: center;
  }
  
  .spinner, .small-spinner {
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-left-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    margin-bottom: 1rem;
  }
  
  .small-spinner {
    width: 16px;
    height: 16px;
    margin-right: 0.5rem;
    display: inline-block;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .empty-state .material-icons {
    font-size: 4rem;
    margin-bottom: 1rem;
    color: var(--primary);
  }
  
  .sub-text {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.9rem;
    margin-top: 0.5rem;
  }
  
  .logs-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    contain: content; /* Improve performance when scrolling */
  }
  
  .log-item {
    background-color: var(--surface);
    border-radius: 8px;
    overflow: hidden;
    contain: layout; /* Improve performance */
  }
  
  .log-header {
    padding: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .log-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .log-title h3 {
    margin: 0;
    font-size: 1rem;
  }
  
  .log-timestamp {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.5);
  }
  
  .log-details {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 0 0 8px 8px;
  }
  
  details summary {
    padding: 0.75rem 1rem;
    cursor: pointer;
    user-select: none;
    font-size: 0.9rem;
    color: var(--on-surface-variant);
    transition: background-color 0.2s;
    list-style: none;
    background-color: rgba(0, 0, 0, 0.2);
  }
  
  details summary:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  
  details summary::before {
    content: "▶";
    display: inline-block;
    width: 20px;
    transition: transform 0.2s;
  }
  
  details[open] summary::before {
    transform: rotate(90deg);
  }
  
  .more-logs-message {
    text-align: center;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    margin-top: 1rem;
    color: var(--on-surface-variant);
  }
  
  .log-content {
    margin: 0;
    padding: 1rem;
    font-family: monospace;
    font-size: 0.9rem;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 300px;
    overflow: auto;
    contain: content; /* Improve scroll performance */
    will-change: transform; /* GPU acceleration hints */
  }
  
  .status-badge {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    text-transform: uppercase;
  }
  
  .status-idle {
    background-color: #424242;
    color: #e1e1e1;
  }
  
  .status-running {
    background-color: #0288d1;
    color: white;
  }
  
  .status-completed {
    background-color: #4caf50;
    color: white;
  }
  
  .status-failed {
    background-color: var(--error);
    color: white;
  }
  
  .load-more-container {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
    padding: 1rem;
  }
  
  .load-more-btn {
    background-color: var(--primary);
    color: var(--on-primary);
    border: none;
    border-radius: 4px;
    padding: 0.75rem 1.5rem;
    font-size: 0.9rem;
    cursor: pointer;
    display: flex;
    align-items: center;
  }
  
  .load-more-btn:hover:not([disabled]) {
    background-color: var(--primary-dark);
  }
  
  .load-more-btn[disabled] {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .all-loaded-message {
    color: var(--on-surface-variant);
    font-size: 0.9rem;
    padding: 0.5rem;
  }
</style>