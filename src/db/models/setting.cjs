const db = require('../database.cjs');

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
    
    try {
      // Start a transaction
      const transaction = db.transaction((settingsObj) => {
        for (const [key, value] of Object.entries(settingsObj)) {
          // Convert values to strings for storage
          let strValue = String(value);
          console.log(`Saving setting: ${key} = ${strValue}`);
          stmt.run(key, strValue);
        }
      });
      
      transaction(settings);
      
      // Verify settings were saved
      const savedSettings = SettingModel.getAll();
      console.log('Saved settings:', savedSettings);
      return savedSettings;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
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