// src/main/index.js
const { app } = require('electron');
const { createWindow } = require('./app');

// Application entry point
app.whenReady().then(() => {
  createWindow();
  
  // Create prompt directories if they don't exist
  createPromptDirectories();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Create prompt directory structure
async function createPromptDirectories() {
  const fs = require('fs').promises;
  const path = require('path');
  
  const directories = [
    'prompts/file-descriptions',
    'prompts/global-context',
    'prompts/task-breakdown',
    'prompts/sanity-checks',
    'prompts/error-handling'
  ];
  
  try {
    for (const dir of directories) {
      await fs.mkdir(path.join(__dirname, '../../', dir), { recursive: true });
    }
    console.log('Prompt directories created successfully');
  } catch (error) {
    console.error('Error creating prompt directories:', error);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});