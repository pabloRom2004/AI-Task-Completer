/**
 * Service for generating and managing tasks
 */

import { taskBreakdownPromptTemplate } from '../data/taskBreakdownPrompt.js';
import { getCurrentGlobalContext } from './contextService.js';
import { getSetting } from './settingsService.js';
import { isTestModeEnabled, getSimulatedTaskBreakdown } from './testMode.js';

// Cache for current tasks data
let currentTasksData = null;

/**
 * Generate task breakdown from global context
 * @returns {Promise<Object>} The generated tasks object
 */
export async function generateTaskBreakdown() {
  try {

    if (isTestModeEnabled()) {
      console.log('Test mode enabled, using simulated task breakdown');
      currentTasksData = getSimulatedTaskBreakdown()
      return currentTasksData;
    }

    // Get the global context
    const globalContext = getCurrentGlobalContext();
    if (!globalContext) {
      throw new Error('Global context not available');
    }
    
    // Replace placeholders in template
    const prompt = taskBreakdownPromptTemplate
      .replace('{globalContext}', globalContext);
    
    // Get API settings
    const apiKey = await getSetting('apiKey');
    const model = await getSetting('model', 'deepseek/deepseek-chat-v3-0324:free');
    
    if (!apiKey) {
      throw new Error('API key not set. Please configure it in Settings.');
    }
    
    console.log('Generating task breakdown...');
    
    // Call the API
    const response = await window.electronAPI.settings.callModel({
      apiKey,
      model,
      prompt,
      temperature: 0.0,
      maxTokens: 3000 // Increased token limit for larger task lists
    });
    
    if (!response || !response.text) {
      throw new Error('Invalid response from model');
    }
    
    // Extract JSON from the response
    const tasksData = extractJSON(response.text);
    if (!tasksData) {
      throw new Error('Could not parse tasks data from response');
    }
    
    // Validate task data structure
    validateTasksData(tasksData);
    
    // Store and return the tasks
    currentTasksData = tasksData;
    return currentTasksData;
    
  } catch (error) {
    console.error('Error generating task breakdown:', error);
    throw error;
  }
}

/**
 * Extract JSON from the model's response
 * @param {string} response - The full model response
 * @returns {Object|null} Parsed JSON or null if invalid
 */
function extractJSON(response) {
  try {
    // Strip any markdown code block markers if they exist
    let cleanResponse = response;
    if (response.includes('```json')) {
      cleanResponse = response.replace(/```json\n|\n```/g, '');
    } else if (response.includes('```')) {
      cleanResponse = response.replace(/```\n|\n```/g, '');
    }
    
    // Try to find a JSON object in the text
    const jsonMatch = cleanResponse.match(/(\{[\s\S]*\})/);
    if (jsonMatch && jsonMatch[1]) {
      const jsonStr = jsonMatch[1].trim();
      return JSON.parse(jsonStr);
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing JSON response:', error);
    return null;
  }
}

/**
 * Validate the tasks data structure
 * @param {Object} tasksData - The tasks data to validate
 * @throws {Error} If validation fails
 */
function validateTasksData(tasksData) {
  if (!tasksData.title) {
    throw new Error('Tasks data missing title');
  }
  
  if (!Array.isArray(tasksData.sections)) {
    throw new Error('Tasks data missing sections array');
  }
  
  tasksData.sections.forEach((section, sectionIndex) => {
    if (!section.title) {
      throw new Error(`Section ${sectionIndex + 1} missing title`);
    }
    
    if (!Array.isArray(section.tasks)) {
      throw new Error(`Section "${section.title}" missing tasks array`);
    }
    
    section.tasks.forEach((task, taskIndex) => {
      if (!task.id) {
        task.id = `task${sectionIndex + 1}_${taskIndex + 1}`;
      }
      
      if (!task.title) {
        throw new Error(`Task ${task.id} missing title`);
      }
      
      if (!task.description) {
        throw new Error(`Task ${task.id} missing description`);
      }
      
      if (!task.status) {
        task.status = 'pending';
      }
    });
  });
}

/**
 * Get the current tasks data
 * @returns {Object|null} The current tasks data
 */
export function getCurrentTasksData() {
  return currentTasksData;
}

/**
 * Update the status of a specific task
 * @param {string} taskId - The ID of the task to update
 * @param {string} status - The new status (pending, in-progress, completed)
 * @returns {boolean} Success status
 */
export function updateTaskStatus(taskId, status) {
  if (!currentTasksData) {
    return false;
  }
  
  for (const section of currentTasksData.sections) {
    for (const task of section.tasks) {
      if (task.id === taskId) {
        task.status = status;
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get a specific task by ID
 * @param {string} taskId - The ID of the task to get
 * @returns {Object|null} The task object or null if not found
 */
export function getTaskById(taskId) {
  if (!currentTasksData) {
    return null;
  }
  
  for (const section of currentTasksData.sections) {
    for (const task of section.tasks) {
      if (task.id === taskId) {
        return { ...task, sectionTitle: section.title };
      }
    }
  }
  
  return null;
}