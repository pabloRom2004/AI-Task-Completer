// main.js - Main Electron application file

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Import your modules
const FileSystem = require('./fileSystem');
const CommandParser = require('./commandParser');
const ProjectHandler = require('./project-handler');
const AIClient = require('./api');

// Import the ClarificationQuestionsIPC class
const ClarificationQuestionsIPC = require('./src/clarification-questions/ipc');

// Shared instances
let fileSystem = null;
let commandParser = null;
let projectHandler = null;
let aiClient = null;

// Set up file and project system
function setupSystems() {
  try {
    // Initialize file system with app data path
    const appDataPath = path.join(app.getPath('userData'), 'DoWayMore');
    console.log('Using app data path:', appDataPath);
    
    fileSystem = new FileSystem(appDataPath);
    commandParser = new CommandParser(fileSystem);
    projectHandler = new ProjectHandler(app);
    
    // Initialize AI client
    aiClient = new AIClient({
      apiKey: '', // Start with empty API key - will be set via settings
      model: 'deepseek/deepseek-chat-v3-0324:free'
    });
    
    // Connect components
    aiClient.setComponents(fileSystem, commandParser);
    
    // Initialize clarification questions IPC handlers
    const clarificationQuestionsIPC = new ClarificationQuestionsIPC({
      ipcMain,
      aiClient,
      fileSystem,
      projectHandler
    });
    
    console.log('Systems initialized successfully');
  } catch (error) {
    console.error('Error setting up systems:', error);
  }
}

