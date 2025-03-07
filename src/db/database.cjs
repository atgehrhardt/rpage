const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Allow environment variable to override database directory
// This makes it configurable for Docker
const envDataDir = process.env.RPAGE_DATA_DIR;
const dbDir = envDataDir || path.join(__dirname, '..', '..', 'data');

console.log(`Using database directory: ${dbDir}`);

// Ensure db directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`Created database directory: ${dbDir}`);
}

const dbPath = path.join(dbDir, 'rpage.db');
console.log(`Database path: ${dbPath}`);
const db = new Database(dbPath);

// Initialize the database with tables
function initDatabase() {
  // Create automations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      script TEXT NOT NULL,
      status TEXT DEFAULT 'idle',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Create logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      automationId TEXT NOT NULL,
      automationName TEXT NOT NULL,
      status TEXT NOT NULL,
      output TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (automationId) REFERENCES automations(id) ON DELETE CASCADE
    )
  `);

  // Create settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Create outputs table to store output data directly in the database
  db.exec(`
    CREATE TABLE IF NOT EXISTS outputs (
      id TEXT PRIMARY KEY,
      automationId TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (automationId) REFERENCES automations(id) ON DELETE CASCADE
    )
  `);

  // Insert default settings if they don't exist
  const defaultSettings = [
    { key: 'notificationsEnabled', value: 'true' },
    { key: 'darkTheme', value: 'true' },
    { key: 'keepOutputDays', value: '7' }
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  defaultSettings.forEach(setting => {
    insertSetting.run(setting.key, setting.value);
  });

  // Check if we need to insert a sample automation
  const count = db.prepare('SELECT COUNT(*) as count FROM automations').get();
  if (count.count === 0) {
    // Sample automation script
    const sampleScript = `async function run() {
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
    
    // Use the provided outputsDir path or fall back to a relative path
    let outputDir;
    let screenshotPath;
    
    if (typeof outputsDir === 'string') {
      // If outputsDir is provided by the server
      outputDir = outputsDir;
      console.log("Using server-provided outputs directory:", outputDir);
    } else {
      // Fallback to the expected path
      outputDir = path.join(__dirname, '..', '..', 'data', 'outputs');
      console.log("Using fallback outputs directory:", outputDir);
    }
    
    // Ensure directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log("Created outputs directory:", outputDir);
    }
    
    // Create full path
    screenshotPath = path.join(outputDir, screenshotFilename);
    
    console.log("Taking screenshot and saving to:", screenshotPath);
    
    // Explicitly take screenshot with fullPage: false option and absolute path
    try {
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: false 
      });
      console.log("Screenshot saved successfully at:", screenshotPath);
      
    } catch (err) {
      console.error("Error taking screenshot:", err.message);
    }
    
    // 9. Close the browser
    console.log("Closing browser");
    await browser.close();
    
    // 10. Return results
    console.log("Automation completed successfully");
    return {
      title: title,
      searchTerm: 'apples',
      content: firstParagraph,
      screenshotPath: screenshotFilename, // Return just filename for client access
      timestamp: timestamp
    };
  } catch (error) {
    console.error("Error in automation:", error);
    throw error;
  }
}`;

    // Simple Wikipedia search automation script
    const wikiScript = `async function run() {
  try {
    // Wikipedia screenshot automation
    console.log("Starting Wikipedia search automation...");
    
    // 1. Launch browser in headless mode
    console.log("Launching browser");
    const browser = await chromium.launch({ headless: true });
    
    // 2. Create a new page
    const page = await browser.newPage();
    
    // 3. Navigate to Wikipedia
    console.log("Navigating to Wikipedia");
    await page.goto('https://en.wikipedia.org/');
    
    // 4. Type "apples" in the search box
    console.log("Searching for 'apples'");
    await page.fill('input#searchInput', 'apples');
    
    // 5. Click the search button - using more reliable selector
    console.log("Clicking search button");
    // Wait for the button to be visible
    await page.waitForSelector('button.cdx-button');
    // Click the search button
    await page.click('button.cdx-button');
    
    // 6. Wait for search results page to load
    console.log("Waiting for search results to load");
    await page.waitForLoadState('networkidle');
    
    // 7. Get page title
    const title = await page.title();
    console.log("Page title:", title);
    
    // 8. Get first paragraph of content (more reliable selector)
    const firstParagraph = await page.$eval('.mw-parser-output > p', el => el.textContent);
    console.log("Content preview:", firstParagraph.substring(0, 150) + "...");
    
    // 9. Take a screenshot 
    console.log("Taking screenshot");
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshot = await page.screenshot({ fullPage: true });
    
    // Convert the screenshot to base64 for database storage
    const screenshotBase64 = screenshot.toString('base64');
    
    // 10. Close the browser
    console.log("Closing browser");
    await browser.close();
    
    // 11. Return results with screenshot information
    console.log("Automation completed successfully");
    
    // Create a separate screenshot result to be saved directly
    const screenshotData = {
      title: title,
      imageData: screenshotBase64,
      date: timestamp
    };
    
    return {
      title: title,
      content: firstParagraph.substring(0, 150) + "...",
      // Store full screenshot info for saving to database
      screenshot: screenshotData,
      screenshotName: "Wikipedia Apples Screenshot " + timestamp,
      timestamp: timestamp
    };
  } catch (error) {
    console.error("Error during automation:", error.message);
    throw error;
  }
}`;

    // Insert sample automation
    const insertAutomation = db.prepare(`
      INSERT INTO automations (id, name, description, script, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertAutomation.run(
      '1',
      'Wikipedia Apples Search',
      'Searches for "apples" on Wikipedia and takes a screenshot of the results',
      wikiScript,
      'idle',
      new Date().toISOString(),
      new Date().toISOString()
    );
  }

  console.log('Database initialized successfully');
}

// Check if database is new or already exists
const isNewDb = !fs.existsSync(dbPath);

// Initialize the database
initDatabase();

// Log database initialization status
if (isNewDb) {
  console.log('Created and initialized a new database');
} else {
  console.log('Using existing database');
}

module.exports = db;