/**
 * UI component for displaying the global context
 */

import { getCurrentGlobalContext } from '../services/contextService.js';

// DOM elements
let contextModal;
let contextContent;
let closeContextBtn;
let viewContextBtn;

/**
 * Initialize the context UI
 */
export function initContextUI() {
  
  // Get DOM elements
  contextModal = document.getElementById('contextModal');
  contextContent = document.getElementById('contextContent');
  closeContextBtn = document.getElementById('closeContextBtn');
  viewContextBtn = document.getElementById('viewContextBtn');
  
  // Set up event listeners
  setupEventListeners();
}

/**
 * Set up event listeners for the context UI
 */
function setupEventListeners() {
  // View context button
  if (viewContextBtn) {
    viewContextBtn.addEventListener('click', showGlobalContextDisplay);
  }
  
  // Close button
  if (closeContextBtn) {
    closeContextBtn.addEventListener('click', () => {
      contextModal.style.display = 'none';
    });
  }
  
  // Close when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === contextModal) {
      contextModal.style.display = 'none';
    }
  });
  
  // Listen for context updates
  document.addEventListener('contextUpdated', showGlobalContext);
}

/**
 * Show the global context in the modal
 */
export function showGlobalContext() {
  const context = getCurrentGlobalContext();
  
  if (!context) {
    contextContent.textContent = 'Global context not available yet.';
  } else {
    contextContent.textContent = context;
  }
  
  // contextModal.style.display = 'block';
}

export function showGlobalContextDisplay() {
  contextModal.style.display = 'block';
}

/**
 * Update the displayed context content
 * @param {string} newContext - New context content to display
 */
export function updateContextContent(newContext) {
  if (contextContent) {
    contextContent.textContent = newContext || 'No context available.';
  }
}