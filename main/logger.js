/**
 * Logger utility for API interactions
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Log directory
let LOG_DIR;
try {
  // Make sure we can access the user data path
  LOG_DIR = path.join(app.getPath('userData'), 'logs');
} catch (error) {
  // Fallback to temp directory if app.getPath fails
  LOG_DIR = path.join(require('os').tmpdir(), 'do-way-more-logs');
  console.error('Error accessing app user data path, using temp dir:', LOG_DIR);
}

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log('Created log directory:', LOG_DIR);
  }
} catch (error) {
  console.error('Failed to create log directory:', error);
}

// Current session log file
let currentSessionLog = null;

/**
 * Initialize a new log session
 * @returns {string} Path to the log file
 */
function initLogSession() {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '_');
    const logFileName = `session_${timestamp}.txt`;
    currentSessionLog = path.join(LOG_DIR, logFileName);
    
    // Create log file with header
    const header = `=== API INTERACTION LOG ===\nSession started: ${new Date().toLocaleString()}\n\n`;
    fs.writeFileSync(currentSessionLog, header);
    
    console.log('Log session initialized:', currentSessionLog);
    return currentSessionLog;
  } catch (error) {
    console.error('Failed to initialize log session:', error);
    return null;
  }
}

/**
 * Log an API request with full prompt
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Request parameters
 */
function logRequest(endpoint, params) {
  try {
    if (!currentSessionLog) {
      initLogSession();
    }
    
    const timestamp = new Date().toLocaleString();
    const logEntry = [
      `\n=== REQUEST [${timestamp}] ===`,
      `Endpoint: ${endpoint}`,
      'Parameters:',
      JSON.stringify(params, (key, value) => {
        // Don't log API key in clear text
        if (key === 'apiKey') return '***API_KEY***';
        return value;
      }, 2),
      '\nFull Prompt:',
      params.prompt || 'No prompt provided',
      '\n'
    ].join('\n');
    
    fs.appendFileSync(currentSessionLog, logEntry);
    console.log(`Logged request to ${endpoint}`);
  } catch (error) {
    console.error('Error logging request:', error);
  }
}

/**
 * Log an API response
 * @param {string} endpoint - API endpoint
 * @param {Object} response - Response data
 */
function logResponse(endpoint, response) {
  try {
    if (!currentSessionLog) {
      initLogSession();
    }
    
    const timestamp = new Date().toLocaleString();
    const logEntry = [
      `\n=== RESPONSE [${timestamp}] ===`,
      `Endpoint: ${endpoint}`,
      'Response:',
      typeof response === 'object' ? JSON.stringify(response, null, 2) : response,
      '\nFull Text:',
      response.text || 'No text in response',
      '\n=== END RESPONSE ===\n'
    ].join('\n');
    
    fs.appendFileSync(currentSessionLog, logEntry);
    console.log(`Logged response from ${endpoint}`);
  } catch (error) {
    console.error('Error logging response:', error);
  }
}

/**
 * Log an error
 * @param {string} context - Error context
 * @param {Error} error - Error object
 */
function logError(context, error) {
  try {
    if (!currentSessionLog) {
      initLogSession();
    }
    
    const timestamp = new Date().toLocaleString();
    const logEntry = [
      `\n=== ERROR [${timestamp}] ===`,
      `Context: ${context}`,
      `Message: ${error.message}`,
      'Stack:',
      error.stack || 'No stack trace',
      '\n'
    ].join('\n');
    
    fs.appendFileSync(currentSessionLog, logEntry);
    console.log(`Logged error in ${context}`);
  } catch (logError) {
    console.error('Error logging error:', logError);
  }
}

/**
 * Get path to current session log
 * @returns {string|null} Path to log file or null if not initialized
 */
function getSessionLogPath() {
  return currentSessionLog;
}

/**
 * Simple direct logging for debugging
 * @param {string} message - The message to log
 */
function debugLog(message) {
  try {
    if (!currentSessionLog) {
      initLogSession();
    }
    
    const timestamp = new Date().toLocaleString();
    const logEntry = `\n[DEBUG ${timestamp}] ${message}\n`;
    
    fs.appendFileSync(currentSessionLog, logEntry);
  } catch (error) {
    console.error('Error writing debug log:', error);
  }
}

module.exports = {
  initLogSession,
  logRequest,
  logResponse,
  logError,
  getSessionLogPath,
  debugLog
};