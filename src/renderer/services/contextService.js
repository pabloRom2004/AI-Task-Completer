/**
 * Service for generating and managing the global context
 */

import { contextPromptTemplate } from '../data/contextPrompt.js';
import { getSetting } from './settingsService.js';

// Cache for the current global context
let currentGlobalContext = '';

/**
 * Generate a global context document from task and clarification
 * @param {string} taskDescription - The original task description
 * @param {Array} clarificationConversation - The clarification Q&A pairs
 * @returns {Promise<string>} The generated global context
 */
export async function generateGlobalContext(taskDescription, clarificationConversation) {
  try {
    // Format the clarification conversation
    const formattedConversation = formatClarificationConversation(clarificationConversation);
    
    // Replace placeholders in template
    const prompt = contextPromptTemplate
      .replace('{taskDescription}', taskDescription)
      .replace('{clarificationConversation}', formattedConversation);
    
    // Get API settings
    const apiKey = await getSetting('apiKey');
    const model = await getSetting('model', 'deepseek/deepseek-chat-v3-0324:free');
    
    if (!apiKey) {
      throw new Error('API key not set. Please configure it in Settings.');
    }
    
    console.log('Generating global context...');
    
    // Call the API
    const response = await window.electronAPI.settings.callModel({
      apiKey,
      model,
      prompt,
      temperature: 0.0,
      maxTokens: 2000
    });
    
    if (!response || !response.text) {
      throw new Error('Invalid response from model');
    }
    
    // Store and return the context
    currentGlobalContext = response.text;
    return currentGlobalContext;
    
  } catch (error) {
    console.error('Error generating global context:', error);
    throw error;
  }
}

/**
 * Format the clarification conversation for inclusion in the prompt
 * @param {Array} conversation - Array of question-answer pairs
 * @returns {string} Formatted conversation text
 */
function formatClarificationConversation(conversation) {
  if (!Array.isArray(conversation) || conversation.length === 0) {
    return 'No clarification questions were needed.';
  }
  
  return conversation.map((exchange, index) => 
    `Question ${index + 1}: ${exchange.question}\nAnswer ${index + 1}: ${exchange.answer}`
  ).join('\n\n');
}

/**
 * Get the current global context
 * @returns {string} The current global context
 */
export function getCurrentGlobalContext() {
  return currentGlobalContext;
}

/**
 * Set the global context directly
 * @param {string} context - The global context to set
 */
export function setGlobalContext(context) {
  currentGlobalContext = context;
}