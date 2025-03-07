const db = require('../database');

// Settings model with CRUD operations
const SettingModel = {
  // Get all settings
  getAll: () => {
    const settings = db.prepare('SELECT * FROM settings').all();
    
    // Convert to object format
    return settings.reduce((obj, setting) => {
      // Handle boolean and number conversions
      let value = setting.value;
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(value) && value.trim() !== '') value = Number(value);
      
      obj[setting.key] = value;
      return obj;
    }, {});
  },

  // Get setting by key
  getByKey: (key) => {
    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);
    if (!setting) return null;
    
    // Handle boolean and number conversions
    let value = setting.value;
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (!isNaN(value) && value.trim() !== '') value = Number(value);
    
    return { key: setting.key, value };
  },

  // Save all settings from an object
  saveAll: (settings) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    
    // Start a transaction
    const transaction = db.transaction((settingsObj) => {
      for (const [key, value] of Object.entries(settingsObj)) {
        // Convert values to strings for storage
        let strValue = String(value);
        stmt.run(key, strValue);
      }
    });
    
    transaction(settings);
    return SettingModel.getAll();
  },

  // Update a single setting
  update: (key, value) => {
    // Convert value to string for storage
    let strValue = String(value);
    
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, strValue);
    return SettingModel.getByKey(key);
  }
};

module.exports = SettingModel;