/**
 * Settings manager for main process
 * Handles storage and retrieval of application settings
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Default settings
const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'deepseek/deepseek-chat-v3-0324:free'
};

// Settings file path
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

/**
 * Load settings from disk
 * @returns {Object} The settings object
 */
function loadSettings() {
  try {
    // Check if settings file exists
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
  
  // Return default settings if loading fails
  return { ...DEFAULT_SETTINGS };
}

/**
 * Save settings to disk
 * @param {Object} settings - The settings to save
 * @returns {boolean} Success or failure
 */
function saveSettings(settings) {
  try {
    // Merge with defaults to ensure all required fields exist
    const updatedSettings = { ...DEFAULT_SETTINGS, ...settings };
    
    // Write to file
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updatedSettings, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
}

/**
 * Update specific settings
 * @param {Object} updatedSettings - Settings to update
 * @returns {Object} The complete updated settings
 */
function updateSettings(updatedSettings) {
  const currentSettings = loadSettings();
  const newSettings = { ...currentSettings, ...updatedSettings };
  
  if (saveSettings(newSettings)) {
    return newSettings;
  }
  
  return currentSettings;
}

// Set up IPC handlers for settings
function setupSettingsHandlers(ipcMain) {
  // Get all settings
  ipcMain.handle('settings:get', () => {
    return loadSettings();
  });
  
  // Save settings
  ipcMain.handle('settings:save', (event, settings) => {
    const success = saveSettings(settings);
    return { success, settings: loadSettings() };
  });
  
  // Update specific settings
  ipcMain.handle('settings:update', (event, settings) => {
    const updatedSettings = updateSettings(settings);
    return { success: true, settings: updatedSettings };
  });
}

module.exports = {
  loadSettings,
  saveSettings,
  updateSettings,
  setupSettingsHandlers
};