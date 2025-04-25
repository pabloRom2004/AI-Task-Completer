const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { setupSettingsHandlers } = require('./main/settings.js');
const { setupModelAPIHandlers } = require('./main/modelAPI.js');
const { setupFileSystemHandlers, cleanupFileHandles } = require('./main/fileSystem.js');
const logger = require('./main/logger');

// Keep a global reference of the window object
let mainWindow;
// Track if app is in the process of quitting
let isQuitting = false;

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
    
    // Handle window close event - confirm exit if needed
    mainWindow.on('close', (e) => {
        if (!isQuitting) {
            logger.debugLog('Window close requested, performing cleanup...');
            // Perform cleanup before allowing the window to close
            cleanupFileHandles();
        }
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
    
    // Set up IPC handlers for file system operations
    setupFileSystemHandlers(ipcMain);

    // Create the window
    createWindow();
});

// Handle before-quit event to perform cleanup
app.on('before-quit', () => {
    logger.debugLog('Application is quitting, performing cleanup...');
    isQuitting = true;
    cleanupFileHandles();
});

// Quit when all windows are closed, ensuring cleanup
app.on('window-all-closed', () => {
    logger.debugLog('All windows closed, cleaning up and quitting...');
    
    // Ensure file handles are released
    cleanupFileHandles();
    
    // Quit the app
    app.quit();
    
    // As a fallback, force exit if app hasn't quit within 2 seconds
    setTimeout(() => {
        logger.debugLog('Forcing application exit');
        process.exit(0);
    }, 2000);
});

// On macOS, recreate window when dock icon is clicked
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});