// Rest of your main.js file remains the same...
// Create the browser window
function createWindow() {
  
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  setupSystems();

  // Register IPC handlers
  setupIpcHandlers();
  
  createWindow();
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Register all IPC handlers
function setupIpcHandlers() {
  // File operations
  ipcMain.handle('files:processFile', async (event, filePath) => {
    if (!fileSystem) return { success: false, error: 'File system not initialized' };
    return fileSystem.processFileForContext(filePath);
  });
  
  ipcMain.handle('files:saveTextPaste', async (event, text) => {
    if (!fileSystem) return { success: false, error: 'File system not initialized' };
    return fileSystem.saveTextPaste(text);
  });
  
  ipcMain.handle('files:scanDirectory', async (event, dirPath) => {
    if (!fileSystem) return { success: false, error: 'File system not initialized' };
    return fileSystem.scanDirectory(dirPath);
  });
  
  ipcMain.handle('files:getRegistry', async () => {
    if (!fileSystem) return { lastUpdated: new Date().toISOString(), files: [] };
    return fileSystem.getFileRegistry();
  });
  
  ipcMain.handle('files:processCommands', async (event, aiResponse) => {
    if (!commandParser) return { success: false, error: 'Command parser not initialized' };
    return commandParser.executeCommandsFromResponse(aiResponse);
  });
  
  ipcMain.handle('files:processFileRequests', async (event, aiResponse) => {
    if (!commandParser) return { success: false, error: 'Command parser not initialized' };
    return commandParser.processFileRequests(aiResponse);
  });
  
  // Dialog operations
  ipcMain.handle('dialog:openFile', async (event, options) => {
    try {
      const result = await dialog.showOpenDialog(options);
      return {
        success: !result.canceled,
        filePaths: result.filePaths
      };
    } catch (error) {
      console.error('Error in dialog:openFile:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('dialog:openDirectory', async (event, options) => {
    try {
      const result = await dialog.showOpenDialog({
        ...options,
        properties: ['openDirectory']
      });
      return {
        success: !result.canceled,
        filePaths: result.filePaths
      };
    } catch (error) {
      console.error('Error in dialog:openDirectory:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Shell operations
  ipcMain.handle('shell:openPath', async (event, filePath) => {
    try {
      const { shell } = require('electron');
      const result = await shell.openPath(filePath);
      return {
        success: result === '',
        error: result !== '' ? result : null
      };
    } catch (error) {
      console.error('Error in shell:openPath:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Main menu operations
  ipcMain.handle('main-menu:start-task', async (event, taskDescription, clarificationPrompt) => {
    try {
      console.log('Starting task execution from main menu');
      console.log(`Initial task: ${taskDescription}`);
      
      // Create a project for this task
      const projectData = {
        title: "Untitled Project",
        description: taskDescription,
        progress: 'clarification'
      };
      
      // Create project
      const project = await projectHandler.createProject(projectData);
      console.log(`Created project: ${project.id}`);
      
      // Set current project in file system
      await fileSystem.setCurrentProject(project.id);
      
      // Move any pending files to the project
      const movedFilesResult = await fileSystem.movePendingFilesToProject(project.id);
      console.log(`Moved ${movedFilesResult.success ? movedFilesResult.movedFiles : 0} files to project`);
      
      // Generate file descriptions for all files in the current project
      console.log('Generating file descriptions...');
      const registry = await fileSystem.getFileRegistry();
      
      console.log(`Found ${registry.files ? registry.files.length : 0} files in registry`);
      
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
            
            const description = await aiClient.generateFileDescription(
              fileRef,
              fileResult.content
            );
            
            console.log(`Generated description for ${fileRef.name}`);
            
            // Update file description in registry
            await fileSystem.updateFileDescription(fileRef.id, description);
          } else {
            console.log(`Error reading file: ${fileRef.name}: ${fileResult.error}`);
          }
        } catch (error) {
          console.error(`Error processing file ${fileRef.name}:`, error);
        }
      }
      
      // Load task clarification prompt
      console.log('Loading task clarification prompt...');
      const taskClarificationTemplate = await aiClient.loadPrompt('task-clarification');
      
      // Replace the placeholders with the actual values
      let formattedPrompt = taskClarificationTemplate;
      if (clarificationPrompt) {
        formattedPrompt = taskClarificationTemplate
          .replace('{userTask}', clarificationPrompt.userTask)
          .replace('{conversation}', clarificationPrompt.conversation);
      } else {
        formattedPrompt = taskClarificationTemplate
          .replace('{userTask}', taskDescription)
          .replace('{conversation}', '');
      }
      
      // Prepare file information for inclusion in the message
      const fileInfo = await aiClient.prepareFileInformation();
      
      // Reset conversation history
      aiClient.resetConversation();
      
      // Add system message with prompt and file info
      aiClient.conversationHistory.push({
        role: 'system',
        content: formattedPrompt
      });
      
      aiClient.conversationHistory.push({
        role: 'system',
        content: fileInfo
      });
      
      // Add user message
      aiClient.conversationHistory.push({
        role: 'user',
        content: taskDescription
      });
      
      // Process initial message
      console.log('Sending initial message to AI model...');
      const result = await aiClient.processMessage(taskDescription);
      
      console.log('Raw model output:');
      console.log('-----------------');
      console.log(result.response);
      console.log('-----------------');
      
      // Save conversation history to project
      try {
        const conversationsPath = path.join(projectHandler.projectsDir, project.id, 'conversations.json');
        await fs.writeFile(
          conversationsPath, 
          JSON.stringify({ history: aiClient.getConversationHistory() }, null, 2),
          'utf8'
        );
      } catch (saveError) {
        console.error('Error saving conversation history:', saveError);
      }
      
      return {
        success: true,
        projectId: project.id,
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
  
  // Process follow-up messages
  ipcMain.handle('main-menu:send-message', async (event, message, projectId, clarificationPrompt) => {
    try {
      if (!aiClient) {
        return { success: false, error: 'AI client not initialized' };
      }
      
      // If project ID is provided, make sure we're using that project
      if (projectId && fileSystem.currentProject !== projectId) {
        await fileSystem.setCurrentProject(projectId);
      }
      
      // If this is a continuation of the task clarification
      if (clarificationPrompt) {
        // Load the task clarification template
        const taskClarificationTemplate = await aiClient.loadPrompt('task-clarification');
        
        // Replace the placeholders
        const formattedPrompt = taskClarificationTemplate
          .replace('{userTask}', clarificationPrompt.userTask)
          .replace('{conversation}', clarificationPrompt.conversation);
        
        // Reset conversation history
        aiClient.resetConversation();
        
        // Add system message with prompt
        aiClient.conversationHistory.push({
          role: 'system',
          content: formattedPrompt
        });
        
        // Add file information
        const fileInfo = await aiClient.prepareFileInformation();
        aiClient.conversationHistory.push({
          role: 'system',
          content: fileInfo
        });
      }
      
      // Add user message
      aiClient.conversationHistory.push({
        role: 'user',
        content: message
      });
      
      // Process message with file access
      const result = await aiClient.processMessage(message);
      
      // Save conversation history to project
      if (projectId) {
        try {
          const conversationsPath = path.join(projectHandler.projectsDir, projectId, 'conversations.json');
          await fs.writeFile(
            conversationsPath, 
            JSON.stringify({ history: aiClient.getConversationHistory() }, null, 2),
            'utf8'
          );
        } catch (saveError) {
          console.error('Error saving conversation history:', saveError);
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
      return { success: false, error: error.message };
    }
  });
  
  // Save settings
  ipcMain.handle('main-menu:save-settings', async (event, settings) => {
    try {
      if (settings.apiKey && aiClient) {
        aiClient.setApiKey(settings.apiKey);
      }
      
      if (settings.model && aiClient) {
        aiClient.setModel(settings.model);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error saving settings:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Projects API - register the project handler's IPC methods
  projectHandler.registerIpcHandlers(ipcMain);
}

// Use a flag to prevent infinite quit loops
let isQuitting = false;

// Clean up pending files when app is about to quit
app.on('will-quit', async (event) => {
  // Prevent recursion
  if (isQuitting) return;
  
  console.log('App is about to quit, cleaning up pending files...');
  
  if (fileSystem) {
    try {
      // Prevent the app from quitting until cleanup is done
      event.preventDefault();
      
      // Set flag to prevent recursive quit
      isQuitting = true;
      
      // Delete temporary files if not assigned to a project
      const result = await fileSystem.cleanupTempFiles();
      console.log(`Temp file cleanup result: ${result.success ? 'Success' : 'Failed'} - ${result.deletedCount || 0} files deleted`);
      
      // Continue with the quitting process
      setTimeout(() => app.exit(), 0); // Use app.exit() instead of app.quit()
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
      // Continue with the quitting process
      setTimeout(() => app.exit(), 0); // Use app.exit() instead of app.quit()
    }
  }
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  app.quit();
});