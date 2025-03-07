const db = require('../database');

// Logs model with CRUD operations
const LogModel = {
  // Get all logs
  getAll: () => {
    return db.prepare('SELECT * FROM logs ORDER BY timestamp DESC').all();
  },

  // Get log by ID
  getById: (id) => {
    return db.prepare('SELECT * FROM logs WHERE id = ?').get(id);
  },

  // Get logs by automation ID
  getByAutomationId: (automationId) => {
    return db.prepare('SELECT * FROM logs WHERE automationId = ? ORDER BY timestamp DESC').all(automationId);
  },

  // Create new log
  create: (log) => {
    const stmt = db.prepare(`
      INSERT INTO logs (id, automationId, automationName, status, output, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      log.id,
      log.automationId,
      log.automationName,
      log.status,
      log.output || '',
      log.timestamp
    );
    
    return LogModel.getById(log.id);
  },

  // Delete log
  delete: (id) => {
    const existing = LogModel.getById(id);
    if (!existing) {
      return null;
    }
    
    db.prepare('DELETE FROM logs WHERE id = ?').run(id);
    return { id };
  },

  // Clear all logs
  clearAll: () => {
    db.prepare('DELETE FROM logs').run();
    return { success: true };
  }
};

module.exports = LogModel;