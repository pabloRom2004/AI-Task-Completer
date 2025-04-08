// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    // Main menu APIs
    startTask: (task, clarificationPrompt) => ipcRenderer.invoke('main-menu:start-task', task, clarificationPrompt),
    sendMessage: (message, projectId, clarificationPrompt) => ipcRenderer.invoke('main-menu:send-message', message, projectId, clarificationPrompt),
    saveSettings: (settings) => ipcRenderer.invoke('main-menu:save-settings', settings),
    
    // Files APIs
    files: {
      processFile: (filePath) => ipcRenderer.invoke('files:processFile', filePath),
      saveTextPaste: (text) => ipcRenderer.invoke('files:saveTextPaste', text),
      scanDirectory: (dirPath) => ipcRenderer.invoke('files:scanDirectory', dirPath),
      getRegistry: () => ipcRenderer.invoke('files:getRegistry'),
      processCommands: (aiResponse) => ipcRenderer.invoke('files:processCommands', aiResponse),
      processFileRequests: (aiResponse) => ipcRenderer.invoke('files:processFileRequests', aiResponse),
      deleteFile: (fileId) => ipcRenderer.invoke('files:deleteFile', fileId)
    },
    
    // Dialog APIs
    dialog: {
      openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
      openDirectory: (options) => ipcRenderer.invoke('dialog:openDirectory', options)
    },
    
    // Shell APIs
    shell: {
      openPath: (path) => ipcRenderer.invoke('shell:openPath', path)
    },
    
    // Projects APIs
    projects: {
      getProjects: () => ipcRenderer.invoke('projects:getProjects'),
      createProject: (projectData) => ipcRenderer.invoke('projects:createProject', projectData),
      deleteProject: (projectId) => ipcRenderer.invoke('projects:deleteProject', projectId),
      getProject: (projectId) => ipcRenderer.invoke('projects:getProject', projectId),
      updateProjectProgress: (projectId, progress) => 
        ipcRenderer.invoke('projects:updateProjectProgress', projectId, progress)
    },
    
    // Add this new section for clarification APIs
    clarification: {
      getQuestions: (params) => ipcRenderer.invoke('clarification:getQuestions', params),
      submitAnswers: (params) => ipcRenderer.invoke('clarification:submitAnswers', params),
      generateTodo: (params) => ipcRenderer.invoke('clarification:generateTodo', params)
    }
  }
);