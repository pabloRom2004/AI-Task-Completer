/**
 * Test mode functionality to simulate AI responses
 * Saves API credits by using predefined responses
 */

// Current test mode state
let testModeEnabled = false;

// Track if we've already provided the first round of questions
let questionsProvided = false;

/**
 * Check if test mode is enabled
 * @returns {boolean} Whether test mode is enabled
 */
export function isTestModeEnabled() {
  return testModeEnabled;
}

/**
 * Set test mode state
 * @param {boolean} enabled - Whether to enable test mode
 */
export function setTestMode(enabled) {
  testModeEnabled = enabled;
  localStorage.setItem('testModeEnabled', enabled ? 'true' : 'false');
  // Reset the questions state when toggling test mode
  questionsProvided = false;
  console.log(`Test mode ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Initialize test mode from saved settings
 */
export function initTestMode() {
  const savedSetting = localStorage.getItem('testModeEnabled');
  testModeEnabled = savedSetting === 'true';
  
  // Reset the questions state when initializing
  questionsProvided = false;
  
  // Synchronize with UI if available
  const testModeToggle = document.getElementById('testModeToggle');
  if (testModeToggle) {
    testModeToggle.checked = testModeEnabled;
  }
}

/**
 * Get simulated clarification questions
 * @returns {Object} Simulated response with clarification questions
 */
export function getSimulatedClarificationQuestions() {
  // If questions have already been provided, don't ask more
  if (questionsProvided) {
    return {
      needsMoreQuestions: false,
      questions: [] // Empty array indicates no more questions
    };
  }
  
  // Set the flag so we don't ask questions again
  questionsProvided = true;
  
  // First (and only) round of questions
  return {
    needsMoreQuestions: true,
    questions: [
      {
        question: "What specific technologies or frameworks do you plan to use for this project?",
        hint: "For example: React, Node.js, Unity, TensorFlow, etc."
      },
      {
        question: "What is your timeline for completing this project?",
        hint: "This helps determine the scope and prioritization of tasks."
      },
      {
        question: "Do you have any existing code or resources to start with?",
        hint: "This helps understand if we're starting from scratch or building on existing work."
      }
    ]
  };
}

/**
 * Reset the questions state (should be called when starting a new task)
 */
export function resetQuestions() {
  questionsProvided = false;
}

/**
 * Get simulated global context document
 * @returns {Object} Simulated response with global context
 */
export function getSimulatedGlobalContext() {
  return `# Task Execution Assistant

## Project Overview
This project aims to create a comprehensive AI-powered task execution assistant that helps users break down complex tasks into manageable steps and provides implementation guidance. The system will work alongside humans to execute tasks ranging from software development to content creation.

## Technical Requirements
- Electron-based desktop application
- Node.js for backend functionality
- JavaScript for frontend implementation
- OpenRouter API for AI model access
- Support for multiple AI models

## Functional Requirements
- Two-tiered context management (global and local)
- File management system for project resources
- Task breakdown with structured to-do lists
- Progressive implementation assistance
- Simulated responses in test mode to save API credits
- Settings management for API keys and preferences

## Constraints
- Must work on Windows, macOS, and Linux
- Should function without internet connection in test mode
- Must handle projects with varied complexity
- Should optimize API usage to minimize costs

## Resources
- Existing codebase structure
- Electron application framework
- OpenRouter API documentation
- Basic UI components already implemented

## Success Criteria
- Users can successfully complete complex tasks with AI assistance
- Test mode accurately simulates AI responses for UI development
- Tasks are broken down into immediately actionable steps (15-20 minutes each)
- System maintains context throughout task execution

## Assumptions
- Users have basic technical knowledge related to their tasks
- Internet connectivity is available for non-test mode operation
- User will provide feedback on implementation suggestions
`
}

/**
 * Get simulated task breakdown
 * @returns {Object} Simulated response with task breakdown
 */
export function getSimulatedTaskBreakdown() {
  return {
    "title": "2D Platformer with Gravity-Shifting Mechanics",
    "sections": [
      {
        "title": "Project Setup",
        "tasks": [
          {
            "id": "task1",
            "title": "Set up Unity project with 2D template",
            "description": "Create a new Unity project with 2D template and configure basic project settings",
            "status": "pending"
          },
          {
            "id": "task2",
            "title": "Create core folder structure",
            "description": "Set up folders for Scripts, Prefabs, Scenes, and Sprites in the project",
            "status": "pending"
          }
        ]
      },
      {
        "title": "Player Character",
        "tasks": [
          {
            "id": "task3",
            "title": "Create player GameObject with 2D components",
            "description": "Add SpriteRenderer, Rigidbody2D, and Collider2D to player GameObject",
            "status": "pending"
          },
          {
            "id": "task4",
            "title": "Implement basic player movement script",
            "description": "Create script for WASD/arrow key movement with acceleration/deceleration",
            "status": "pending"
          },
          {
            "id": "task5",
            "title": "Implement gravity switching mechanics",
            "description": "Create system to change gravity direction when arrow keys are pressed",
            "status": "pending"
          },
          {
            "id": "task6",
            "title": "Adjust player rotation with gravity changes",
            "description": "Make player character rotate to align with current gravity direction",
            "status": "pending"
          }
        ]
      },
      {
        "title": "Environment",
        "tasks": [
          {
            "id": "task7",
            "title": "Create test platforms with colliders",
            "description": "Design simple platforms and walls with 2D colliders for testing",
            "status": "pending"
          },
          {
            "id": "task8",
            "title": "Implement environment gravity response",
            "description": "Ensure platforms and obstacles respond correctly to gravity changes",
            "status": "pending"
          },
          {
            "id": "task9",
            "title": "Create basic obstacles",
            "description": "Add simple obstacles to demonstrate gravity mechanics",
            "status": "pending"
          }
        ]
      },
      {
        "title": "Camera & Polish",
        "tasks": [
          {
            "id": "task10",
            "title": "Implement camera follow system",
            "description": "Create script to make camera follow player smoothly",
            "status": "pending"
          },
          {
            "id": "task11",
            "title": "Test and adjust physics parameters",
            "description": "Tweak gravity scale, movement speed, and other physics values",
            "status": "pending"
          },
          {
            "id": "task12",
            "title": "Create basic test scene",
            "description": "Arrange platforms and obstacles in a testable configuration",
            "status": "pending"
          }
        ]
      },
      {
        "title": "Testing & Debugging",
        "tasks": [
          {
            "id": "task13",
            "title": "Test all gravity orientations",
            "description": "Verify player movement and collisions in all four gravity directions",
            "status": "pending"
          },
          {
            "id": "task14",
            "title": "Check for physics glitches",
            "description": "Test edge cases where player might get stuck or behave unexpectedly",
            "status": "pending"
          },
          {
            "id": "task15",
            "title": "Final debugging pass",
            "description": "Fix any remaining issues with movement or gravity transitions",
            "status": "pending"
          }
        ]
      }
    ]
  };
}