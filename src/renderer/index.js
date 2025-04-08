import { setupInteractiveBackground } from '../background/interactiveBackground.js';
import { initPlaceholderAnimation } from './placeholderAnimation.js';
import { initSettingsUI } from './ui/settingsUI.js';
import { initClarificationUI } from './ui/clarificationUI.js';
import { initContextUI } from './ui/contextUI.js';
import { initTodoUI } from './ui/todoUI.js';

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI components
    initializeUI();

    duplicateBackgroundCanvas();

    // Set up event listeners
    setupEventListeners();

    initSettingsUI();
    initClarificationUI();
    initContextUI();
    initTodoUI();

    // Console log app info from preload
    console.log('App info:', window.electronAPI.getAppInfo());
});

function duplicateBackgroundCanvas() {
    const originalCanvas = document.getElementById('bgCanvas');
    const clarificationCanvas = document.getElementById('clarificationBgCanvas');
    const executionCanvas = document.getElementById('executionBgCanvas');

    if (originalCanvas && clarificationCanvas && executionCanvas) {
        // Make sure all canvases use the same setup
        setupInteractiveBackground();
    }
}

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
    const testPromptButton = document.getElementById('testPromptButton');
    const initialTaskDescription = document.getElementById('initialTaskDescription');
    const taskEntryPage = document.getElementById('taskEntryPage');
    const clarificationPage = document.getElementById('taskClarificationPage');

    // In your setupTaskEntryListeners function:
    startTaskButton.addEventListener('click', () => {
        const taskText = initialTaskDescription.value.trim();

        if (!taskText) {
            alert('Please enter a task description before continuing.');
            return;
        }

        // Transition to clarification page with loading state
        taskEntryPage.style.display = 'none';
        clarificationPage.style.display = 'flex';

        // Show loading state before API call
        const questionContainer = document.getElementById('questionContainer');
        questionContainer.classList.add('loading');

        // Reset progress bar
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = 'Preparing questions...';

        // Trigger clarification process
        const event = new CustomEvent('taskClarificationStart', {
            detail: {
                taskDescription: taskText
            }
        });

        document.dispatchEvent(event);
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