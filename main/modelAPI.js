/**
 * API service for calling AI models using OpenAI SDK
 */

const { OpenAI } = require('openai');
const logger = require('./logger');
const fileRequestHandler = require('./fileRequestHandler');
const fs = require('fs');
const path = require('path');

/**
 * Set up the model API handlers
 * @param {Object} ipcMain - The Electron ipcMain object
 */
function setupModelAPIHandlers(ipcMain) {
  // Initialize log session when app starts
  const logPath = logger.initLogSession();
  logger.debugLog(`Model API handler initialized. Logging to: ${logPath}`);
  
  ipcMain.handle('model:call', async (event, params) => {
    try {
      const { apiKey, model, prompt, temperature = 0.7, maxTokens = 2000, projectFolder } = params;
      
      // Validate required parameters
      if (!apiKey) {
        logger.debugLog('API call failed: Missing API key');
        throw new Error('Missing API key');
      }
      
      if (!model) {
        logger.debugLog('API call failed: Missing model name');
        throw new Error('Missing model name');
      }
      
      if (!prompt) {
        logger.debugLog('API call failed: Missing prompt');
        throw new Error('Missing prompt');
      }
      
      // Log the request (safely without the API key)
      logger.debugLog(`Making API call to model: ${model}`);
      logger.logRequest('model:call', {
        model,
        promptLength: prompt.length,
        temperature,
        maxTokens,
        apiKey: '***hidden***'
      });
      
      // Also log the full prompt separately
      logger.debugLog('Full prompt:');
      logger.debugLog(prompt);
      
      // Call the appropriate API based on model name
      let result;
      if (model.includes('deepseek')) {
        logger.debugLog('Using DeepSeek API');
        result = await callDeepSeekAPI(apiKey, model, prompt, temperature, maxTokens);
      } else {
        logger.debugLog('Using default DeepSeek API (no provider detected)');
        result = await callDeepSeekAPI(apiKey, model, prompt, temperature, maxTokens);
      }
      
      // Process the response to check for file requests
      if (result.success && result.text) {
        const filePathsRequested = fileRequestHandler.detectFileRequest(result.text);
        
        // If file request is detected and project folder is set
        if (filePathsRequested && projectFolder) {
          logger.debugLog(`Processing file request for ${filePathsRequested.length} files`);
          
          // Get the file contents
          const fileContents = await fileRequestHandler.processFileRequest(
            filePathsRequested, 
            projectFolder
          );
          
          // Format file contents for adding to context
          const formattedFileContents = fileRequestHandler.formatFileContents(fileContents);
          
          // Add the original AI response and the file contents as metadata
          result.fileRequest = {
            originalResponse: result.text,
            requestedFiles: filePathsRequested,
            fileContents: fileContents
          };
          
          // Update the response text to include file contents
          // Remove the file request JSON from the response
          const cleanResponse = result.text.replace(/\{"files":\s*\[(.*?)\]\}/, '');
          result.text = cleanResponse + formattedFileContents;
        }
      }
      
      // Log the response
      logger.debugLog('Received API response');
      logger.logResponse('model:call', {
        success: result.success,
        textLength: result.text ? result.text.length : 0
      });
      
      // Log the full response text separately
      logger.debugLog('Full response text:');
      logger.debugLog(result.text || 'No text in response');
      
      return result;
      
    } catch (error) {
      logger.logError('model:call', error);
      logger.debugLog(`API call error: ${error.message}`);
      console.error('Error calling model API:', error);
      return { 
        error: error.message || 'Failed to call model API',
        success: false 
      };
    }
  });
  
  // Endpoint to get the log file path
  ipcMain.handle('logs:getPath', () => {
    const path = logger.getSessionLogPath();
    logger.debugLog(`Log path requested: ${path}`);
    return path;
  });
}

/**
 * Call the DeepSeek API using OpenAI SDK
 * @param {string} apiKey - The API key
 * @param {string} model - The model name
 * @param {string} prompt - The prompt text
 * @param {number} temperature - Temperature setting
 * @param {number} maxTokens - Maximum tokens to generate
 * @returns {Object} The API response
 */
async function callDeepSeekAPI(apiKey, model, prompt, temperature, maxTokens) {
  try {
    logger.debugLog('Starting DeepSeek API call');
    
    // Prepare model name (remove provider prefix if present)
    const modelName = model.includes('/') ? model.split('/')[1] : model;
    logger.debugLog(`Using model name: ${modelName}`);
    
    // Initialize OpenAI client with DeepSeek baseURL
    const openai = new OpenAI({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: apiKey
    });
    
    logger.debugLog('OpenAI client initialized with DeepSeek baseURL');
    logger.debugLog(`Requesting with temperature: ${temperature}, max_tokens: ${maxTokens}`);
    
    // Make API call
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
      max_tokens: maxTokens
    });
    
    logger.debugLog('API call completed successfully');
    
    // Extract response text
    const text = completion.choices[0]?.message?.content;
    
    if (!text) {
      logger.debugLog('Warning: No text content in response');
    } else {
      logger.debugLog(`Response text length: ${text.length} characters`);
    }
    
    // Log usage information if available
    if (completion.usage) {
      logger.debugLog(`Token usage: ${JSON.stringify(completion.usage)}`);
    }
    
    return { success: true, text };
    
  } catch (error) {
    logger.logError('deepseek:call', error);
    logger.debugLog(`DeepSeek API error: ${error.message}`);
    
    if (error.response) {
      logger.debugLog(`Response error data: ${JSON.stringify(error.response.data || {})}`);
    }
    
    console.error('DeepSeek API error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Failed to call DeepSeek API');
  }
}

module.exports = {
  setupModelAPIHandlers
};