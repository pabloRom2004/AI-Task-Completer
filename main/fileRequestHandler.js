/**
 * Handles file requests in AI responses
 */
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Detects if the AI response contains a file request
 * @param {string} responseText - The text response from the AI
 * @returns {string[]|null} Array of file paths or null if no request
 */
function detectFileRequest(responseText) {
  try {
    // Look for JSON pattern at the end of the message
    const matches = responseText.match(/\{"files":\s*\[(.*?)\]\}/);
    if (!matches) return null;
    
    // Extract the file paths from the JSON
    const jsonString = matches[0];
    const fileRequest = JSON.parse(jsonString);
    
    if (Array.isArray(fileRequest.files) && fileRequest.files.length > 0) {
      logger.debugLog(`Detected file request: ${JSON.stringify(fileRequest.files)}`);
      return fileRequest.files;
    }
    
    return null;
  } catch (error) {
    logger.logError('fileRequest:detect', error);
    logger.debugLog(`Error detecting file request: ${error.message}`);
    return null;
  }
}

/**
 * Process file requests and read file contents
 * @param {string[]} filePaths - Array of file paths to read
 * @param {string} projectFolderPath - The project folder path
 * @returns {Object} Object with file paths as keys and contents as values
 */
async function processFileRequest(filePaths, projectFolderPath) {
  if (!projectFolderPath) {
    throw new Error('Project folder not set');
  }
  
  const fileContents = {};
  
  for (const relativePath of filePaths) {
    try {
      // Create absolute path based on project folder
      const absolutePath = path.join(projectFolderPath, relativePath);
      
      // Security check: ensure path is within project folder
      const normalizedAbsolutePath = absolutePath.replace(/\\/g, '/');
      const normalizedProjectPath = projectFolderPath.replace(/\\/g, '/');
      
      if (!normalizedAbsolutePath.startsWith(normalizedProjectPath)) {
        logger.debugLog(`Security violation: Path outside project folder: ${relativePath}`);
        fileContents[relativePath] = `Error: Security violation - cannot access files outside project folder`;
        continue;
      }
      
      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        logger.debugLog(`File not found: ${absolutePath}`);
        fileContents[relativePath] = `Error: File not found: ${relativePath}`;
        continue;
      }
      
      // Read file content
      const content = fs.readFileSync(absolutePath, 'utf8');
      logger.debugLog(`Successfully read file: ${relativePath}`);
      fileContents[relativePath] = content;
      
    } catch (error) {
      logger.logError('fileRequest:read', error);
      logger.debugLog(`Error reading file ${relativePath}: ${error.message}`);
      fileContents[relativePath] = `Error reading file: ${error.message}`;
    }
  }
  
  return fileContents;
}

/**
 * Format file contents for inclusion in AI context
 * @param {Object} fileContents - Object with file paths and contents
 * @returns {string} Formatted file contents for AI context
 */
function formatFileContents(fileContents) {
  let formattedContent = '\n\n## FILE CONTENTS\n\n';
  
  for (const [filePath, content] of Object.entries(fileContents)) {
    // Add file path header
    formattedContent += `### ${filePath}\n\n`;
    
    // Determine if we should use code block formatting based on file extension
    const extension = path.extname(filePath).toLowerCase();
    const codeFileTypes = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.cs', 
                          '.html', '.css', '.scss', '.json', '.xml', '.yaml', '.yml', '.md', '.sh'];
    
    if (codeFileTypes.includes(extension)) {
      // Use code block with language hint
      const language = extension.substring(1); // Remove the dot
      formattedContent += '```' + language + '\n' + content + '\n```\n\n';
    } else {
      // Use plain text formatting
      formattedContent += content + '\n\n';
    }
  }
  
  return formattedContent;
}

module.exports = {
  detectFileRequest,
  processFileRequest,
  formatFileContents
};