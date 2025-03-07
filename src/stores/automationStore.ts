import { writable } from 'svelte/store';
import type { Automation } from '../types';
import { loadAutomations, saveAutomations } from '../utils/storage';

// Sample automation for first-time users
const sampleAutomation: Automation = {
  id: '1',
  name: 'Sample Automation',
  description: 'This is a sample automation to demonstrate how Rpage works.',
  script: `async function run() {
  try {
    // Wikipedia search and screenshot automation
    console.log("Starting Wikipedia search automation...");
    
    // 1. Launch a browser in headless mode
    console.log("Launching browser");
    const browser = await chromium.launch({ headless: true });
    
    // 2. Create a new page
    const page = await browser.newPage();
    
    // 3. Navigate to Wikipedia
    console.log("Navigating to Wikipedia");
    await page.goto('https://en.wikipedia.org/');
    
    // 4. Type "apples" in the search box and search
    console.log("Searching for 'apples'");
    await page.fill('input#searchInput', 'apples');
    await page.click('input[type="submit"]');
    
    // 5. Wait for search results page to load
    console.log("Waiting for search results");
    await page.waitForLoadState('networkidle');
    
    // 6. Get page information
    const title = await page.title();
    console.log("Page title:", title);
    
    // 7. Extract first paragraph of content
    const firstParagraph = await page.$eval('#mw-content-text p', el => el.textContent);
    console.log("Content preview:", firstParagraph.substring(0, 150) + "...");
    
    // 8. Take a screenshot and save to outputs folder
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotFilename = 'wikipedia-apples-' + timestamp + '.png';
    const screenshotPath = path.join(__dirname, 'data/outputs', screenshotFilename);
    console.log("Taking screenshot and saving to:", screenshotPath);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    
    // 9. Close the browser
    console.log("Closing browser");
    await browser.close();
    
    // 10. Return results
    console.log("Automation completed successfully");
    return {
      title: title,
      searchTerm: 'apples',
      content: firstParagraph,
      screenshotPath: screenshotFilename,
      timestamp: timestamp
    };
  } catch (error) {
    console.error("Error in automation:", error);
    throw error;
  }
}`,
  status: 'idle',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Create a writable store for automations with empty initial value
export const automations = writable<Automation[]>([]);

// Initialize the store asynchronously
loadAutomations().then(data => {
  // Use loaded data or fall back to sample automation
  const initialData = data.length > 0 ? data : [sampleAutomation];
  automations.set(initialData);
});

// Subscribe to changes and save to storage
automations.subscribe(value => {
  if (value.length > 0) {
    console.log('[AutomationStore] Saving automations to database:', value.length);
    saveAutomations(value).catch(err => {
      console.error('[AutomationStore] Error saving automations:', err);
    });
  }
});

// Create a writable store for the selected automation
export const selectedAutomation = writable<Automation | null>(null);