// src/main/ipc.js
const { ipcMain, dialog } = require('electron');
const fileSystem = require('./fileSystem');
const api = require('./api');
const taskManager = require('./taskManager');
const fileDescriptions = require('./fileDescriptions');
const commandParser = require('./commandParser');
const settingsStore = require('./settingsStore');

const path = require('path');

function setupIPC(mainWindow) {
  // Folder selection
  ipcMain.handle('select-folder', async () => {
    // Only offer folder selection if we're not in first message mode
    if (fileSystem.getProjectDirectory()) {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
      });
      if (result.canceled) return null;
      return fileSystem.setProjectDirectory(result.filePaths[0]);
    }
    return fileSystem.getProjectDirectory();
  });

  // Set API key
  ipcMain.handle('set-api-key', async (event, apiKey) => {
    return api.setApiKey(apiKey);
  });

  // Send message
  ipcMain.handle('send-message', async (event, message, model, streamEnabled = true) => {
    const updateCallback = (partialResponse) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('message-update', partialResponse);
      }
    };
    return api.sendMessage(message, model, updateCallback, streamEnabled);
  });

  // Directory scanning
  ipcMain.handle('scan-directory', async () => {
    return fileSystem.scanDirectory();
  });

  // Create file
  ipcMain.handle('create-file', async (event, { fileName, content }) => {
    return fileSystem.createFile(fileName, content);
  });

  // Read file
  ipcMain.handle('read-file', async (event, filePath) => {
    return fileSystem.readFile(filePath);
  });

  // Delete file
  ipcMain.handle('delete-file', async (event, filePath) => {
    return fileSystem.deleteFile(filePath);
  });

  // Open file in explorer
  ipcMain.handle('open-in-file-explorer', async (event, filePath) => {
    return fileSystem.openInFileExplorer(filePath);
  });

  // Global context
  ipcMain.handle('save-global-context', async (event, content) => {
    try {
      const filePath = await taskManager.saveGlobalContext(content);
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('read-global-context', async () => {
    try {
      const content = await taskManager.readGlobalContext();
      return { success: true, content };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // To-do list
  ipcMain.handle('save-todo-list', async (event, todoJson) => {
    try {
      const filePath = await taskManager.saveTodoList(todoJson);
      return { success: true, path: filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('read-todo-list', async () => {
    try {
      const todoJson = await taskManager.readTodoList();
      return { success: true, todoJson };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // File description operations
  ipcMain.handle('get-file-description', async (event, filePath) => {
    return fileDescriptions.getFileDescription(filePath);
  });

  ipcMain.handle('generate-file-description', async (event, filePath) => {
    return fileDescriptions.generateFileDescription(filePath);
  });

  ipcMain.handle('get-all-file-descriptions', async () => {
    return fileDescriptions.getAllFileDescriptions();
  });

  ipcMain.handle('generate-all-file-descriptions', async () => {
    return fileDescriptions.generateAllFileDescriptions();
  });

  // Command parsing operations
  ipcMain.handle('process-ai-response', async (event, responseText) => {
    return commandParser.processAIResponse(responseText);
  });

  ipcMain.handle('execute-command', async (event, command) => {
    return commandParser.executeCommand(command);
  });

  // Completed items
  ipcMain.handle('save-completed-item-summary', async (event, { index, summary }) => {
    try {
      const result = await taskManager.saveCompletedItemSummary(index, summary);
      return { success: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-completed-item-summaries', async () => {
    try {
      const summaries = await taskManager.getCompletedItemSummaries();
      return { success: true, summaries };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Settings operations
  ipcMain.handle('save-settings', async (event, settings) => {
    return settingsStore.saveSettings(settings);
  });

  ipcMain.handle('get-settings', async () => {
    try {
      const settings = await settingsStore.getSettings();
      return settings;
    } catch (error) {
      console.error('Error getting settings:', error);
      return null;
    }
  });

  // File system operations
  ipcMain.handle('list-files', async () => {
    return await fileSystem.listFiles();
  });

  ipcMain.handle('save-file', async (event, fileName, content) => {
    return await fileSystem.saveFile(fileName, content);
  });
  
  // Project management operations
  ipcMain.handle('list-projects', async () => {
    return fileSystem.listProjects();
  });

  ipcMain.handle('create-project', async (event, { projectName, title }) => {
    return fileSystem.createProject(projectName, title);
  });

  ipcMain.handle('select-project', async (event, projectName) => {
    return fileSystem.selectProject(projectName);
  });

  ipcMain.handle('delete-project', async (event, projectName) => {
    return fileSystem.deleteProject(projectName);
  });

  ipcMain.handle('get-project-directory', async () => {
    return fileSystem.getProjectDirectory();
  });

  ipcMain.handle('process-file-for-context', async (event, filePath, content) => {
    return fileSystem.processFileForContext(filePath, content);
  });

  ipcMain.handle('finalize-first-message', async (event, projectName, title) => {
    return fileSystem.finalizeFirstMessage(projectName, title);
  });

  ipcMain.handle('reset-first-message-state', async () => {
    return fileSystem.resetFirstMessageState();
  });

  ipcMain.handle('reset-conversation', async () => {
    return api.resetConversation();
  });

  ipcMain.handle('get-conversation-history', async () => {
    return api.getConversationHistory();
  });

  ipcMain.handle('get-current-project', async () => {
    const projectDir = fileSystem.getProjectDirectory();
    if (!projectDir) {
      return null;
    }
    
    const projectName = path.basename(projectDir);
    const isDefault = projectName === 'untitled';
    
    return {
      name: projectName,
      path: projectDir,
      isDefault: isDefault
    };
  });
  
  ipcMain.handle('rename-project', async (event, projectName, newTitle) => {
    return fileSystem.updateProjectMetadata(projectName, { title: newTitle });
  });
}

module.exports = { setupIPC };