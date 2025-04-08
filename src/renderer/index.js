import { setupInteractiveBackground } from '../background/interactiveBackground.js';
import { initPlaceholderAnimation } from './placeholderAnimation.js';
import { initSettingsUI } from './ui/settingsUI.js';

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI components
    initializeUI();

    setupInteractiveBackground();

    // Set up event listeners
    setupEventListeners();

    // Initialize settings UI
    initSettingsUI();

    // Console log app info from preload
    console.log('App info:', window.electronAPI.getAppInfo());
});

/**
 * Initialize UI components and default state
 */
function initializeUI() {
    // Get page elements
    const taskEntryPage = document.getElementById('taskEntryPage');
    const taskClarificationPage = document.getElementById('taskClarificationPage');
    const todoExecutionPage = document.getElementById('todoExecutionPage');

    // Set initial visibility (only show task entry)
    taskEntryPage.style.display = 'flex';
    taskClarificationPage.style.display = 'none';
    todoExecutionPage.style.display = 'none';

    // Initialize the textarea animation for placeholder
    initPlaceholderAnimation();
}

/**
 * Set up event listeners for UI interactions
 */
function setupEventListeners() {
    // Task entry buttons
    setupTaskEntryListeners();

    // Settings modal
    setupSettingsModalListeners();
}

/**
 * Set up listeners for the task entry page
 */
function setupTaskEntryListeners() {
    const startTaskButton = document.getElementById('startTaskEntry');

    startTaskButton.addEventListener('click', () => {
        console.log('Start task button clicked');
        // Will implement navigation to clarification page later
    });
}

/**
 * Set up listeners for the settings modal
 */
function setupSettingsModalListeners() {
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const closeModalBottom = document.getElementById('closeModalBottom');

    settingsButton.addEventListener('click', () => {
        settingsModal.style.display = 'block';
    });

    closeSettings.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    closeModalBottom.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });
}