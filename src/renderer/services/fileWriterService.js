/**
 * Service for handling file write operations from AI responses
 */

import fileService from './fileService.js';

/**
 * Extract file write operations from AI response
 * @param {string} responseText - The AI's response text
 * @returns {Array} - Array of {path, content} objects
 */
export function extractFileWriteOperations(responseText) {
  const fileWrites = [];
  const fileWriteRegex = /<file>([\s\S]*?)<\/file><name:"(.*?)">/g;
  let match;
  
  while ((match = fileWriteRegex.exec(responseText)) !== null) {
    fileWrites.push({
      content: match[1],
      path: match[2]
    });
  }
  
  return fileWrites;
}

/**
 * Write files based on AI response
 * @param {string} responseText - The AI's response text
 * @returns {Promise<Array>} - Array of written file paths
 */
export async function writeFilesFromResponse(responseText) {
  try {
    const fileWrites = extractFileWriteOperations(responseText);
    
    if (fileWrites.length === 0) {
      return [];
    }
    
    console.log(`Found ${fileWrites.length} file write operations`);
    
    // Process each file write operation
    const writtenFiles = [];
    
    for (const { path, content } of fileWrites) {
      try {
        console.log(`Writing file: ${path}`);
        const absolutePath = await fileService.writeFile(path, content);
        writtenFiles.push({ path, absolutePath, success: true });
      } catch (error) {
        console.error(`Error writing file ${path}:`, error);
        writtenFiles.push({ path, error: error.message, success: false });
      }
    }
    
    return writtenFiles;
  } catch (error) {
    console.error('Error processing file writes:', error);
    throw error;
  }
}

/**
 * Process AI response text to replace file tags with links/buttons
 * @param {string} responseText - The original AI response text
 * @param {Array} writtenFiles - Array of information about written files
 * @returns {string} - Response text with file tags replaced with UI elements
 */
export function createUIForWrittenFiles(responseText, writtenFiles) {
  if (writtenFiles.length === 0) {
    return responseText;
  }
  
  let processedText = responseText;
  
  // Replace each file tag with a button/link
  for (const fileInfo of writtenFiles) {
    const { path, absolutePath, success } = fileInfo;
    
    // Create the replacement pattern
    const fileTagPattern = new RegExp(`<file>[\\s\\S]*?</file><name:"${escapeRegExp(path)}">`, 'g');
    
    // Create the replacement HTML
    let replacement;
    if (success) {
      replacement = `<div class="file-write-success">
        <p>✅ File written successfully:</p>
        <div class="file-path-box">
          <code>${path}</code>
          <button class="open-file-btn" data-path="${absolutePath}">Open File</button>
        </div>
      </div>`;
    } else {
      replacement = `<div class="file-write-error">
        <p>❌ Error writing file:</p>
        <div class="file-path-box">
          <code>${path}</code>
          <p class="error-message">${fileInfo.error}</p>
        </div>
      </div>`;
    }
    
    // Replace the tag in the text
    processedText = processedText.replace(fileTagPattern, replacement);
  }
  
  return processedText;
}

/**
 * Escape special characters in string for using in RegExp
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}