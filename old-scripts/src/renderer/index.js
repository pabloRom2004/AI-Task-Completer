// Import the interactive background module
import { setupInteractiveBackground } from '../background/interactiveBackground.js';

// Import UI components
import { initMainMenu } from '../main-menu/ui.js';
import { initProjectSidebar } from '../projects/sidebar.js';
import { initFileManager } from '../files/ui.js';

// Import the clarification questions UI
// This will register its event listeners when imported
import '../clarification-questions/ui.js';

// Global UI state
let projectsUI;
let fileManager;
let mainMenu;

// Initialize components when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log("Initializing renderer UI");
  
  // Set up the interactive background
  setupInteractiveBackground();
  
  // Setup page transitions and visibility
  const pages = {
    taskEntry: document.getElementById('taskEntryPage'),
    clarification: document.getElementById('taskClarificationPage'),
    todoExecution: document.getElementById('todoExecutionPage')
  };
  
  // Make sure all pages exist in the DOM
  if (!pages.taskEntry) {
    console.error('Task entry page element not found');
  }
  
  if (!pages.clarification) {
    console.error('Clarification page element not found');
  }
  
  if (!pages.todoExecution) {
    console.error('Todo execution page element not found');
  }
  
  // Initialize with task entry page visible
  if (pages.taskEntry) {
    pages.taskEntry.style.display = 'flex';
  }
  
  // Hide other pages
  if (pages.clarification) {
    pages.clarification.style.display = 'none';
  }
  
  if (pages.todoExecution) {
    pages.todoExecution.style.display = 'none';
  }
  
  // Global navigation function (can be used for testing/debugging)
  window.navigateTo = (pageId) => {
    Object.values(pages).forEach(page => {
      if (page) page.style.display = 'none';
    });
    
    if (pages[pageId]) {
      pages[pageId].style.display = 'flex';
      
      // Trigger custom events for page transitions
      const event = new CustomEvent(`${pageId}PageShown`, { 
        detail: { timestamp: new Date().toISOString() } 
      });
      document.dispatchEvent(event);
    }
  };
  
  // Make sure Electron API is ready
  if (!window.electronAPI) {
    console.warn("Waiting for ElectronAPI initialization...");
    
    // Set a timeout to check if ElectronAPI is ready
    setTimeout(() => {
      if (window.electronAPI) {
        // Initialize components
        mainMenu = initMainMenu();
        projectsUI = initProjectSidebar();
        fileManager = initFileManager();
      } else {
        console.error("ElectronAPI not properly initialized after timeout");
      }
    }, 500);
  } else {
    // Initialize the main menu UI
    mainMenu = initMainMenu();
    
    // Initialize the projects UI
    projectsUI = initProjectSidebar();
    
    // Initialize file manager
    fileManager = initFileManager();
  }
  
  // Listen for events to transition between pages
  document.addEventListener('taskClarificationStart', (event) => {
    console.log('Task clarification started:', event.detail);
    window.navigateTo('clarification');
  });
  
  document.addEventListener('todoListReady', (event) => {
    console.log('Todo list ready:', event.detail);
    window.navigateTo('todoExecution');
  });
});