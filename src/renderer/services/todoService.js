/**
 * Service for handling to-do items and task management
 */

import { getTaskById, getCurrentTasksData } from './taskService.js';
import { getSetting } from './settingsService.js';
import fileService from './fileService.js';
import { fileOperationsPrompt } from '../data/fileOperationsPrompt.js';

// Cache for current todo items
let currentTodoItems = [];

// Conversation history for the current task
let conversationHistory = [];

// File content cache to avoid repeated requests
let fileContentCache = {};

/**
 * Process an AI response to detect file requests or file writing tags
 * @param {string} responseText - The AI's response text
 * @returns {Object} - Object with detected features
 */
function processAIResponse(responseText) {
  const result = {
    hasFileRequest: false,
    requestedFiles: [],
    hasFileWriteTags: false,
    fileWrites: []
  };
  
  // Detect file requests (JSON format)
  const fileRequestRegex = /\{"files":\s*\[(.*?)\]\}/;
  const fileRequestMatch = responseText.match(fileRequestRegex);
  
  if (fileRequestMatch) {
    try {
      const jsonStr = fileRequestMatch[0];
      const fileRequest = JSON.parse(jsonStr);
      
      if (Array.isArray(fileRequest.files) && fileRequest.files.length > 0) {
        result.hasFileRequest = true;
        result.requestedFiles = fileRequest.files;
      }
    } catch (error) {
      console.error('Error parsing file request JSON:', error);
    }
  }
  
  // Detect file write tags
  const fileWriteRegex = /<file>([\s\S]*?)<\/file><name:"(.*?)">/g;
  let match;
  
  while ((match = fileWriteRegex.exec(responseText)) !== null) {
    result.hasFileWriteTags = true;
    result.fileWrites.push({
      content: match[1],
      path: match[2]
    });
  }
  
  return result;
}

/**
 * Process the files requested by the AI
 * @param {string[]} filePaths - Array of file paths requested
 * @returns {Promise<Object>} - Object with file paths and contents
 */
async function processFileRequest(filePaths) {
  const fileContents = {};
  
  for (const filePath of filePaths) {
    // Check cache first to avoid rereading files
    if (fileContentCache[filePath]) {
      console.log(`Using cached content for ${filePath}`);
      fileContents[filePath] = fileContentCache[filePath];
      continue;
    }
    
    try {
      const content = await fileService.readFile(filePath);
      fileContents[filePath] = content;
      
      // Store in cache for future use
      fileContentCache[filePath] = content;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      fileContents[filePath] = `Error: ${error.message}`;
    }
  }
  
  return fileContents;
}

/**
 * Format file contents for inclusion in the AI prompt
 * @param {Object} fileContents - Object with file paths and contents
 * @returns {string} - Formatted file contents
 */
function formatFileContents(fileContents) {
  // Use a more machine-readable format to avoid the model mimicking it
  let formattedContent = '\n\n<FILE_DATA>\n';
  
  for (const [filePath, content] of Object.entries(fileContents)) {
    // Add file path with a format less likely to be mimicked
    formattedContent += `<FILE_PATH>${filePath}</FILE_PATH>\n\n`;
    
    // Determine language for code formatting based on file extension
    const extension = filePath.split('.').pop().toLowerCase();
    const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'cs', 
                       'html', 'css', 'scss', 'json', 'xml', 'yaml', 'yml', 'md', 'sh'];
    
    if (codeExts.includes(extension)) {
      formattedContent += `<FILE_CONTENT>\n${content}\n</FILE_CONTENT>\n\n`;
    } else {
      formattedContent += `<FILE_CONTENT>\n${content}\n</FILE_CONTENT>\n\n`;
    }
  }
  
  formattedContent += '</FILE_DATA>\n\n';
  
  return formattedContent;
}

/**
 * Get all to-do items for a task
 * @param {string} taskId - The task ID
 * @returns {Promise<Array>} - Array of to-do items
 */
