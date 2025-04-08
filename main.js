const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { setupSettingsHandlers } = require('./main/settings.js');
const { setupModelAPIHandlers } = require('./main/modelAPI.js');
const logger = require('./main/logger');

// Keep a global reference of the window object
let mainWindow;

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Load the index.html file
    mainWindow.loadFile('index.html');

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Initialize app
app.whenReady().then(() => {
    const logPath = logger.initLogSession();
    console.log('Logging to:', logPath);
    // Set up IPC handlers for settings
    setupSettingsHandlers(ipcMain);

    // Set up IPC handlers for model API
    setupModelAPIHandlers(ipcMain);

    // Create the window
    createWindow();
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// On macOS, recreate window when dock icon is clicked
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});