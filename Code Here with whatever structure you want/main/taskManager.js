const fs = require('fs').promises;
const path = require('path');
const fileSystem = require('./fileSystem');

/**
 * Saves the global context as a plain text file in the project directory.
 * @param {string} content - The global context summary.
 * @returns {Promise<string>} The file path where the context was saved.
 */
async function saveGlobalContext(content) {
  const projectDir = fileSystem.getProjectDirectory();
  if (!projectDir) throw new Error("Project directory not set");
  const filePath = path.join(projectDir, "globalContext.txt");
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

/**
 * Reads the global context from the project directory.
 * @returns {Promise<string>} The global context content.
 */
async function readGlobalContext() {
  const projectDir = fileSystem.getProjectDirectory();
  if (!projectDir) throw new Error("Project directory not set");
  const filePath = path.join(projectDir, "globalContext.txt");
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet
      return '';
    }
    throw error;
  }
}

/**
 * Saves the to-do list as a JSON file in the project directory.
 * @param {Object} todoJson - The to-do list object.
 * @returns {Promise<string>} The file path where the to-do list was saved.
 */
async function saveTodoList(todoJson) {
  const projectDir = fileSystem.getProjectDirectory();
  if (!projectDir) throw new Error("Project directory not set");
  const filePath = path.join(projectDir, "todoList.json");
  const content = JSON.stringify(todoJson, null, 2);
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

/**
 * Reads the to-do list from the project directory.
 * @returns {Promise<Object>} The to-do list as a JSON object.
 */
async function readTodoList() {
  const projectDir = fileSystem.getProjectDirectory();
  if (!projectDir) throw new Error("Project directory not set");
  const filePath = path.join(projectDir, "todoList.json");
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet, return empty object
      return {};
    }
    throw error;
  }
}

/**
 * Saves a summary of a completed to-do item.
 * @param {number} index - The index of the completed item.
 * @param {string} summary - The summary of how the item was completed.
 * @returns {Promise<boolean>} Success status.
 */
async function saveCompletedItemSummary(index, summary) {
  const projectDir = fileSystem.getProjectDirectory();
  if (!projectDir) throw new Error("Project directory not set");
  
  try {
    // Read the existing completions file or create a new one
    const filePath = path.join(projectDir, "completedItems.json");
    let completions = {};
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      completions = JSON.parse(content);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // If file doesn't exist, we'll create it
    }
    
    // Add the new completion
    completions[index] = {
      timestamp: new Date().toISOString(),
      summary
    };
    
    // Save the updated completions
    await fs.writeFile(filePath, JSON.stringify(completions, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving completed item summary:', error);
    return false;
  }
}

/**
 * Reads the summaries of completed to-do items.
 * @returns {Promise<Object>} The completed items with their summaries.
 */
async function getCompletedItemSummaries() {
  const projectDir = fileSystem.getProjectDirectory();
  if (!projectDir) throw new Error("Project directory not set");
  
  try {
    const filePath = path.join(projectDir, "completedItems.json");
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet
      return {};
    }
    throw error;
  }
}

module.exports = {
  saveGlobalContext,
  readGlobalContext,
  saveTodoList,
  readTodoList,
  saveCompletedItemSummary,
  getCompletedItemSummaries
};