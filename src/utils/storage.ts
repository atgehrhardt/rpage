import type { Automation } from '../types';
import { fetchAPI } from './api';

const API_BASE_URL = 'http://localhost:3001/api';

// Automations storage with API
export const saveAutomations = async (automations: Automation[]): Promise<void> => {
  try {
    // In production, we only need to update modified automations
    // The server handles persistence to the database
    for (const automation of automations) {
      try {
        // Check if automation exists in the database
        const existingResponse = await fetchAPI(`/automations/${automation.id}`);
        if (existingResponse.success && existingResponse.data) {
          // Update existing automation
          await fetchAPI(`/automations/${automation.id}`, {
            method: 'PUT',
            body: JSON.stringify(automation),
          });
        } else {
          // Create new automation
          await fetchAPI(`/automations`, {
            method: 'POST',
            body: JSON.stringify(automation),
          });
        }
      } catch (err) {
        console.warn(`Failed to save automation ${automation.id} to API`, err);
      }
    }
  } catch (error) {
    console.error('Error saving automations:', error);
  }
};

export const loadAutomations = async (): Promise<Automation[]> => {
  try {
    const response = await fetchAPI('/automations');
    if (response.success && Array.isArray(response.data)) {
      return response.data;
    }
  } catch (error) {
    console.error('Error loading automations:', error);
  }
  return [];
};

// Settings storage with API
export const saveSettings = async (settings: any): Promise<void> => {
  try {
    // Save settings to API
    await fetchAPI('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
    
    // Also save to localStorage for persistent theme between server connections
    try {
      localStorage.setItem('rpage-settings', JSON.stringify(settings));
    } catch (localStorageError) {
      console.warn('Could not save settings to localStorage:', localStorageError);
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    
    // Still try to save to localStorage even if API fails
    try {
      localStorage.setItem('rpage-settings', JSON.stringify(settings));
    } catch (localStorageError) {
      console.warn('Could not save settings to localStorage:', localStorageError);
    }
  }
};

export const loadSettings = async (): Promise<any> => {
  // First try to get settings from localStorage for immediate UI response
  try {
    const localSettings = localStorage.getItem('rpage-settings');
    if (localSettings) {
      const parsedSettings = JSON.parse(localSettings);
      console.log('Loaded settings from localStorage:', parsedSettings);
      
      // Still attempt to load from API for latest settings, but return localStorage first
      loadSettingsFromAPI().catch(err => console.warn('Background settings load failed:', err));
      
      return parsedSettings;
    }
  } catch (localStorageError) {
    console.warn('Error reading from localStorage:', localStorageError);
  }
  
  // If localStorage fails, try API
  try {
    const response = await fetchAPI('/settings');
    if (response.success && response.data) {
      // Save to localStorage for future use
      try {
        localStorage.setItem('rpage-settings', JSON.stringify(response.data));
      } catch (err) {
        console.warn('Failed to save API settings to localStorage:', err);
      }
      
      return response.data;
    }
  } catch (error) {
    console.error('Error loading settings from API:', error);
  }
  
  // Default settings if all else fails
  const defaultSettings = {
    notificationsEnabled: true,
    darkTheme: true,
    keepOutputDays: 7
  };
  
  // Try to save defaults to localStorage
  try {
    localStorage.setItem('rpage-settings', JSON.stringify(defaultSettings));
  } catch (err) {
    console.warn('Failed to save default settings to localStorage:', err);
  }
  
  return defaultSettings;
};

// Helper function to load settings from API in the background
async function loadSettingsFromAPI(): Promise<void> {
  try {
    const response = await fetchAPI('/settings');
    if (response.success && response.data) {
      // Update localStorage with latest settings
      localStorage.setItem('rpage-settings', JSON.stringify(response.data));
    }
  } catch (error) {
    console.error('Background settings refresh failed:', error);
    throw error;
  }
}