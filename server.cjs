const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

// Import database models
const db = require('./src/db/database.cjs');
const AutomationModel = require('./src/db/models/automation.cjs');
const LogModel = require('./src/db/models/log.cjs');
const SettingModel = require('./src/db/models/setting.cjs');
const OutputModel = require('./src/db/models/output.cjs');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize database
console.log('Initializing database with required tables');

// API endpoint for getting outputs
app.get('/api/outputs', (req, res) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;
    const sort = req.query.sort || 'desc';
    
    console.log(`Getting outputs with page=${page}, limit=${limit}, skip=${skip}, sort=${sort}`);
    
    // Get paginated outputs from the database
    const result = OutputModel.getAll(page, limit, skip);
    console.log(`Retrieved ${result.files.length} outputs (page ${page}) from database at ${new Date().toISOString()}`);
    
    if (result.files.length > 0) {
      console.log(`First output: ${result.files[0].id} - ${result.files[0].name}, type: ${result.files[0].type}`);
    }

    // Return formatted outputs with proper data
    res.json({
      success: true,
      files: result.files,
      count: result.files.length,
      total: result.total,
      page: result.page,
      limit: result.limit,
      hasMore: (result.page * result.limit) < result.total
    });
  } catch (error) {
    console.error('Error retrieving outputs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Special endpoint for obtaining all output files directly (no wrapper)
app.get('/api/outputs-direct', (req, res) => {
  try {
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;
    const sort = req.query.sort || 'desc';
    
    console.log(`Getting direct outputs with page=${page}, limit=${limit}, skip=${skip}, sort=${sort}`);
    
    // Get paginated outputs from the database
    const result = OutputModel.getAll(page, limit, skip);
    console.log(`Retrieved ${result.files.length} outputs directly from database at ${new Date().toISOString()}`);
    
    // Return the outputs array directly (no wrapper)
    res.json(result.files);
  } catch (error) {
    console.error('Error retrieving direct outputs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get a specific output file by ID
app.get('/api/outputs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const output = OutputModel.getById(id);
    
    if (!output) {
      return res.status(404).json({ 
        success: false, 
        error: 'Output not found' 
      });
    }
    
    // Return the output data directly
    res.json({
      success: true,
      data: output
    });
  } catch (error) {
    console.error(`Error retrieving output ${req.params.id}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run automation endpoint
app.post('/api/run-automation', async (req, res) => {
  const { id, name, script } = req.body;
  
  if (!script) {
    return res.status(400).json({ success: false, error: 'No script provided' });
  }
  
  console.log(`Running automation: ${name} (ID: ${id})`);
  
  try {
    // Set up SSE for real-time output
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Helper to send SSE messages
    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    // Send initial status
    sendEvent({ type: 'status', status: 'running', message: 'Starting automation...' });
    
    // Create a simple wrapper to capture logs
    let logs = [];
    let screenshotFilename = null;
    
    const logCapture = (...args) => {
      const logMessage = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      // Check if this is a screenshot log message
      if (logMessage.includes('Taking screenshot and saving to:')) {
        const match = logMessage.match(/Taking screenshot and saving to:.*?([^\/\\]+\.png)/);
        if (match && match[1]) {
          screenshotFilename = match[1];
          console.log(`Detected screenshot filename: ${screenshotFilename}`);
        }
      }
      
      logs.push(logMessage);
      console.log(...args);
      
      // Send log in real-time
      sendEvent({ type: 'log', message: logMessage });
    };

    // Create a function with the user's script
    const scriptFunction = new Function(`
      return async ({ playwright, console, path, fs, __dirname, outputsDir }) => {
        const { chromium } = playwright;
        ${script}
        return run();
      }
    `)();
    
    try {
      // Update automation status to 'running'
      AutomationModel.updateStatus(id, 'running');
      
      // Modify script if it's using the old path pattern
      let scriptToUse = script;
      if (script.includes("path.join(__dirname, 'static', 'outputs'")) {
        console.log("Warning: Detected outdated path in script, screenshots may not work correctly");
      }
      
      // Use environment variable or default path for outputs directory
      const envDataDir = process.env.RPAGE_DATA_DIR;
      const outputsDir = envDataDir 
        ? path.join(envDataDir, 'outputs')
        : path.join(__dirname, 'data', 'outputs');
      
      console.log(`Using outputs directory: ${outputsDir}`);
      
      // Ensure the directory exists
      if (!fs.existsSync(outputsDir)) {
        fs.mkdirSync(outputsDir, { recursive: true });
        console.log(`Created output directory: ${outputsDir}`);
      }
      
      // Execute the script
      const startTime = Date.now();
      const result = await scriptFunction({ 
        playwright: { chromium },
        console: { 
          log: logCapture,
          error: logCapture,
          warn: logCapture,
          info: logCapture
        },
        path,
        fs,
        __dirname,
        outputsDir
      });
      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Format the logs
      const output = logs.join('\n') + 
        `\nTotal execution time: ${executionTime} seconds\n\n` +
        `Returned result: ${JSON.stringify(result, null, 2)}`;
      
      // Get screenshot info from the result if not captured in logs
      if (result && result.screenshotPath && !screenshotFilename) {
        // Extract just the filename
        const match = result.screenshotPath.match(/([^\/\\]+)$/);
        if (match && match[1]) {
          screenshotFilename = match[1];
          console.log(`Using screenshot from result: ${screenshotFilename}`);
        }
      }
      
      // Store automation results in the database
      if (result) {
        try {
          // Ensure the automation exists in the database
          const automation = AutomationModel.getById(id);
          if (!automation) {
            console.error(`Cannot save output: Automation with ID ${id} does not exist in database`);
            return;
          }

          // If there's a screenshot in the result, save it
          if (result.screenshot) {
            console.log(`Saving screenshot data to database`);
            let screenshotName = "";
            let screenshotData = null;
            
            // Use screenshotName from result if available, otherwise generate one
            if (result.screenshotName) {
              screenshotName = result.screenshotName;
            } else if (typeof result.screenshot === 'object' && result.screenshot.name) {
              screenshotName = result.screenshot.name;
            } else if (typeof result.screenshot === 'string') {
              screenshotName = result.screenshot;
            } else {
              screenshotName = `Screenshot for ${automation.name} at ${new Date().toLocaleString()}`;
            }
            
            // Process screenshot data
            if (typeof result.screenshot === 'object') {
              // Use the screenshot object directly
              screenshotData = result.screenshot;
              console.log(`Using screenshot object with fields: ${Object.keys(result.screenshot).join(', ')}`);
            } else {
              // Create a new screenshot object
              screenshotData = {
                name: screenshotName,
                timestamp: new Date().toISOString(),
                format: 'png',
                source: automation.name
              };
            }
            
            console.log(`Saving screenshot with name: ${screenshotName}`);
            
            try {
              // Save the screenshot data directly
              const savedOutput = OutputModel.saveOutput(
                id, 
                JSON.stringify(screenshotData), 
                screenshotName,
                'screenshot'
              );
              
              if (savedOutput) {
                console.log(`Successfully saved screenshot data with ID ${savedOutput.id}`);
                // Log some data for debugging
                const outputFromDB = OutputModel.getById(savedOutput.id);
                console.log(`Verified output in DB: ${outputFromDB.id}, type: ${outputFromDB.type}`);
              } else {
                console.error(`Failed to save screenshot data`);
              }
            } catch (screenshotError) {
              console.error(`Error saving screenshot data:`, screenshotError);
            }
          }
          
          // Skip saving general results data - only save screenshots
          console.log(`Skipping general results data - only saving screenshots as requested`);
          
          // Verify database outputs
          const allOutputs = OutputModel.getAll();
          console.log(`Database now has ${allOutputs.length} outputs after adding new entries`);
        } catch (outputError) {
          console.error(`Error saving output to database:`, outputError);
        }
      }
      
      // Update automation status
      AutomationModel.updateStatus(id, 'completed');
      
      // Create log entry
      const automation = AutomationModel.getById(id);
      LogModel.create({
        id: Date.now().toString(),
        automationId: id,
        automationName: automation.name,
        status: 'completed',
        output: output,
        timestamp: new Date().toISOString()
      });
      
      // Send completion event
      sendEvent({ 
        type: 'complete', 
        success: true, 
        output,
        result,
        screenshotFilename,
        executionTime
      });
      
      // End the response
      res.end();
    } catch (error) {
      console.error('Error during automation execution:', error);
      
      // Update automation status
      AutomationModel.updateStatus(id, 'failed');
      
      // Create log entry for failure
      const automation = AutomationModel.getById(id);
      LogModel.create({
        id: Date.now().toString(),
        automationId: id,
        automationName: automation.name,
        status: 'failed',
        output: `Error: ${error.message}\n\n${logs.join('\n')}`,
        timestamp: new Date().toISOString()
      });
      
      // Send error event
      sendEvent({ 
        type: 'complete', 
        success: false, 
        error: error.message,
        output: `Error: ${error.message}`
      });
      
      // End the response
      res.end();
    }
  } catch (error) {
    console.error('Error setting up automation:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      output: `Error: ${error.message}`
    });
  }
});

// API Endpoints for automations
app.get('/api/automations', (req, res) => {
  try {
    const automations = AutomationModel.getAll();
    res.json({ success: true, data: automations });
  } catch (error) {
    console.error('Error getting automations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/automations/:id', (req, res) => {
  try {
    const { id } = req.params;
    const automation = AutomationModel.getById(id);
    
    if (!automation) {
      return res.status(404).json({ success: false, error: 'Automation not found' });
    }
    
    res.json({ success: true, data: automation });
  } catch (error) {
    console.error('Error getting automation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/automations', (req, res) => {
  try {
    const newAutomation = req.body;
    
    // Ensure required fields
    if (!newAutomation.name || !newAutomation.script) {
      return res.status(400).json({ success: false, error: 'Name and script are required' });
    }
    
    // Add metadata
    newAutomation.id = newAutomation.id || Date.now().toString();
    newAutomation.createdAt = newAutomation.createdAt || new Date().toISOString();
    newAutomation.updatedAt = new Date().toISOString();
    newAutomation.status = newAutomation.status || 'idle';
    
    console.log('Creating new automation:', newAutomation);
    
    // Create in database
    const automation = AutomationModel.create(newAutomation);
    console.log('Automation created successfully:', automation);
    res.json({ success: true, data: automation });
  } catch (error) {
    console.error('Error creating automation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/automations/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    console.log(`Updating automation ${id} with:`, updates);
    
    // Check if the script is using the incorrect path pattern and warn
    if (updates.script && updates.script.includes("path.join(__dirname, 'static', 'outputs'")) {
      console.log("Warning: The automation script is using an incorrect path for outputs");
      console.log("It should use the outputsDir parameter instead of 'static/outputs'");
    }
    
    const updatedAutomation = AutomationModel.update(id, updates);
    if (!updatedAutomation) {
      return res.status(404).json({ success: false, error: 'Automation not found' });
    }
    
    console.log('Automation updated successfully:', updatedAutomation);
    res.json({ success: true, data: updatedAutomation });
  } catch (error) {
    console.error('Error updating automation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/automations/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const result = AutomationModel.delete(id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Automation not found' });
    }
    
    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting automation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Endpoints for logs
app.get('/api/logs', (req, res) => {
  try {
    const logs = LogModel.getAll();
    console.log(`Retrieved ${logs.length} logs from database at ${new Date().toISOString()}`);
    
    if (logs.length > 0) {
      console.log(`First log: ${logs[0].id} - ${logs[0].automationName}, status: ${logs[0].status}`);
    }
    
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Special endpoint for obtaining logs directly (no wrapper)
app.get('/api/logs-direct', (req, res) => {
  try {
    const logs = LogModel.getAll();
    console.log(`Retrieved ${logs.length} logs directly from database at ${new Date().toISOString()}`);
    
    // Return the logs array directly (no wrapper)
    res.json(logs);
  } catch (error) {
    console.error('Error retrieving direct logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add a new log entry
app.post('/api/logs', (req, res) => {
  try {
    const newLog = req.body;
    console.log(`Creating new log: ${newLog.id} - ${newLog.automationName}, status: ${newLog.status}`);
    
    // Make sure required fields are present
    if (!newLog.id || !newLog.automationId || !newLog.automationName || !newLog.status) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields (id, automationId, automationName, status)'
      });
    }
    
    // Create the log entry
    const logEntry = LogModel.create(newLog);
    
    if (!logEntry) {
      return res.status(500).json({ success: false, error: 'Failed to create log entry' });
    }
    
    console.log(`Successfully created log: ${logEntry.id}`);
    res.json({ success: true, data: logEntry });
    
  } catch (error) {
    console.error('Error creating log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/logs', (req, res) => {
  try {
    LogModel.clearAll();
    res.json({ success: true, message: 'All logs cleared' });
  } catch (error) {
    console.error('Error clearing logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Endpoints for settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = SettingModel.getAll();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const settings = req.body;
    const savedSettings = SettingModel.saveAll(settings);
    res.json({ success: true, data: savedSettings });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API Endpoint to delete an output file
app.delete('/api/outputs/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const result = OutputModel.delete(id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Output not found' });
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error deleting output:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// This API endpoint was duplicated and has been removed - using the one at the top of the file instead

// Test endpoint to add a test screenshot output to the database
app.get('/api/test-output', async (req, res) => {
  try {
    // First check if we need to insert a test automation for foreign key constraint
    let testAutomation;
    try {
      testAutomation = db.prepare('SELECT * FROM automations WHERE id = ?').get('test');
      if (!testAutomation) {
        console.log('[TEST] Creating test automation for foreign key constraint');
        db.prepare(`
          INSERT INTO automations (id, name, description, script, status, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          'test',
          'Test Automation',
          'Automation created for test purposes only',
          'function run() { return {}; }',
          'completed',
          new Date().toISOString(),
          new Date().toISOString()
        );
      }
    } catch (err) {
      console.error('[TEST] Error checking/creating test automation:', err);
      throw err;
    }

    // Create test screenshot data
    const timestamp = new Date().toISOString();
    const testScreenshotData = {
      title: "Test Screenshot",
      imageData: "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6QkJFMEQzQUVBMzA1MTFFQUJDRjVGQ0Y3ODBGRURFMEEiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6QkJFMEQzQUZBMzA1MTFFQUJDRjVGQ0Y3ODBGRURFMEEiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDpCQkUwRDNBQ0EzMDUxMUVBQkNGNUZDRjc4MEZFREUwQSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDpCQkUwRDNBREEzMDUxMUVBQkNGNUZDRjc4MEZFREUwQSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PjEnxp8AAAJNSURBVHja7JrpkRQxEEa3AwdgAjaADfhmAthgcQBsABtwAMEGsAEHQAYOePSPqZ5VSb34Ij3n1K5U6u7p8dbr0c9nWqZpukGvV0Ffgw3YgA3YgA3YgA24Q9LN5cfj8Xi9Xvf7/cVisd1uF/A+n8/H4/FyuVSSvu+Xy+VsNgP4cEjLf6/AbEzT6XQ4HJAXi8Vyuex7PBIBvt/vI5XL5XJd/nVdR0qoqRoJaZ0gVxhGVAZzaK/Xa4ArDOiIJMgT4IKNbkIrYOYFBtKqGo2Z40FKaJQ9AQamwkklEj5mzjKmkXIYuNFM4I8t1AOyIr6aHDhDUFaARwrIq51P1h2yQF7e9gRsDmxmqIzrmZCqawvKwnoqzNvtdjVHYjWPsFBJllqlAGbv5hF6r4V8kEpSNKm4DZdZYF594a4h68kPQlIQsm7HTAKfYZ8XHFR1OJrHOG5ydahlRdbOGfDuHlNSA85jmmH5qEpmDMCpP0jLjAasHRbI+0mGYWCkGXAq9OtUr6QLbGZ+ZklvgxRBqWQ3qqCxASdgZhYH5rAWDlzUrRswQJ72xgYcMO8sMDtSuY8l0tRu2ABTLyLqOIWCGADz91eEBRJ4nUK9ASdhZt0TG4X5MbdHUwZ2MbUK4zTJp5dqW9UKTCyUSmr9w1zSpXLgTPFsytXFTJtTptYHLnXKDXCjn7mcHOTygU3nQ9ydfpaJ1ZcMeMRfDnIGBe7k9lCrSbN/3A3YgA3YgA3YgA3YgM+lfwIMAEVcGaRWl3fhAAAAAElFTkSuQmCC", 
      format: "png",
      width: 100,
      height: 100,
      timestamp: timestamp
    };
    
    // Save to database - only screenshots as requested
    const savedOutput = OutputModel.saveOutput(
      'test',                              // automationId
      JSON.stringify(testScreenshotData),  // data
      'Test Screenshot ' + timestamp.substring(0, 10), // name
      'screenshot'                         // type - only saving screenshots
    );
    
    console.log('[TEST] Screenshot output saved to database with ID:', savedOutput.id);
    
    // Verify it's in the database
    const allOutputs = OutputModel.getAll();
    console.log(`[TEST] Database now has ${allOutputs.length} outputs`);
    
    res.json({
      success: true,
      message: 'Test screenshot output saved successfully',
      output: savedOutput,
      allOutputs: allOutputs.length
    });
  } catch (error) {
    console.error('[TEST] Error in test output endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cleanup endpoint - run as a scheduled task
app.post('/api/maintenance/cleanup', (req, res) => {
  try {
    // Get retention days from settings
    const settings = SettingModel.getAll();
    const keepOutputDays = settings.keepOutputDays || 7;
    
    // Clean up old outputs
    const result = OutputModel.cleanupOldOutputs(keepOutputDays);
    
    res.json({
      success: true,
      message: `Cleaned up ${result.deleted} old outputs`,
      data: result
    });
  } catch (error) {
    console.error('Error in cleanup maintenance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Immediately run cleanup to purge non-screenshot outputs
console.log('Cleaning up non-screenshot outputs on startup...');
try {
  const settings = SettingModel.getAll();
  const keepOutputDays = settings.keepOutputDays || 7;
  const result = OutputModel.cleanupOldOutputs(keepOutputDays);
  console.log(`Cleaned up ${result.deleted} outputs (${result.nonScreenshotsRemoved} non-screenshots and ${result.oldOutputsRemoved} old outputs)`);
} catch(error) {
  console.error('Error during initial cleanup:', error);
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Database initialized and ready`);
});