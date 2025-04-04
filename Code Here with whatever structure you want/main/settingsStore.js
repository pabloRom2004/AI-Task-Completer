// src/main/settingsStore.js
const path = require('path');
const fs = require('fs').promises;
const electron = require('electron');

// Get user data path for storing settings
const userDataPath = (electron.app || electron.remote.app).getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');

// Store settings in a file
async function saveSettings(settings) {
  try {
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    return { success: false, error: error.message };
  }
}

// Load settings from file
async function getSettings() {
  try {
    const data = await fs.readFile(settingsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return defaults
    if (error.code === 'ENOENT') {
      return {
        apiKey: '',
        model: 'deepseek/deepseek-chat-v3-0324:free'
      };
    }
    console.error('Error loading settings:', error);
    throw error;
  }
}

module.exports = {
  saveSettings,
  getSettings
};