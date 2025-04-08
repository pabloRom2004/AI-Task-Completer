/**
 * Manages animated placeholder text for the task description textarea
 * Displays example prompts with a typing animation effect
 */

import { examplePrompts } from './data/examplePrompts.js';

// Animation control variables
let typingInterval = null;
let currentPromptIndex = 0; 
let isTyping = false;
let currentText = '';
let charIndex = 0;
let userInteracted = false;
let textareaElement = null;
let testPromptButton = null;

/**
 * Initialize the placeholder animation
 * @param {string} textareaId - The ID of the textarea element
 * @param {string} buttonId - The ID of the test prompt button
 */
export function initPlaceholderAnimation(textareaId = 'initialTaskDescription', buttonId = 'testPromptButton') {
  // Get the DOM elements
  textareaElement = document.getElementById(textareaId);
  testPromptButton = document.getElementById(buttonId);
  
  if (!textareaElement) {
    console.error(`Textarea element with ID '${textareaId}' not found`);
    return;
  }
  
  // Set up event listeners
  setupEventListeners();
  
  // Start with a random prompt
  currentPromptIndex = Math.floor(Math.random() * examplePrompts.length);
  startTypingAnimation();
}

/**
 * Sets up the typing animation for example prompts
 */
function startTypingAnimation() {
  // Don't start animation if user has interacted with the textarea
  if (document.activeElement === textareaElement || userInteracted) {
    return;
  }

  stopTypingAnimation(); // Clear any existing animation

  const currentPrompt = examplePrompts[currentPromptIndex];
  currentText = '';
  charIndex = 0;
  isTyping = true;

  // Clear the placeholder and set typing speed
  textareaElement.placeholder = '';
  const typingSpeed = 15; // milliseconds per character

  typingInterval = setInterval(() => {
    if (charIndex < currentPrompt.length) {
      // Add the next character
      currentText += currentPrompt.charAt(charIndex);
      textareaElement.placeholder = currentText;
      charIndex++;
    } else {
      // Finished typing the current prompt
      clearInterval(typingInterval);
      isTyping = false;

      // Wait 2.5 seconds, then fade out
      setTimeout(() => {
        fadeOutPlaceholder(() => {
          // After fade out is complete, move to next prompt after 1 second
          setTimeout(() => {
            currentPromptIndex = (currentPromptIndex + 1) % examplePrompts.length;
            startTypingAnimation();
          }, 1000);
        });
      }, 2500);
    }
  }, typingSpeed);
}

/**
 * Stops the typing animation
 */
function stopTypingAnimation() {
  if (typingInterval) {
    clearInterval(typingInterval);
    typingInterval = null;
  }
  isTyping = false;
}

/**
 * Fades out the placeholder text
 * @param {Function} callback - Function to call when fade is complete
 */
function fadeOutPlaceholder(callback) {
  textareaElement.classList.add('text-fade-out');

  setTimeout(() => {
    textareaElement.placeholder = '';
    textareaElement.classList.remove('text-fade-out');
    if (callback) callback();
  }, 500);
}

/**
 * Sets up event listeners for textarea interactions
 */
function setupEventListeners() {
  // Test prompt button - apply highlight animation and set test prompt
  if (testPromptButton) {
    testPromptButton.addEventListener('click', () => {
      testPromptButton.classList.add('highlight-animation');
      
      // Reset the textarea to ensure it's clickable
      resetTextareaInteraction();
      
      // Use the first example as the test prompt
      textareaElement.value = 'Develop a 2D platformer game with gravity-shifting mechanics';
      userInteracted = true;
      
      // Stop placeholder animation when a prompt is inserted
      stopTypingAnimation();
      textareaElement.placeholder = '';
      
      // Force focus on textarea
      setTimeout(() => {
        textareaElement.focus();
      }, 50);
      
      // Remove animation class after it completes
      setTimeout(() => {
        testPromptButton.classList.remove('highlight-animation');
      }, 1000);
    });
  }

  // Stop animation when user focuses on textarea
  textareaElement.addEventListener('focus', () => {
    userInteracted = true;
    stopTypingAnimation();
    textareaElement.placeholder = '';
  });

  // Handle clicks on textarea explicitly to force focus
  textareaElement.addEventListener('click', (e) => {
    textareaElement.focus();
    e.stopPropagation();
    userInteracted = true;
  });

  // Resume animation when user blurs textarea if it's empty
  textareaElement.addEventListener('blur', () => {
    if (!textareaElement.value.trim()) {
      // Reset the user interaction flag when blurring an empty textarea
      userInteracted = false;

      setTimeout(() => {
        // Randomize which prompt to show next
        currentPromptIndex = Math.floor(Math.random() * examplePrompts.length);
        startTypingAnimation();
      }, 1000);
    }
  });

  // Detect user interaction with textarea
  textareaElement.addEventListener('input', () => {
    userInteracted = true;
  });
}

/**
 * Reset textarea interaction state to ensure it's clickable
 */
export function resetTextareaInteraction() {
  if (!textareaElement) return;
  
  textareaElement.disabled = false;
  textareaElement.style.pointerEvents = 'auto';

  // Reset the user interaction flag if the textarea is empty
  if (!textareaElement.value.trim()) {
    userInteracted = false;
  }
}