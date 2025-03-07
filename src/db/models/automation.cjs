const db = require('../database.cjs');

// Automations model with CRUD operations
const AutomationModel = {
  // Get all automations
  getAll: () => {
    return db.prepare('SELECT * FROM automations ORDER BY updatedAt DESC').all();
  },

  // Get automation by ID
  getById: (id) => {
    return db.prepare('SELECT * FROM automations WHERE id = ?').get(id);
  },

  // Create new automation
  create: (automation) => {
    console.log(`Creating automation in database:`, automation.id, automation.name);
    
    try {
      const stmt = db.prepare(`
        INSERT INTO automations (id, name, description, script, status, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        automation.id,
        automation.name,
        automation.description || '',
        automation.script,
        automation.status || 'idle',
        automation.createdAt,
        automation.updatedAt
      );
      
      console.log(`Database insert result:`, result);
      
      const created = AutomationModel.getById(automation.id);
      console.log(`Retrieved created automation:`, created);
      return created;
    } catch (error) {
      console.error(`Error creating automation in database:`, error);
      throw error;
    }
  },

  // Update automation
  update: (id, updates) => {
    console.log(`Updating automation in database. ID: ${id}, Updates:`, updates);
    
    try {
      // First get the existing automation
      const existing = AutomationModel.getById(id);
      if (!existing) {
        console.log(`Automation with ID ${id} not found for update`);
        return null;
      }
      
      console.log(`Found existing automation:`, existing);

      // Create an updated object
      const updatedAutomation = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      console.log(`Merged automation object:`, updatedAutomation);

      // Update the record
      const stmt = db.prepare(`
        UPDATE automations 
        SET name = ?, description = ?, script = ?, status = ?, updatedAt = ?
        WHERE id = ?
      `);
      
      const result = stmt.run(
        updatedAutomation.name,
        updatedAutomation.description,
        updatedAutomation.script,
        updatedAutomation.status,
        updatedAutomation.updatedAt,
        id
      );
      
      console.log(`Database update result:`, result);
      
      const updated = AutomationModel.getById(id);
      console.log(`Retrieved updated automation:`, updated);
      return updated;
    } catch (error) {
      console.error(`Error updating automation in database:`, error);
      throw error;
    }
  },

  // Delete automation
  delete: (id) => {
    const existing = AutomationModel.getById(id);
    if (!existing) {
      return null;
    }
    
    db.prepare('DELETE FROM automations WHERE id = ?').run(id);
    return { id };
  },

  // Update automation status
  updateStatus: (id, status) => {
    console.log(`Updating automation ${id} status to ${status}`);
    
    try {
      const stmt = db.prepare(`
        UPDATE automations
        SET status = ?, updatedAt = ?
        WHERE id = ?
      `);
      
      stmt.run(
        status,
        new Date().toISOString(),
        id
      );
      
      const updated = AutomationModel.getById(id);
      console.log(`Updated automation status successfully:`, updated);
      return updated;
    } catch (error) {
      console.error(`Error updating automation status:`, error);
      throw error;
    }
  }
};

module.exports = AutomationModel;