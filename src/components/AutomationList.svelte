<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { automations, selectedAutomation } from '../stores/automationStore';
  import type { Automation } from '../types';
  // Removed AutomationOutput import
  
  const dispatch = createEventDispatcher();
  
  function handleAdd() {
    dispatch('add');
  }
  
  function handleEdit(automation: Automation) {
    selectedAutomation.set(automation);
    dispatch('edit');
  }
  
  function handleRun(automationId: string) {
    dispatch('run', automationId);
  }
  
  function handleDelete(automationId: string) {
    dispatch('delete', automationId);
  }
  
  function getStatusClass(status: string): string {
    switch (status) {
      case 'running': return 'status-running';
      case 'completed': return 'status-completed';
      case 'failed': return 'status-failed';
      default: return 'status-idle';
    }
  }
  
  // Reset automation to idle state
  function resetAutomation(automation, event) {
    event.stopPropagation();
    automations.update(items => {
      const index = items.findIndex(a => a.id === automation.id);
      if (index >= 0) {
        items[index].output = '';
        items[index].status = 'idle'; // Reset to idle state
        return [...items];
      }
      return items;
    });
  }
</script>

<div class="automation-list">
  <div class="list-header">
    <h2>Automations</h2>
    <button class="btn-primary" on:click={handleAdd}>
      <span class="material-icons">add</span>
      New Automation
    </button>
  </div>
  
  {#if $automations.length === 0}
    <div class="empty-state">
      <span class="material-icons">smart_toy</span>
      <p>You don't have any automations yet</p>
      <button class="btn-primary" on:click={handleAdd}>Create your first automation</button>
    </div>
  {:else}
    <div class="automation-grid">
      {#each $automations as automation (automation.id)}
        <div class="automation-card">
          <div class="card-header">
            <h3>{automation.name}</h3>
            <div class="status-actions">
              <span class={`status-badge ${getStatusClass(automation.status)}`}>
                {automation.status}
              </span>
              {#if automation.status === 'completed' || automation.status === 'failed'}
                <button class="btn-icon-small reset-button" on:click={(e) => resetAutomation(automation, e)} title="Reset to idle">
                  <span class="material-icons">restart_alt</span>
                </button>
              {/if}
            </div>
          </div>
          <p class="description">{automation.description || 'No description'}</p>
          
          <div class="card-footer">
            <button class="btn-icon" on:click={() => handleRun(automation.id)} disabled={automation.status === 'running'}>
              <span class="material-icons">play_arrow</span>
            </button>
            <button class="btn-icon" on:click={() => handleEdit(automation)}>
              <span class="material-icons">edit</span>
            </button>
            <button class="btn-icon" on:click={() => handleDelete(automation.id)}> 
              <span class="material-icons">delete</span>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .automation-list {
    width: 100%;
  }
  
  .list-header {
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
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    background-color: var(--surface);
    border-radius: 8px;
    text-align: center;
  }
  
  .empty-state .material-icons {
    font-size: 4rem;
    margin-bottom: 1rem;
    color: var(--primary);
  }
  
  .automation-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }
  
  .automation-card {
    background-color: var(--surface);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .card-header h3 {
    margin: 0;
    font-size: 1.2rem;
  }
  
  .status-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .reset-button {
    opacity: 0.7;
  }
  
  .reset-button:hover {
    opacity: 1;
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
  
  .description {
    flex: 1;
    margin: 0.5rem 0 1rem;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .card-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  
  .btn-icon {
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
  
  .btn-icon:hover:not([disabled]) {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .btn-icon[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .output-container {
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    margin: 0.5rem 0;
    max-height: 300px;
    overflow: auto;
  }
  
  .output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.8rem;
    font-weight: bold;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .output-content {
    margin: 0;
    padding: 0.5rem;
    font-family: monospace;
    font-size: 0.8rem;
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  .btn-icon-small {
    background: transparent;
    border: none;
    color: var(--on-surface);
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
  }
  
  .btn-icon-small:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .output-result {
    display: flex;
    flex-direction: column;
  }
  
  .output-text {
    flex: 1;
  }
  
  .output-note {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: #2a2a2a;
    border-radius: 4px;
    text-align: center;
    font-style: italic;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .output-with-screenshot {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .screenshot-container {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: #2a2a2a;
    border-radius: 4px;
    text-align: center;
  }
  
  .screenshot-container img {
    max-width: 100%;
    max-height: 300px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
</style>