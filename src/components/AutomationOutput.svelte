<script lang="ts">
  // No longer need currentOutput and afterUpdate since we're not showing real-time output
  
  export let automation = null;
  // Keep showRealTime prop for API compatibility, but it does nothing now
  export let showRealTime = true;
  
  // Helper to extract screenshot path from automation output
  function getScreenshotFilename(output: string): string | null {
    if (!output) return null;
    
    // Try to match screenshot path patterns in descending order of specificity
    
    // 1. Try to find it in the JSON result (most reliable)
    const jsonMatch = output.match(/screenshotPath": "([^"]+\.png)"/);
    if (jsonMatch && jsonMatch[1]) {
      // Check if it's a path or just a filename
      const parts = jsonMatch[1].split('/');
      return parts[parts.length - 1]; // Return just the filename
    }
    
    // 2. Look for Screenshot saved as line
    const savedAsMatch = output.match(/Screenshot saved as: ([^\s]+\.png)/);
    if (savedAsMatch && savedAsMatch[1]) return savedAsMatch[1];
    
    // 3. Try to find it in a log line
    const logMatch = output.match(/Taking screenshot and saving to:.*?([^\/\\]+\.png)/);
    if (logMatch && logMatch[1]) return logMatch[1];
    
    // 4. Try to find any png reference (least reliable)
    const pngMatch = output.match(/wikipedia-apples-[^\/\\]+\.png/);
    if (pngMatch && pngMatch[0]) return pngMatch[0];
    
    return null;
  }
</script>

<div class="automation-output">
  <!-- Real-time output section removed per requirements -->
  
  {#if automation?.output}
    <div class="output-container">
      <div class="output-header">
        <span>Output</span>
        <slot name="actions"></slot>
      </div>
      <pre class="output-content">{automation.output}</pre>
      {#if automation.output}
        {@const screenshotPath = getScreenshotFilename(automation.output)}
        {#if screenshotPath}
          <div class="output-with-screenshot">
            <div class="output-note">
              Screenshot saved to outputs directory: {screenshotPath}
            </div>
            
            <div class="screenshot-container">
              <img 
                src={`http://localhost:3001/outputs/${screenshotPath}`} 
                alt="Automation screenshot" 
                onerror={(e) => { 
                  console.error('Failed to load screenshot:', screenshotPath);
                  // Try with a secondary approach - look for any PNG file in outputs
                  let baseFilename = screenshotPath.split('-')[0] + '-' + screenshotPath.split('-')[1];
                  e.target.src = `http://localhost:3001/outputs/${baseFilename}?timestamp=${Date.now()}`;
                  e.target.onerror = (e2) => {
                    console.error('Also failed to load backup screenshot');
                    e2.target.parentElement.innerHTML = '<div class="error">Failed to load screenshot. Check server logs.</div>';
                  };
                }}
              />
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .automation-output {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  /* Removed realtime-output styles since that section is no longer used */
  
  .output-container {
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
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
    max-height: 300px;
    overflow: auto;
  }
  
  .output-with-screenshot {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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
  
  .error {
    color: #f44336;
    padding: 1rem;
    text-align: center;
    background-color: rgba(244, 67, 54, 0.1);
    border-radius: 4px;
  }
</style>