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
  // Create the modal if it doesn't exist
  createContextModal();
  
  // Get DOM elements
  contextModal = document.getElementById('contextModal');
  contextContent = document.getElementById('contextContent');
  closeContextBtn = document.getElementById('closeContextBtn');
  viewContextBtn = document.getElementById('viewContextBtn');
  
  // Set up event listeners
  setupEventListeners();
}

/**
 * Create the context modal DOM elements
 */
function createContextModal() {
  // Check if modal already exists
  if (document.getElementById('contextModal')) {
    return;
  }
  
  // Create the modal elements
  const modalHTML = `
    <div id="contextModal" class="modal">
      <div class="modal-content context-modal-content">
        <div class="modal-header">
          <h2>Global Context</h2>
          <button id="closeContextBtn" class="close-button">&times;</button>
        </div>
        <div class="modal-body">
          <pre id="contextContent" class="context-content"></pre>
        </div>
        <div class="modal-footer">
          <button id="closeContextBottomBtn" class="secondary-button">Close</button>
        </div>
      </div>
    </div>
  `;
  
  // Create context view button if it doesn't exist
  if (!document.getElementById('viewContextBtn')) {
    const btnContainer = document.createElement('div');
    btnContainer.className = 'context-btn-container';
    btnContainer.innerHTML = `
      <button id="viewContextBtn" class="secondary-button">View Context</button>
    `;
    
    // Add to to-do execution page
    const todoPage = document.getElementById('todoExecutionPage');
    if (todoPage) {
      todoPage.appendChild(btnContainer);
    }
  }
  
  // Add modal to body
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer.firstElementChild);
  
  // Set up additional event listener for bottom close button
  const closeContextBottomBtn = document.getElementById('closeContextBottomBtn');
  if (closeContextBottomBtn) {
    closeContextBottomBtn.addEventListener('click', () => {
      document.getElementById('contextModal').style.display = 'none';
    });
  }
}

/**
 * Set up event listeners for the context UI
 */
function setupEventListeners() {
  // View context button
  if (viewContextBtn) {
    viewContextBtn.addEventListener('click', showGlobalContext);
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