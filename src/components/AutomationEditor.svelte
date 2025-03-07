<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { selectedAutomation } from '../stores/automationStore';
  import type { Automation } from '../types';
  
  const dispatch = createEventDispatcher();
  let automation: Automation = $selectedAutomation 
    ? { ...$selectedAutomation } 
    : {
        id: crypto.randomUUID(),
        name: 'New Automation',
        description: '',
        script: '',
        status: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
  
  function handleSave() {
    dispatch('save', automation);
  }
  
  function handleCancel() {
    dispatch('cancel');
  }
</script>

<div class="automation-editor">
  <div class="editor-header">
    <h2>{automation.id ? 'Edit' : 'New'} Automation</h2>
    <div class="editor-actions">
      <button class="btn-outline" on:click={handleCancel}>Cancel</button>
      <button class="btn-primary" on:click={handleSave}>Save</button>
    </div>
  </div>
  
  <div class="editor-form">
    <div class="form-group">
      <label for="name">Name</label>
      <input 
        type="text" 
        id="name" 
        bind:value={automation.name} 
        placeholder="Enter automation name"
      />
    </div>
    
    <div class="form-group">
      <label for="description">Description</label>
      <textarea 
        id="description" 
        bind:value={automation.description} 
        placeholder="Enter automation description"
        rows="3"
      ></textarea>
    </div>
    
    <div class="form-group">
      <label for="script">Automation Script</label>
      <textarea 
        id="script" 
        bind:value={automation.script} 
        placeholder="Enter your Playwright script"
        rows="15"
        class="code-editor"
      ></textarea>
      <p class="help-text">
        Use Playwright script to define your automation. Example:
      </p>
      <pre class="code-example">{`async function run() {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  await page.screenshot({ path: 'example.png' });
  await browser.close();
}`}
      </pre>
    </div>
  </div>
</div>

<style>
  .automation-editor {
    width: 100%;
  }
  
  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  
  h2 {
    margin: 0;
    color: var(--on-background);
  }
  
  .editor-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .btn-primary {
    background-color: var(--primary);
    color: var(--on-primary);
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .btn-primary:hover {
    background-color: var(--primary-variant);
  }
  
  .btn-outline {
    background-color: transparent;
    color: var(--on-surface);
    border: 1px solid var(--on-surface);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .btn-outline:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .editor-form {
    background-color: var(--surface);
    border-radius: 8px;
    padding: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 1.5rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--on-surface);
  }
  
  input, textarea {
    width: 100%;
    padding: 0.75rem;
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: var(--on-surface);
    font-family: inherit;
  }
  
  input:focus, textarea:focus {
    outline: none;
    border-color: var(--primary);
  }
  
  .code-editor {
    font-family: monospace;
  }
  
  .help-text {
    margin-top: 0.5rem;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
  }
  
  .code-example {
    background-color: rgba(0, 0, 0, 0.3);
    padding: 1rem;
    border-radius: 4px;
    font-size: 0.9rem;
    overflow-x: auto;
  }
</style>