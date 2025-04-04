const { BrowserWindow } = require('electron');
const path = require('path');
const { setupIPC } = require('./ipc');
const fileSystem = require('./fileSystem'); // Added the missing import

let mainWindow;

// We'll no longer initialize projects automatically at startup
// The project will be created only when the first message is sent

/**
 * Creates main application window and sets up IPC
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../../preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#121212', // Match the dark theme
    show: false // Don't show until ready-to-show
  });

  // Show window once content is ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, '../../index.html'));
  
  // Uncomment for development
  // mainWindow.webContents.openDevTools();
  
  // Set up IPC handlers
  setupIPC(mainWindow);
  
  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Initialize projects directory but don't create default project
  await fileSystem.initializeProjectsDirectory();

  return mainWindow;
}

module.exports = { createWindow, mainWindow };