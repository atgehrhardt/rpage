const db = require('../database');

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
    const stmt = db.prepare(`
      INSERT INTO automations (id, name, description, script, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      automation.id,
      automation.name,
      automation.description || '',
      automation.script,
      automation.status || 'idle',
      automation.createdAt,
      automation.updatedAt
    );
    
    return AutomationModel.getById(automation.id);
  },

  // Update automation
  update: (id, updates) => {
    // First get the existing automation
    const existing = AutomationModel.getById(id);
    if (!existing) {
      return null;
    }

    // Create an updated object
    const updatedAutomation = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Update the record
    const stmt = db.prepare(`
      UPDATE automations 
      SET name = ?, description = ?, script = ?, status = ?, updatedAt = ?
      WHERE id = ?
    `);
    
    stmt.run(
      updatedAutomation.name,
      updatedAutomation.description,
      updatedAutomation.script,
      updatedAutomation.status,
      updatedAutomation.updatedAt,
      id
    );
    
    return AutomationModel.getById(id);
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
  updateStatus: (id, status, output) => {
    const stmt = db.prepare(`
      UPDATE automations
      SET status = ?, output = ?, updatedAt = ?
      WHERE id = ?
    `);
    
    stmt.run(
      status,
      output || '',
      new Date().toISOString(),
      id
    );
    
    return AutomationModel.getById(id);
  }
};

module.exports = AutomationModel;