/**
 * Settings service for the renderer process
 * Provides a clean API for accessing and modifying settings
 */

// In-memory cache of settings
let settingsCache = null;

/**
 * Get all settings
 * @returns {Promise<Object>} The settings object
 */
export async function getSettings() {
  // Use cache if available
  if (settingsCache) {
    return settingsCache;
  }
  
  try {
    // Fetch settings from main process
    settingsCache = await window.electronAPI.settings.getAll();
    return settingsCache;
  } catch (error) {
    console.error('Error getting settings:', error);
    return { apiKey: '', model: 'deepseek/deepseek-chat-v3-0324:free' };
  }
}

/**
 * Save all settings
 * @param {Object} settings - The settings to save
 * @returns {Promise<Object>} Result with success status
 */
export async function saveSettings(settings) {
  try {
    const result = await window.electronAPI.settings.save(settings);
    if (result.success) {
      // Update cache
      settingsCache = result.settings;
    }
    return result;
  } catch (error) {
    console.error('Error saving settings:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update specific settings
 * @param {Object} updates - The settings to update
 * @returns {Promise<Object>} Result with success status and updated settings
 */
export async function updateSettings(updates) {
  try {
    const result = await window.electronAPI.settings.update(updates);
    if (result.success) {
      // Update cache
      settingsCache = result.settings;
    }
    return result;
  } catch (error) {
    console.error('Error updating settings:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get a specific setting value
 * @param {string} key - The setting key
 * @param {any} defaultValue - Default value if setting doesn't exist
 * @returns {Promise<any>} The setting value
 */
export async function getSetting(key, defaultValue = null) {
  const settings = await getSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

/**
 * Update a single setting
 * @param {string} key - The setting key
 * @param {any} value - The new value
 * @returns {Promise<Object>} Result with success status
 */
export async function setSetting(key, value) {
  const update = { [key]: value };
  return updateSettings(update);
}

/**
 * Load settings into form elements
 * @param {string} apiKeyElementId - ID of API key input element
 * @param {string} modelElementId - ID of model selection element
 */
export async function loadSettingsIntoForm(apiKeyElementId = 'settingsApiKey', modelElementId = 'modelInput') {
  const settings = await getSettings();
  
  const apiKeyElement = document.getElementById(apiKeyElementId);
  const modelElement = document.getElementById(modelElementId);
  
  if (apiKeyElement && settings.apiKey !== undefined) {
    apiKeyElement.value = settings.apiKey;
  }
  
  if (modelElement && settings.model !== undefined) {
    modelElement.value = settings.model;
  }
}

/**
 * Save settings from form elements
 * @param {string} apiKeyElementId - ID of API key input element
 * @param {string} modelElementId - ID of model selection element
 */
export async function saveSettingsFromForm(apiKeyElementId = 'settingsApiKey', modelElementId = 'modelInput') {
  const apiKeyElement = document.getElementById(apiKeyElementId);
  const modelElement = document.getElementById(modelElementId);
  
  const updates = {};
  
  if (apiKeyElement) {
    updates.apiKey = apiKeyElement.value.trim();
  }
  
  if (modelElement) {
    updates.model = modelElement.value.trim() || 'deepseek/deepseek-chat-v3-0324:free';
  }
  
  return updateSettings(updates);
}

/**
 * Initialize settings form with autosave capability
 * @param {string} apiKeyElementId - ID of API key input element
 * @param {string} modelElementId - ID of model selection element
 */
export function initSettingsForm(apiKeyElementId = 'settingsApiKey', modelElementId = 'modelInput') {
  // Load initial values
  loadSettingsIntoForm(apiKeyElementId, modelElementId);
  
  // Set up autosave on blur
  const apiKeyElement = document.getElementById(apiKeyElementId);
  const modelElement = document.getElementById(modelElementId);
  
  if (apiKeyElement) {
    apiKeyElement.addEventListener('blur', () => {
      setSetting('apiKey', apiKeyElement.value.trim());
    });
  }
  
  if (modelElement) {
    modelElement.addEventListener('blur', () => {
      setSetting('model', modelElement.value.trim() || 'deepseek/deepseek-chat-v3-0324:free');
    });
  }
}