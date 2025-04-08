/**
 * Main menu IPC handlers
 * Handles communication between the renderer process and main process for main menu functionality
 */
const path = require('path');
const TaskHandler = require('../../taskHandler');
const FileSystem = require('../../fileSystem');
const CommandParser = require('../../commandParser');
const AIClient = require('../../api');

// Store instances accessible to all handlers
let taskHandler = null;
let appDataPath = null;

function setup(ipcMain, app) {
  // Set up the app data path
  appDataPath = path.join(app.getPath('userData'), 'DoWayMore');
  
  // Start task execution when user clicks 'Let's Begin'
  ipcMain.handle('main-menu:start-task', async (event, initialTask) => {
    try {
      console.log('Starting task execution from main menu');
      console.log(`Initial task: ${initialTask}`);
      
      // Create components with the proper app data path
      const fileSystem = new FileSystem(appDataPath);
      const commandParser = new CommandParser(fileSystem);
      const aiClient = new AIClient({
        apiKey: process.env.OPENROUTER_API_KEY || '', // Use environment variable or configure in settings
        model: 'deepseek/deepseek-chat-v3-0324:free'
      });
      
      // Connect components
      aiClient.setComponents(fileSystem, commandParser);
      
      // Create task handler if it doesn't exist
      if (!taskHandler) {
        taskHandler = {
          fileSystem,
          commandParser,
          aiClient,
          currentProject: null
        };
      }
      
      // For testing: use a temporary project called 'temp-project'
      const tempProjectId = 'temp-project';
      console.log(`Setting current project to: ${tempProjectId}`);
      
      // Set the current project in the file system
      await fileSystem.setCurrentProject(tempProjectId);
      taskHandler.currentProject = tempProjectId;
      
      // Generate file descriptions for all files in the current project
      console.log('Generating file descriptions...');
      const registry = await fileSystem.getFileRegistry();
      
      console.log(`Found ${registry.files ? registry.files.length : 0} files in registry`);
      
      if (registry.files && registry.files.length > 0) {
        for (const fileRef of registry.files) {
          console.log(`Processing file: ${fileRef.name}`);
          
          // Skip binary files
          if (fileSystem.isLikelyBinaryFile(fileRef.originalPath)) {
            console.log(`Skipping binary file: ${fileRef.name}`);
            continue;
          }
          
          try {
            // Read file content
            const fileResult = await fileSystem.readFile(fileRef.id);
            
            if (fileResult.success) {
              // Generate description using AI
              console.log(`Generating description for: ${fileRef.name}`);
              console.log(`Input to model (first 50 chars): ${fileResult.content.substring(0, 50)}...`);
              
              const description = await aiClient.generateFileDescription(
                fileRef,
                fileResult.content
              );
              
              console.log(`Output description (first 100 chars): ${description.substring(0, 100)}...`);
              
              // Update file description in registry
              await fileSystem.updateFileDescription(fileRef.id, description);
            } else {
              console.log(`Error reading file: ${fileRef.name}: ${fileResult.error}`);
            }
          } catch (error) {
            console.error(`Error processing file ${fileRef.name}:`, error);
          }
        }
      }
      
      // Load task clarification prompt
      console.log('Loading task clarification prompt...');
      const taskClarificationPrompt = await aiClient.loadPrompt('task-clarification');
      
      // Create system message with task clarification prompt and file information
      const fileInfo = await aiClient.prepareFileInformation();
      const systemMessage = `${taskClarificationPrompt}\n\n${fileInfo}`;
      
      // Reset conversation history
      aiClient.resetConversation();
      
      // Add system message to conversation
      aiClient.conversationHistory.push({
        role: 'system',
        content: systemMessage
      });
      
      // Process initial message
      console.log('Sending initial message to AI model...');
      const result = await aiClient.processMessage(initialTask);
      
      console.log('Raw model output:');
      console.log('-----------------');
      console.log(result.response);
      console.log('-----------------');
      
      // Log file interactions
      if (result.openedFiles && result.openedFiles.length > 0) {
        console.log('\nFiles opened:');
        for (const file of result.openedFiles) {
          console.log(`- ${file.name}`);
        }
      }
      
      // Send response back to renderer
      return {
        success: true,
        response: result.response,
        openedFiles: result.openedFiles || [],
        executedCommands: result.executedCommands || []
      };
    } catch (error) {
      console.error('Error in task execution:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });
  
  // Process chat message during task execution
  ipcMain.handle('main-menu:send-message', async (event, message) => {
    try {
      if (!taskHandler || !taskHandler.aiClient) {
        return { success: false, error: 'Task handler not initialized' };
      }
      
      console.log(`Processing chat message: ${message}`);
      
      // Process message with file access
      const result = await taskHandler.aiClient.processMessage(message);
      
      console.log('Raw model output:');
      console.log('-----------------');
      console.log(result.response);
      console.log('-----------------');
      
      // Log file interactions
      if (result.openedFiles && result.openedFiles.length > 0) {
        console.log('\nFiles opened:');
        for (const file of result.openedFiles) {
          console.log(`- ${file.name}`);
        }
      }
      
      return {
        success: true,
        response: result.response,
        openedFiles: result.openedFiles || [],
        executedCommands: result.executedCommands || []
      };
    } catch (error) {
      console.error('Error processing chat message:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  });
}

module.exports = {
  setup
};