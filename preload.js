const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  listFiles: () => ipcRenderer.invoke('list-files'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (fileName, content) => ipcRenderer.invoke('save-file', fileName, content),
  createFile: (fileName, content) => ipcRenderer.invoke('create-file', { fileName, content }),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  openInFileExplorer: (filePath) => ipcRenderer.invoke('open-in-file-explorer', filePath),
  scanDirectory: () => ipcRenderer.invoke('scan-directory'),
  
  // API operations
  setApiKey: (apiKey) => ipcRenderer.invoke('set-api-key', apiKey),
  sendMessage: (message, model, streamEnabled) => ipcRenderer.invoke('send-message', message, model, streamEnabled),
  onMessageUpdate: (callback) => {
    ipcRenderer.on('message-update', (_, partialResponse) => callback(partialResponse));
    return () => { ipcRenderer.removeAllListeners('message-update'); };
  },
  
  // Project management (new methods)
  getProjectDirectory: () => ipcRenderer.invoke('get-project-directory'),
  processFileForContext: (filePath, content) => ipcRenderer.invoke('process-file-for-context', filePath, content),
  finalizeFirstMessage: (projectName, title) => ipcRenderer.invoke('finalize-first-message', projectName, title),
  resetFirstMessageState: () => ipcRenderer.invoke('reset-first-message-state'),
  resetConversation: () => ipcRenderer.invoke('reset-conversation'),
  getConversationHistory: () => ipcRenderer.invoke('get-conversation-history'),
  
  // Global context and task management
  saveGlobalContext: (content) => ipcRenderer.invoke('save-global-context', content),
  readGlobalContext: () => ipcRenderer.invoke('read-global-context'),
  saveTodoList: (todoJson) => ipcRenderer.invoke('save-todo-list', todoJson),
  readTodoList: () => ipcRenderer.invoke('read-todo-list'),
  
  // File descriptions
  getFileDescription: (filePath) => ipcRenderer.invoke('get-file-description', filePath),
  generateFileDescription: (filePath) => ipcRenderer.invoke('generate-file-description', filePath),
  getAllFileDescriptions: () => ipcRenderer.invoke('get-all-file-descriptions'),
  generateAllFileDescriptions: () => ipcRenderer.invoke('generate-all-file-descriptions'),
  
  // Command processing
  processAIResponse: (responseText) => ipcRenderer.invoke('process-ai-response', responseText),
  executeCommand: (command) => ipcRenderer.invoke('execute-command', command),
  
  // Completed items
  saveCompletedItemSummary: (index, summary) => ipcRenderer.invoke('save-completed-item-summary', { index, summary }),
  getCompletedItemSummaries: () => ipcRenderer.invoke('get-completed-item-summaries'),
  
  // Settings
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  
  // Project management
  listProjects: () => ipcRenderer.invoke('list-projects'),
  createProject: (projectName, title) => ipcRenderer.invoke('create-project', { projectName, title }),
  selectProject: (projectName) => ipcRenderer.invoke('select-project', projectName),
  deleteProject: (projectName) => ipcRenderer.invoke('delete-project', projectName),
  getCurrentProject: () => ipcRenderer.invoke('get-current-project'),
  renameProject: (projectName, newTitle) => ipcRenderer.invoke('rename-project', projectName, newTitle),
});