export async function getTodoItems(taskId) {
  try {
    // For now, use cached items if available
    if (currentTodoItems.length > 0) {
      return currentTodoItems;
    }
    
    // Get the task details
    const task = getTaskById(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    // Generate default to-do items based on task
    currentTodoItems = [
      {
        id: 'todo_' + taskId + '_1',
        title: 'Understand the requirements',
        description: 'Review the task description and clarify any questions',
        completed: false
      },
      {
        id: 'todo_' + taskId + '_2',
        title: 'Implement the solution',
        description: 'Complete the implementation according to the requirements',
        completed: false
      },
      {
        id: 'todo_' + taskId + '_3',
        title: 'Test and verify',
        description: 'Verify that the implementation meets the requirements',
        completed: false
      }
    ];
    
    return currentTodoItems;
    
  } catch (error) {
    console.error('Error getting todo items:', error);
    throw error;
  }
}

/**
 * Start a new conversation for a task
 * @param {string} taskId - The ID of the task to start a conversation for
 * @returns {Promise<string>} - The initial assistant message
 */
export async function startTaskConversation(taskId) {
  try {
    // Reset conversation history
    conversationHistory = [];
    // Reset file cache when starting a new task conversation
    fileContentCache = {};
    
    // Get the task details
    const task = getTaskById(taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    
    // Get global context - FIX: Import and use getCurrentGlobalContext
    const { getCurrentGlobalContext } = await import('./contextService.js');
    const globalContext = getCurrentGlobalContext() || "No global context available";
    
    // Get the current tasks list for context
    const tasksData = getCurrentTasksData();
    
    // Check if project folder is set
    const projectFolder = fileService.getProjectFolder();
    if (!projectFolder) {
      console.warn('Project folder not set, file operations will not work');
    }
    
    // Create the initial user message with all context
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
    
    // Process any file write operations in the response
    const writtenFiles = await writeFilesFromResponse(response.content);
    
    // If files were written, replace the file tags with UI elements
    if (writtenFiles.length > 0) {
      response.content = createUIForWrittenFiles(response.content, writtenFiles);
      console.log(`Processed ${writtenFiles.length} file writes in response`);
    }
    
    // Return just the message content
    return response.content;
    
  } catch (error) {
    console.error('Error starting task conversation:', error);
    return `I'm sorry, I encountered an error starting our conversation: ${error.message}`;
  }
}

import { writeFilesFromResponse, createUIForWrittenFiles } from './fileWriterService.js';

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
    
    // Process any file write operations in the response
    const writtenFiles = await writeFilesFromResponse(response.content);
    
    // If files were written, replace the file tags with UI elements
    if (writtenFiles.length > 0) {
      response.content = createUIForWrittenFiles(response.content, writtenFiles);
      console.log(`Processed ${writtenFiles.length} file writes in response`);
    }
    
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
    
    // Get project folder path - important for file operations
    const projectFolder = fileService.getProjectFolder();
    
    // Check if project folder is set
    if (!projectFolder) {
      console.warn('Project folder not set, file operations will not work');
    }
    
    // Start building the prompt
    let prompt = `SYSTEM: ${fileOperationsPrompt}\n\n`;
    
    // Add file listing if project folder is set
    if (projectFolder) {
      try {
        // Get list of all files in the project folder
        const files = await fileService.listAllFiles();
        
        // Add the file listing to the prompt
        prompt += "SYSTEM: Here are the files available in the project folder:\n\n";
        
        if (files.length === 0) {
          prompt += "No files found in the project folder.\n\n";
        } else {
          // Group files by directory for better organization
          const filesByDirectory = {};
          
          files.forEach(file => {
            const dir = file.split('/').slice(0, -1).join('/');
            const dirKey = dir || '(root)';
            
            if (!filesByDirectory[dirKey]) {
              filesByDirectory[dirKey] = [];
            }
            
            filesByDirectory[dirKey].push(file);
          });
          
          // Add organized file listing
          for (const [dir, dirFiles] of Object.entries(filesByDirectory)) {
            prompt += `${dir}/\n`;
            dirFiles.forEach(file => {
              prompt += `  - ${file.split('/').pop()}\n`;
            });
            prompt += '\n';
          }
        }
        
        prompt += "\n";
      } catch (error) {
        console.error('Error listing files:', error);
        prompt += "SYSTEM: Could not list files in project folder due to an error.\n\n";
      }
      
      // Add information about previously accessed files
      if (Object.keys(fileContentCache).length > 0) {
        prompt += "SYSTEM: The following files have been accessed in this conversation and their contents are available:\n";
        Object.keys(fileContentCache).forEach(filePath => {
          prompt += `- ${filePath}\n`;
        });
        prompt += "\n";
      }
    } else {
      prompt += "SYSTEM: No project folder selected. Please select a project folder to enable file operations.\n\n";
    }
    
    // Add conversation history
    conversationHistory.forEach(message => {
      prompt += `${message.role.toUpperCase()}: ${message.content}\n\n`;
    });
    
    // Add the assistant prefix for the response
    prompt += 'ASSISTANT: ';
    
    let finalResponse = null;
    let currentPrompt = prompt;
    let requestedFilesSoFar = new Set();
    let iterationCount = 0;
    const MAX_ITERATIONS = 3; // Prevent infinite loops
    
    while (iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      
      // Call the API
      const response = await window.electronAPI.settings.callModel({
        apiKey,
        model,
        prompt: currentPrompt,
        temperature: 0.0,
        maxTokens: 2000,
        projectFolder // Pass the project folder path for security checks
      });
      
      if (!response || !response.text) {
        throw new Error('Invalid response from model');
      }
      
      // Process the response
      const processedResponse = processAIResponse(response.text);
      
      // Check if there are file requests in the response
      if (processedResponse.hasFileRequest && 
          processedResponse.requestedFiles.length > 0 && 
          projectFolder) {
        
        console.log(`Iteration ${iterationCount}: AI requested files:`, processedResponse.requestedFiles);
        
        // Filter out files we've already processed to avoid duplication
        const newFilesToProcess = processedResponse.requestedFiles.filter(
          file => !requestedFilesSoFar.has(file)
        );
        
        // If no new files to process, break the loop
        if (newFilesToProcess.length === 0) {
          console.log("No new files to process, using current response");
          finalResponse = {
            role: "assistant",
            content: response.text.trim()
          };
          break;
        }
        
        // Mark these files as processed
        newFilesToProcess.forEach(file => requestedFilesSoFar.add(file));
        
        // Get the contents of the requested files
        const fileContents = await processFileRequest(newFilesToProcess);
        
        // Format file contents for the prompt
        const formattedFileContents = formatFileContents(fileContents);
        
        // Build a new prompt that includes the file contents
        // We keep the original prompt, add the AI's file request response, 
        // then add a user message with the file contents
        currentPrompt = currentPrompt + response.text.trim() + '\n\n';
        currentPrompt += 'USER: Here are the requested files:\n\n';
        currentPrompt += formattedFileContents + '\n\n';
        currentPrompt += 'ASSISTANT: ';
        
        // Don't set finalResponse yet - we'll continue the loop
      } else {
        // No more file requests or no project folder, use this response
        finalResponse = {
          role: "assistant",
          content: response.text.trim()
        };
        break;
      }
    }
    
    // If we exceeded max iterations, use the last response
    if (!finalResponse && iterationCount >= MAX_ITERATIONS) {
      console.warn(`Exceeded maximum file request iterations (${MAX_ITERATIONS})`);
      const lastResponse = await window.electronAPI.settings.callModel({
        apiKey,
        model,
        prompt: currentPrompt,
        temperature: 0.0,
        maxTokens: 2000,
        projectFolder
      });
      
      if (lastResponse && lastResponse.text) {
        finalResponse = {
          role: "assistant",
          content: lastResponse.text.trim()
        };
      } else {
        throw new Error('Failed to get final response after multiple iterations');
      }
    }
    
    // REMOVED: The duplicate file processing section
    // File operations are now handled by writeFilesFromResponse in the calling functions
    
    // Add the final response to conversation history
    conversationHistory.push(finalResponse);
    
    return finalResponse;
  } catch (error) {
    console.error('Error getting assistant response:', error);
    throw error;
  }
}

