const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// specific electron APIs without exposing the entire API
contextBridge.exposeInMainWorld('electronAPI', {
    // Basic app info
    getAppInfo: () => {
        return {
            name: 'Do Way More',
            version: '0.1.0'
        }
    },

    // Settings API
    settings: {
        getAll: () => ipcRenderer.invoke('settings:get'),
        save: (settings) => ipcRenderer.invoke('settings:save', settings),
        update: (settings) => ipcRenderer.invoke('settings:update', settings),

        // Model API call
        callModel: (params) => ipcRenderer.invoke('model:call', params)
    },

    // Logs API
    logs: {
        getSessionPath: () => ipcRenderer.invoke('logs:getPath')
    },
    
    // File system operations
    files: {
        selectFolder: () => ipcRenderer.invoke('files:selectFolder'),
        getProjectFolder: () => ipcRenderer.invoke('files:getProjectFolder'),
        readFile: (path) => ipcRenderer.invoke('files:readFile', path),
        writeFile: (path, content) => ipcRenderer.invoke('files:writeFile', path, content),
        listFiles: () => ipcRenderer.invoke('files:listFiles'),
        openFile: (path) => ipcRenderer.invoke('files:openFile', path) // New method
    }
});