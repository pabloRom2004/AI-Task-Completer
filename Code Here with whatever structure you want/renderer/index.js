// src/renderer/index.js

// Import existing modules
import { setupSettings } from './settings.js';
import { setupTaskDefinition } from './taskDefinition.js';
import { setupTodoExecution } from './todoExecution.js';
import { setupPageNavigation } from './pageNavigation.js';
import { setupChat } from './chat.js';
import { initializeFileManager} from './fileManager.js';
import { initializeProjectManager } from './projectManager.js';

// Import interactive background
import { setupInteractiveBackground } from './interactive-background.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Setup interactive background with dots
  setupInteractiveBackground();
  
  // Setup settings functionality
  setupSettings();
  
  // Setup task definition
  setupTaskDefinition();
  
  // Setup to-do list execution
  setupTodoExecution();
  
  // Setup chat functionality
  setupChat();
  
  // Setup page navigation
  setupPageNavigation();

  initializeFileManager();

  initializeProjectManager();
  
  // Event Listeners for Task Entry
  const startTaskButton = document.getElementById('startTaskEntry');
  if (startTaskButton) {
    startTaskButton.addEventListener('click', () => {
      const taskDescription = document.getElementById('initialTaskDescription').value.trim();
      
      if (!taskDescription) {
        // Shake the textarea if empty
        const taskField = document.getElementById('initialTaskDescription');
        taskField.classList.add('error-shake');
        setTimeout(() => taskField.classList.remove('error-shake'), 500);
        return;
      }
      
      // Trigger task clarification
      window.dispatchEvent(new CustomEvent('start-task-clarification', {
        detail: { taskDescription }
      }));
      
      // Navigate to clarification page
      window.dispatchEvent(new CustomEvent('navigate', {
        detail: { page: 'clarificationPage' }
      }));
    });
  }
  
  // Ensure all pages have the interactive background canvas
  document.querySelectorAll('.page').forEach(page => {
    if (!page.querySelector('.interactive-background')) {
      const canvas = document.createElement('canvas');
      canvas.className = 'interactive-background';
      page.insertBefore(canvas, page.firstChild);
    }
  });
  
  // Re-initialize the interactive background when changing pages
  window.addEventListener('navigate', () => {
    setTimeout(() => {
      setupInteractiveBackground();
    }, 100);
  });
});