/**
 * Process a task with AI assistance
 * @param {string} taskId - The task ID
 * @param {string} userInput - The user input
 * @returns {Promise<Object>} - The AI response object
 */
export async function processTaskWithAI(taskId, userInput) {
  try {
    // Get the task data
    const task = getTaskById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    // Check if project folder is set
    const projectFolder = fileService.getProjectFolder();
    if (!projectFolder) {
      throw new Error('Project folder not set. Please select a project folder first.');
    }
    
    // Prepare the prompt
    const prompt = `
${fileOperationsPrompt}

Task Description: ${task.description}

User Input: ${userInput}
`;
    
    // Get API settings
    const apiKey = await getSetting('apiKey');
    const model = await getSetting('model');
    
    if (!apiKey) {
      throw new Error('API key not set. Please configure it in Settings.');
    }
    
    console.log('Calling AI model for task processing...');
    
    // Call the model API
    const response = await window.electronAPI.settings.callModel({
      apiKey,
      model,
      prompt,
      temperature: 0.0,
      maxTokens: 4000
    });
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to get AI response');
    }
    
    // Process the response
    const processedResponse = processAIResponse(response.text);
    
    // If there's a file request, process it and make a follow-up call
    if (processedResponse.hasFileRequest && processedResponse.requestedFiles.length > 0) {
      console.log('AI requested files:', processedResponse.requestedFiles);
      
      // Get the contents of the requested files
      const fileContents = await processFileRequest(processedResponse.requestedFiles);
      
      // Format file contents for the prompt
      const formattedFileContents = formatFileContents(fileContents);
      
      // Create a follow-up prompt with the file contents
      const followUpPrompt = `
${fileOperationsPrompt}

Task Description: ${task.description}

User Input: ${userInput}

You requested these files: ${JSON.stringify(processedResponse.requestedFiles)}

${formattedFileContents}

Based on these file contents, please proceed with the task.
`;
      
      // Make the follow-up call
      const followUpResponse = await window.electronAPI.settings.callModel({
        apiKey,
        model,
        prompt: followUpPrompt,
        temperature: 0.0,
        maxTokens: 4000
      });
      
      if (!followUpResponse || !followUpResponse.success) {
        throw new Error(followUpResponse?.error || 'Failed to get follow-up AI response');
      }
      
      return {
        ...followUpResponse,
        originalRequest: processedResponse.requestedFiles
      };
    }
    
    return response;
    
  } catch (error) {
    console.error('Error processing task with AI:', error);
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
  fileContentCache = {}; // Clear file cache when conversation is reset
}

/**
 * Add a new to-do item
 * @param {string} taskId - The task ID
 * @param {Object} todoItem - The to-do item to add
 */
export function addTodoItem(taskId, todoItem) {
  // Generate ID if not provided
  if (!todoItem.id) {
    todoItem.id = 'todo_' + taskId + '_' + (currentTodoItems.length + 1);
  }
  
  // Set defaults
  if (todoItem.completed === undefined) {
    todoItem.completed = false;
  }
  
  // Add to list
  currentTodoItems.push(todoItem);
}

/**
 * Update a to-do item
 * @param {string} todoId - The to-do item ID
 * @param {Object} updates - The updates to apply
 * @returns {boolean} - True if updated successfully
 */
export function updateTodoItem(todoId, updates) {
  const index = currentTodoItems.findIndex(item => item.id === todoId);
  if (index === -1) {
    return false;
  }
  
  currentTodoItems[index] = {
    ...currentTodoItems[index],
    ...updates
  };
  
  return true;
}

/**
 * Reset the to-do items
 */
export function resetTodoItems() {
  currentTodoItems = [];
}