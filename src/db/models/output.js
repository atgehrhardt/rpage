const db = require('../database');
const path = require('path');
const fs = require('fs');

// Create outputs directory if it doesn't exist
const outputsDir = path.join(__dirname, '..', '..', '..', 'data', 'outputs');
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

// Outputs model with CRUD operations
const OutputModel = {
  // Get all outputs
  getAll: () => {
    return db.prepare('SELECT * FROM outputs ORDER BY timestamp DESC').all();
  },

  // Get output by ID
  getById: (id) => {
    return db.prepare('SELECT * FROM outputs WHERE id = ?').get(id);
  },

  // Get outputs by automation ID
  getByAutomationId: (automationId) => {
    return db.prepare('SELECT * FROM outputs WHERE automationId = ? ORDER BY timestamp DESC').all(automationId);
  },

  // Get outputs by type
  getByType: (type) => {
    return db.prepare('SELECT * FROM outputs WHERE type = ? ORDER BY timestamp DESC').all(type);
  },

  // Create new output
  create: (output) => {
    console.log(`Creating new output:`, output.id, output.name);
    
    try {
      const stmt = db.prepare(`
        INSERT INTO outputs (id, automationId, name, type, data, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        output.id,
        output.automationId,
        output.name,
        output.type,
        output.data,
        output.timestamp
      );
      
      const newOutput = OutputModel.getById(output.id);
      console.log(`Successfully created output:`, newOutput.id, newOutput.name);
      return newOutput;
    } catch (error) {
      console.error(`Error creating output:`, error);
      throw error;
    }
  },

  // Delete output
  delete: (id) => {
    // Get the output record first
    const output = OutputModel.getById(id);
    if (!output) {
      return null;
    }
    
    // Delete the database record
    db.prepare('DELETE FROM outputs WHERE id = ?').run(id);
    return { id };
  },

  // Save data output directly to the database
  saveOutput: (automationId, data, name, type = 'text') => {
    console.log(`Saving output for automation ${automationId}: ${name} (type: ${type})`);
    
    try {
      // Make sure we have a string for data
      let dataString = data;
      
      if (typeof data !== 'string') {
        try {
          dataString = JSON.stringify(data);
          console.log(`Successfully converted data object to JSON string`);
        } catch (err) {
          console.error(`Failed to convert data to string: ${err.message}`);
          dataString = String(data); // Fallback
        }
      }
      
      // Create a database record with the data
      const output = {
        id: Date.now().toString(),
        automationId,
        name,
        type,
        data: dataString,
        timestamp: new Date().toISOString()
      };
      
      console.log(`Attempting to save output record for ${name} with ID ${output.id}`);
      const savedOutput = OutputModel.create(output);
      console.log(`Output entry saved to database: ${savedOutput.id} - ${savedOutput.name}`);
      return savedOutput;
    } catch (error) {
      console.error(`Error saving output to database:`, error);
      console.error(error.stack);
      return null; // Return null instead of throwing to prevent execution from stopping
    }
  },

  // Clean up old outputs based on retention days
  cleanupOldOutputs: (days) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffTimestamp = cutoffDate.toISOString();
    
    // Get outputs to delete
    const outputsToDelete = db.prepare('SELECT * FROM outputs WHERE timestamp < ?').all(cutoffTimestamp);
    
    // Delete each output record
    let deletedCount = 0;
    outputsToDelete.forEach(output => {
      try {
        OutputModel.delete(output.id);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting output ${output.id}:`, error);
      }
    });
    
    return { deleted: deletedCount };
  },

  // Get outputs directory path
  getOutputsDir: () => outputsDir
};

module.exports = OutputModel;