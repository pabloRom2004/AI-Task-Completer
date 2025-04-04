// src/main/commandParser.js
const fileSystem = require('./fileSystem');
const fileDescriptions = require('./fileDescriptions');

/**
 * Parses AI response text for commands.
 * @param {string} responseText - The AI response text
 * @returns {Array<Object>} Extracted commands
 */
function parseCommands(responseText) {
  const commands = [];
  // Look for JSON objects or code blocks with JSON
  const commandRegex = /```json\s*({[\s\S]*?})\s*```|{(?:[^{}]|{"[^"]*"}|{'[^']*'})*}/g;
  
  let match;
  while ((match = commandRegex.exec(responseText)) !== null) {
    const jsonStr = match[1] || match[0];
    
    try {
      const command = JSON.parse(jsonStr);
      if (command && command.command) {
        commands.push(command);
      }
    } catch (e) {
      // Skip invalid JSON
      console.log('Invalid JSON found, skipping:', jsonStr);
    }
  }
  
  return commands;
}

/**
 * Executes a command from the AI response.
 * @param {Object} command - The command object to execute
 * @returns {Promise<Object>} Result of the command execution
 */
async function executeCommand(command) {
  if (!command || !command.command) {
    return { success: false, error: 'Invalid command format' };
  }
  
  try {
    switch (command.command) {
      case 'Create':
        return await createFile(command);
      case 'Modify':
        return await modifyFile(command);
      case 'Delete':
        return await deleteFile(command);
      default:
        return { success: false, error: `Unknown command: ${command.command}` };
    }
  } catch (error) {
    console.error('Error executing command:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Creates a file with provided content.
 * @param {Object} command - The Create command
 * @returns {Promise<Object>} Result of the file creation
 */
async function createFile(command) {
  const { fileName, content, description } = command;
  
  if (!fileName || content === undefined) {
    return { success: false, error: 'Missing fileName or content in Create command' };
  }
  
  // Create the file
  const result = await fileSystem.createFile(fileName, content);
  
  // If successful and description provided, store the description
  if (result.success && description) {
    await fileDescriptions.getFileDescription(fileName); // This will create a description if not exists
  }
  
  return result;
}

/**
 * Modifies a file by replacing content.
 * @param {Object} command - The Modify command
 * @returns {Promise<Object>} Result of the file modification
 */
async function modifyFile(command) {
  const { fileName, oldContent, newContent } = command;
  
  if (!fileName || !oldContent || newContent === undefined) {
    return { success: false, error: 'Missing required parameters in Modify command' };
  }
  
  try {
    // Read the current file content
    const readResult = await fileSystem.readFile(fileName);
    if (!readResult.success) {
      return readResult;
    }
    
    // Replace the old content with new content
    const updatedContent = readResult.content.replace(oldContent, newContent);
    
    // If content didn't change, oldContent wasn't found
    if (updatedContent === readResult.content) {
      return { success: false, error: 'Pattern not found in file' };
    }
    
    // Write the updated content back
    const writeResult = await fileSystem.createFile(fileName, updatedContent);
    
    // If successful, update the file description
    if (writeResult.success) {
      await fileDescriptions.generateFileDescription(fileName);
    }
    
    return writeResult;
  } catch (error) {
    console.error(`Error modifying file ${fileName}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a file.
 * @param {Object} command - The Delete command
 * @returns {Promise<Object>} Result of the file deletion
 */
async function deleteFile(command) {
  const { fileName } = command;
  
  if (!fileName) {
    return { success: false, error: 'Missing fileName in Delete command' };
  }
  
  return await fileSystem.deleteFile(fileName);
}

/**
 * Processes an AI response, extracts and executes commands.
 * @param {string} responseText - The AI response text
 * @returns {Promise<Array<Object>>} Results of command execution
 */
async function processAIResponse(responseText) {
  const commands = parseCommands(responseText);
  const results = [];
  
  for (const command of commands) {
    const result = await executeCommand(command);
    results.push({
      command,
      result
    });
  }
  
  return results;
}

module.exports = {
  executeCommand,
  parseCommands,
  processAIResponse
};