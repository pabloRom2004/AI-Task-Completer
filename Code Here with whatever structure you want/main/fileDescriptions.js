// src/main/fileDescriptions.js
const path = require('path');
const fs = require('fs').promises;

// Store file descriptions cache
let fileDescriptionsCache = null;
const DESCRIPTIONS_FILE = '.file-descriptions.json';

/**
 * Checks if a file exists
 * @param {string} filePath - Path to the file
 * @returns {Promise<boolean>} Whether the file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads all file descriptions from the project directory.
 * @param {string} projectDir - The project directory path
 * @returns {Promise<Object>} The file description map.
 */
async function loadFileDescriptions(projectDir) {
  try {
    if (!projectDir) {
      fileDescriptionsCache = {};
      return fileDescriptionsCache;
    }
    
    const descFilePath = path.join(projectDir, DESCRIPTIONS_FILE);
    
    // Create empty descriptions file if it doesn't exist
    if (!(await fileExists(descFilePath))) {
      fileDescriptionsCache = {};
      await saveFileDescriptions(projectDir);
      return fileDescriptionsCache;
    }
    
    // Read and parse descriptions
    const content = await fs.readFile(descFilePath, 'utf8');
    fileDescriptionsCache = JSON.parse(content);
    return fileDescriptionsCache;
  } catch (error) {
    console.error('Error loading file descriptions:', error);
    fileDescriptionsCache = {};
    return fileDescriptionsCache;
  }
}

/**
 * Saves all file descriptions to the project directory.
 * @param {string} projectDir - The project directory path
 * @returns {Promise<boolean>} Success status.
 */
async function saveFileDescriptions(projectDir) {
  try {
    if (!projectDir) {
      return false;
    }
    
    const descFilePath = path.join(projectDir, DESCRIPTIONS_FILE);
    await fs.writeFile(
      descFilePath,
      JSON.stringify(fileDescriptionsCache, null, 2),
      'utf8'
    );
    
    return true;
  } catch (error) {
    console.error('Error saving file descriptions:', error);
    return false;
  }
}

/**
 * Gets the relative path from project directory
 * @param {string} filePath - Absolute path to file
 * @param {string} projectDir - The project directory path
 * @returns {string} Relative path from project directory
 */
function getRelativePath(filePath, projectDir) {
  return path.relative(projectDir, filePath);
}

/**
 * Generates a description for a file using AI.
 * @param {string} filePath - Path to the file (absolute or relative)
 * @param {string|null} projectDir - The project directory (optional)
 * @returns {Promise<string>} The generated description
 */
async function generateFileDescription(filePath, projectDir = null) {
  try {
    // Get project directory from fileSystem module if not provided
    if (!projectDir) {
      const fileSystem = require('./fileSystem');
      projectDir = fileSystem.getProjectDirectory();
    }
    
    if (!projectDir) {
      return 'Error: Project directory not set';
    }
    
    // Ensure we have the full path
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(projectDir, filePath);
    
    // Get relative path for storage
    const relativePath = path.relative(projectDir, fullPath);
    
    // Read the file content
    const fileContent = await fs.readFile(fullPath, 'utf8');
    
    // Load the file description prompt
    const promptPath = path.join(__dirname, '../../prompts/file-descriptions/file-description.txt');
    let promptTemplate;
    
    try {
      promptTemplate = await fs.readFile(promptPath, 'utf8');
    } catch (error) {
      // Use a default prompt if file doesn't exist
      promptTemplate = `Please provide a concise summary (1-5 sentences) of this file, focusing on its purpose, key functionality, and how it might be used or interacted with by other components. Include the most important public methods or data structures if applicable. Do not include implementation details unless they are crucial for understanding the file's role.

File content:
{fileContent}`;
    }
    
    // Replace placeholder with file content
    promptTemplate = promptTemplate.replace('{fileContent}', fileContent);
    
    // Generate description using AI - but avoid circular dependency
    // We'll use a direct API call here instead of requiring the full api.js
    const api = require('./api');
    const response = await api.sendMessage(
      promptTemplate, 
      'deepseek/deepseek-chat-v3-0324:free', 
      null, 
      false,
      null, // fileSystem - will be loaded by sendMessage
      null  // fileDescriptions - will be loaded by sendMessage 
    );
    
    // Extract just the string if the response is an object
    let descriptionText;
    if (typeof response === 'object') {
      descriptionText = response.response || JSON.stringify(response);
    } else {
      descriptionText = response;
    }
    
    // Remove error prefix if present
    if (descriptionText.startsWith('Error:')) {
      descriptionText = 'Brief description not available.';
    }
    
    // Ensure cache is loaded
    if (!fileDescriptionsCache) {
      await loadFileDescriptions(projectDir);
    }
    
    // Store the description
    fileDescriptionsCache[relativePath] = descriptionText;
    await saveFileDescriptions(projectDir);
    
    return descriptionText;
  } catch (error) {
    console.error(`Error generating description for ${filePath}:`, error);
    return `Brief description not available: ${error.message}`;
  }
}

