/**
 * Service for handling conversation with AI assistant for task help
 */

import { getCurrentGlobalContext } from './contextService.js';
import { getCurrentTasksData, getTaskById } from './taskService.js';
import { getSetting } from './settingsService.js';

// Conversation history for the current task
let conversationHistory = [];

/**
 * Start a new conversation for a task
 * @param {string} taskId - The ID of the task to start a conversation for
 * @returns {Promise<string>} - The initial assistant message
 */
export async function startTaskConversation(taskId) {
  try {
    // Reset conversation history
    conversationHistory = [];
    
    // Get the task details
    const task = getTaskById(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    // Get global context
    const globalContext = getCurrentGlobalContext();
    
    // Get the current tasks list for context
    const tasksData = getCurrentTasksData();
    
    // Create the initial system message with all context
    const initialPrompt = {
      role: "user",
      content: `
I need help completing the following task:

TASK: ${task.title}
DESCRIPTION: ${task.description}
SECTION: ${task.sectionTitle}

Here is the overall project context:
${globalContext}

Here is the full task breakdown for the project:
${JSON.stringify(tasksData, null, 2)}

Please help me complete this specific task. Provide a comprehensive and clear solution based on the information available. 
Assume your initial solution might need refinement, and encourage me to test your code or proofread your suggestions.
Ask for my feedback after providing your solution.`
    };
    
    // Add to conversation history
    conversationHistory.push(initialPrompt);
    
    // Get the AI response
    const response = await getAssistantResponse();
    
    // Return just the message content
    return response.content;
    
  } catch (error) {
    console.error('Error starting task conversation:', error);
    return `I'm sorry, I encountered an error starting our conversation: ${error.message}`;
  }
}

/**
 * Send a user message and get a response
 * @param {string} message - The user's message
 * @returns {Promise<string>} - The assistant's response
 */
export async function sendMessageService(message) {
  try {
    // Add user message to history
    conversationHistory.push({
      role: "user",
      content: message
    });
    
    // Get the AI response
    const response = await getAssistantResponse();
    
    // Return just the message content
    return response.content;
    
  } catch (error) {
    console.error('Error sending message:', error);
    return `I'm sorry, I encountered an error processing your message: ${error.message}`;
  }
}

/**
 * Get a response from the AI assistant based on conversation history
 * @returns {Promise<Object>} - The assistant's response message object
 */
async function getAssistantResponse() {
  try {
    // Get API settings
    const apiKey = await getSetting('apiKey');
    const model = await getSetting('model', 'deepseek/deepseek-chat-v3-0324:free');
    
    if (!apiKey) {
      throw new Error('API key not set. Please configure it in Settings.');
    }
    
    // Prepare the prompt as a string representation of the conversation
    let prompt = '';
    conversationHistory.forEach(message => {
      prompt += `${message.role.toUpperCase()}: ${message.content}\n\n`;
    });
    
    // Add the assistant prefix for the response
    prompt += 'ASSISTANT: ';
    
    // Call the API
    const response = await window.electronAPI.settings.callModel({
      apiKey,
      model,
      prompt,
      temperature: 0.7, // Slightly higher temperature for more creative responses
      maxTokens: 2000
    });
    
    if (!response || !response.text) {
      throw new Error('Invalid response from model');
    }
    
    // Create the assistant message object
    const assistantMessage = {
      role: "assistant",
      content: response.text.trim()
    };
    
    // Add to conversation history
    conversationHistory.push(assistantMessage);
    
    return assistantMessage;
    
  } catch (error) {
    console.error('Error getting assistant response:', error);
    throw error;
  }
}

/**
 * Get the current conversation history
 * @returns {Array} - The conversation history
 */
export function getConversationHistory() {
  return [...conversationHistory];
}

/**
 * Clear the current conversation history
 */
export function clearConversationHistory() {
  conversationHistory = [];
}