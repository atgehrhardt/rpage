const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'rpage.db');
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

  // Create outputs table to track output files
  db.exec(`
    CREATE TABLE IF NOT EXISTS outputs (
      id TEXT PRIMARY KEY,
      automationId TEXT NOT NULL,
      filename TEXT NOT NULL,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      url TEXT NOT NULL,
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
    const screenshotPath = path.resolve(__dirname, 'static/outputs', screenshotFilename);
    
    console.log("Taking screenshot and saving to:", screenshotPath);
    
    // Ensure output directory exists
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true, mode: 0o777 });
      console.log("Created outputs directory:", outputsDir);
    }
    
    // Set permissions for cleaner debugging
    try {
      fs.accessSync(outputsDir, fs.constants.W_OK);
      console.log("Output directory is writable:", outputsDir);
    } catch (err) {
      console.error("Output directory is not writable:", outputsDir);
      // Try to fix permissions
      try {
        fs.chmodSync(outputsDir, 0o777);
      } catch (e) {
        console.error("Failed to set permissions:", e.message);
      }
    }
    
    // Explicitly take screenshot with fullPage: false option and absolute path
    try {
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: false 
      });
      console.log("Screenshot saved successfully at:", screenshotPath);
      
      // Verify file exists
      if (fs.existsSync(screenshotPath)) {
        const stats = fs.statSync(screenshotPath);
        console.log("Verified screenshot file (" + stats.size + " bytes):", screenshotPath);
      } else {
        console.error("Failed to verify screenshot: file does not exist at", screenshotPath);
      }
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

    // Insert sample automation
    const insertAutomation = db.prepare(`
      INSERT INTO automations (id, name, description, script, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertAutomation.run(
      '1',
      'Sample Automation',
      'This is a sample automation to demonstrate how Rpage works.',
      sampleScript,
      'idle',
      new Date().toISOString(),
      new Date().toISOString()
    );
  }

  console.log('Database initialized successfully');
}

// Initialize the database
initDatabase();

module.exports = db;