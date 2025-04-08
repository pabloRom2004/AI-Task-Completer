/**
 * Settings UI manager
 * Handles interactions with the settings modal
 */

import { initSettingsForm, saveSettingsFromForm } from '../services/settingsService.js';

/**
 * Initialize the settings UI
 */
export function initSettingsUI() {
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const closeModalBottom = document.getElementById('closeModalBottom');

    if (!settingsButton || !settingsModal) {
        console.error('Settings UI elements not found');
        return;
    }

    // Initialize settings form with autosave
    initSettingsForm();

    // Open settings modal
    settingsButton.addEventListener('click', () => {
        settingsModal.style.display = 'block';
    });

    // Close modal with save
    const closeWithSave = async () => {
        await saveSettingsFromForm();
        settingsModal.style.display = 'none';
    };

    // Close buttons
    if (closeSettings) {
        closeSettings.addEventListener('click', closeWithSave);
    }

    if (closeModalBottom) {
        closeModalBottom.addEventListener('click', closeWithSave);
    }

    // Close when clicking outside modal
    window.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            closeWithSave();
        }
    });

    // Show feedback when settings are saved
    document.addEventListener('settings:saved', () => {
        showSavedIndicator();
    });
    // Add to initSettingsUI function:
    const testModeToggle = document.getElementById('testModeToggle');
    if (testModeToggle) {
        // Import the test mode functionality
        import('../services/testMode.js').then(({ isTestModeEnabled, setTestMode, initTestMode }) => {
            // Initialize test mode
            initTestMode();

            // Update checkbox from current state
            testModeToggle.checked = isTestModeEnabled();

            // Add event listener
            testModeToggle.addEventListener('change', (e) => {
                setTestMode(e.target.checked);

                // Show feedback
                showSavedIndicator();
            });
        });
    }
}

/**
 * Display a saved indicator briefly
 */
function showSavedIndicator() {
    const modalContent = document.querySelector('.modal-content');
    if (!modalContent) return;

    // Create indicator element
    const savedIndicator = document.createElement('div');
    savedIndicator.textContent = '✓ Saved';
    savedIndicator.style.position = 'absolute';
    savedIndicator.style.right = '15px';
    savedIndicator.style.bottom = '15px';
    savedIndicator.style.padding = '5px 10px';
    savedIndicator.style.backgroundColor = 'rgba(0, 128, 0, 0.2)';
    savedIndicator.style.color = 'green';
    savedIndicator.style.borderRadius = '3px';
    savedIndicator.style.fontSize = '14px';
    savedIndicator.style.opacity = '0';
    savedIndicator.style.transition = 'opacity 0.3s ease-in-out';

    // Add to modal
    modalContent.appendChild(savedIndicator);

    // Fade in
    setTimeout(() => {
        savedIndicator.style.opacity = '1';
    }, 10);

    // Fade out and remove
    setTimeout(() => {
        savedIndicator.style.opacity = '0';
        setTimeout(() => {
            savedIndicator.remove();
        }, 300);
    }, 2000);
}