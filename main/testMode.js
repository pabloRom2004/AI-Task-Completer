/**
 * Test mode functionality to simulate AI responses
 * Saves API credits by using predefined responses
 */

// Current test mode state
let testModeEnabled = false;

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
  console.log(`Test mode ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Initialize test mode from saved settings
 */
export function initTestMode() {
  const savedSetting = localStorage.getItem('testModeEnabled');
  testModeEnabled = savedSetting === 'true';
  
  // Synchronize with UI if available
  const testModeToggle = document.getElementById('testModeToggle');
  if (testModeToggle) {
    testModeToggle.checked = testModeEnabled;
  }
}

/**
 * Get a simulated response for the Unity platformer project
 * @param {string} message - The user's message
 * @param {string} taskId - The current task ID
 * @returns {string} The simulated AI response
 */
export function getSimulatedResponse(message, taskId) {
  // Basic response based on task ID and message
  const responses = {
    // Project Setup responses
    'task1': {
      'default': "To create a new Unity 2D project, first open Unity Hub. Click on the 'New' button, select the '2D' template, give your project a name like 'GravityShifter', choose a location, and click 'Create project'. This will set up a new empty 2D project with the correct settings for 2D game development.",
      'what version': "For this 2D platformer, I recommend using Unity 2022.3 LTS (Long Term Support) as it's stable and has excellent 2D tools. The newer versions have improved 2D features but LTS versions ensure stability throughout your development.",
      'help': "Let's create a new Unity project. Launch Unity Hub, click 'New', select '2D' template, name it 'GravityShifter', choose a location on your drive with enough space, and hit 'Create'. Would you like advice on project organization or settings to adjust after creation?"
    },
    
    // Player Character Setup responses
    'task4': {
      'default': "To create the player GameObject, right-click in the Hierarchy window and select 'Create Empty'. Rename it to 'Player'. Then, add a SpriteRenderer component by selecting the GameObject and clicking 'Add Component' in the Inspector. Search for 'Sprite Renderer' and add it. For testing, you can assign a simple square sprite from Unity's default sprites or create a placeholder in any image editor.",
      'rigidbody': "Let's add a Rigidbody2D component to the player. Select your Player GameObject, click 'Add Component' in the Inspector, and search for 'Rigidbody2D'. For a platformer with gravity-shifting, set 'Gravity Scale' to 1, 'Body Type' to 'Dynamic', and enable 'Freeze Rotation' so the player doesn't rotate when colliding with objects.",
      'help': "To create your player GameObject, I'll guide you through the basic setup. In the Hierarchy window, right-click → Create Empty → name it 'Player'. Then with it selected, click 'Add Component' in the Inspector and add both a 'Sprite Renderer' and a 'Rigidbody2D'. For testing, you can use a simple square sprite. Would you like me to explain how to configure these components specifically for a gravity-shifting game?"
    },
    
    // Generic fallback responses
    'generic': [
      "That's a great question about the Unity platformer. Based on your current task, I'd suggest focusing on getting the basic functionality working first, then refining it. Start with simple placeholder graphics and make sure the mechanics feel good before spending too much time on visuals.",
      
      "For your gravity-shifting platformer, remember that player feedback is crucial. When gravity shifts, add visual cues like screen rotation, particle effects, or color changes to help the player understand what's happening. Good game feel will make your mechanics more intuitive.",
      
      "When implementing your gravity mechanic, consider using Physics2D.gravity to change the global gravity. This will affect all rigidbodies in your scene. For rotating the player, you can use transform.rotation = Quaternion.FromToRotation(Vector2.up, -Physics2D.gravity.normalized) to align them with the current gravity direction.",
      
      "Unity's 2D physics system works well for platformers, but you might need to adjust the physics materials to get the right feel. Try creating a Physics2D Material with zero friction for the player to avoid sticking to walls during gravity shifts.",
      
      "For coding your PlayerMovement script, make sure to separate the gravity control from the movement control. This separation of concerns will make your code cleaner and easier to debug. Consider using a state machine pattern if the player has different states like normal, jumping, or wall-clinging."
    ]
  };
  
  // Extract keywords from the message to find targeted responses
  const messageLower = message.toLowerCase();
  
  // Check if this task has specific responses
  if (responses[taskId]) {
    // Look for keyword matches
    for (const [keyword, response] of Object.entries(responses[taskId])) {
      if (keyword !== 'default' && messageLower.includes(keyword)) {
        return response;
      }
    }
    
    // Return default response for this task if available
    if (responses[taskId].default) {
      return responses[taskId].default;
    }
  }
  
  // Fall back to generic responses if no task-specific match
  const genericResponses = responses.generic;
  const randomIndex = Math.floor(Math.random() * genericResponses.length);
  return genericResponses[randomIndex];
}