/**
 * Gets a file description, generating it if necessary.
 * @param {string} filePath - Path to the file (absolute or relative)
 * @returns {Promise<string>} The file description
 */
async function getFileDescription(filePath) {
  try {
    // Get project directory
    const fileSystem = require('./fileSystem');
    const projectDir = fileSystem.getProjectDirectory();
    
    if (!projectDir) {
      return null;
    }
    
    // Load descriptions if not loaded
    if (!fileDescriptionsCache) {
      await loadFileDescriptions(projectDir);
    }
    
    // Ensure we're working with a relative path for cache lookup
    const relativePath = path.isAbsolute(filePath)
      ? path.relative(projectDir, filePath)
      : filePath;
    
    // Return cached description if exists
    if (fileDescriptionsCache[relativePath]) {
      return fileDescriptionsCache[relativePath];
    }
    
    // Generate new description
    return await generateFileDescription(filePath, projectDir);
  } catch (error) {
    console.error('Error getting file description:', error);
    return null;
  }
}

/**
 * Gets all file descriptions.
 * @returns {Promise<Object>} Map of file paths to descriptions
 */
async function getAllFileDescriptions() {
  const fileSystem = require('./fileSystem');
  const projectDir = fileSystem.getProjectDirectory();
  
  if (!fileDescriptionsCache) {
    await loadFileDescriptions(projectDir);
  }
  return fileDescriptionsCache;
}

/**
 * Helper function to flatten the file structure.
 * @param {Array} items - File tree structure
 * @returns {Array} Flattened array of files and directories
 */
function flattenFileStructure(items, result = []) {
  for (const item of items) {
    result.push(item);
    if (item.type === 'directory' && item.children) {
      flattenFileStructure(item.children, result);
    }
  }
  return result;
}

/**
 * Determines if file should have description generated
 * @param {string} fileName - File name or path
 * @returns {boolean} Whether to generate description
 */
function shouldGenerateDescription(fileName) {
  const binaryExtensions = ['.ttf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 
                          '.pdf', '.mp3', '.mp4', '.wav', '.zip', '.exe', '.dll'];
  const ext = path.extname(fileName).toLowerCase();
  return !binaryExtensions.includes(ext);
}

/**
 * Generates descriptions for all files in the project.
 * @returns {Promise<number>} Number of files processed
 */
async function generateAllFileDescriptions() {
  const fileSystem = require('./fileSystem');
  const projectDir = fileSystem.getProjectDirectory();
  
  if (!projectDir) {
    return 0;
  }
  
  try {
    // Get all files from directory
    const files = await fileSystem.scanDirectory();
    const flattenedFiles = flattenFileStructure(files);
    
    let processedCount = 0;
    
    // Process each file
    for (const file of flattenedFiles) {
      if (file.type === 'file' && shouldGenerateDescription(file.path)) {
        await generateFileDescription(file.path, projectDir);
        processedCount++;
      }
    }
    
    return processedCount;
  } catch (error) {
    console.error('Error generating all file descriptions:', error);
    return 0;
  }
}

module.exports = {
  getFileDescription,
  generateFileDescription,
  getAllFileDescriptions,
  generateAllFileDescriptions,
  loadFileDescriptions,
  saveFileDescriptions,
  shouldGenerateDescription
};