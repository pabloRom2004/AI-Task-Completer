// src/renderer/taskDefinition.js
// Handles the task definition and clarification process

// Helper function to load a local prompt file and replace placeholders
async function loadPrompt(promptPath, replacements = {}) {
  const response = await fetch(promptPath);
  let prompt = await response.text();
  
  for (const key in replacements) {
    const regex = new RegExp(`{${key}}`, 'g');
    prompt = prompt.replace(regex, replacements[key]);
  }
  
  return prompt;
}

export function setupTaskDefinition() {
  // DOM Elements for clarification
  const questionContainer = document.getElementById('questionContainer');
  const questionAnswer = document.getElementById('questionAnswer');
  const skipQuestionBtn = document.getElementById('skipQuestion');
  const nextQuestionBtn = document.getElementById('nextQuestion');
  
  // DOM Elements for output
  const globalContextOutput = document.getElementById('globalContextOutput')?.querySelector('.content');
  const todoListOutput = document.getElementById('todoListOutput')?.querySelector('.content');
  
  // Flow state
  let originalTask = "";
  let clarifyingQuestions = []; 
  let currentQuestionIndex = 0;
  let answers = {}; 
  let additionalQuestionsAttempted = false;
  
  setupExamplePromptAnimation();

  setupTestPromptButton();
  /**
   * Step 1: Start task clarification process
   */
  window.addEventListener('start-task-clarification', (event) => {
    originalTask = event.detail.taskDescription;
    
    // Reset state
    clarifyingQuestions = [];
    currentQuestionIndex = 0;
    answers = {};
    // Remove additionalQuestionsAttempted flag as it's no longer needed
    
    // Show loading state in question container
    questionContainer.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner"></div>
        <p>Analyzing your task and preparing questions...</p>
      </div>
    `;
    
    // Start the questioning process with our unified function
    generateOrUpdateQuestions();
  });
  
  /**
 * Extracts JSON object from AI response text.
 * Handles cases where the AI might include explanatory text before/after the JSON.
 * 
 * @param {string} text - The AI response text
 * @returns {Object|null} - Parsed JSON object or null if invalid/not found
 */
  function extractJSON(text) {
    // Find the first opening brace and the last closing brace
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || firstBrace > lastBrace) {
      console.error('No valid JSON object found in response');
      return null;
    }
    
    // Extract the potential JSON string
    const jsonStr = text.substring(firstBrace, lastBrace + 1);
    
    try {
      // Attempt to parse the extracted string
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Error parsing extracted JSON:', e);
      
      // If direct extraction fails, try a more lenient regex approach
      try {
        // Look for objects with the expected structure
        const regex = /{[\s\S]*?"needsMoreQuestions"[\s\S]*?}/;
        const match = text.match(regex);
        if (match && match[0]) {
          return JSON.parse(match[0]);
        }
      } catch (regexError) {
        console.error('Regex extraction also failed:', regexError);
      }
      
      return null;
    }
  }

  // Replace the existing generateOrUpdateQuestions function with this updated version
  async function generateOrUpdateQuestions() {
    try {
      // Show loading state
      questionContainer.innerHTML = `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Analyzing your task and preparing questions...</p>
        </div>
      `;
      
      // Disable interaction during loading
      questionAnswer.disabled = true;
      skipQuestionBtn.disabled = true;
      nextQuestionBtn.disabled = true;
      
      // Construct conversation history
      const conversation = reconstructConversation();
      
      // Load the unified prompt with title extraction
      const clarifyingPrompt = await loadPrompt('prompts/task-clarification.txt', {
        userTask: originalTask,
        conversation: conversation
      });
      
      // Non-streaming call for JSON response
      const clarifyingResponse = await window.electronAPI.sendMessage(
        clarifyingPrompt,
        'deepseek/deepseek-chat-v3-0324:free',
        null,
        false
      );
      
      // Extract JSON using our custom function
      const parsed = extractJSON(clarifyingResponse);
      
      if (!parsed) {
        console.error("Failed to extract valid JSON from response");
        finalizeTaskDefinition();
        return;
      }
      
      // Check if we have a title and are using the default project
      if (parsed.title) {
        // Check if current project is the default one
        try {
          const currentProject = await window.electronAPI.getCurrentProject();
          if (currentProject && currentProject.isDefault) {
            // Rename the default project
            await window.electronAPI.renameProject(currentProject.name, parsed.title);
            console.log(`Renamed default project to: ${parsed.title}`);
          }
        } catch (error) {
          console.error("Error updating project title:", error);
        }
      }
      
      if (parsed.needsMoreQuestions === false) {
        // No more questions needed, proceed to finalization
        finalizeTaskDefinition();
        return;
      }
      
      // Add new questions to the list
      if (parsed.questions && parsed.questions.length > 0) {
        const newQuestions = parsed.questions.map((q, i) => ({
          id: `q${clarifyingQuestions.length + i + 1}`,
          question: q.question,
          hint: q.hint
        }));
        
        // Add to existing questions
        clarifyingQuestions = [...clarifyingQuestions, ...newQuestions];
        
        // Reset to show first new question
        currentQuestionIndex = clarifyingQuestions.length - newQuestions.length;
        
        // Show the next question
        showCurrentQuestion();
      } else {
        // No questions but needsMoreQuestions is true - edge case
        finalizeTaskDefinition();
      }
      
      // Re-enable interaction
      questionAnswer.disabled = false;
      skipQuestionBtn.disabled = false;
      nextQuestionBtn.disabled = false;
    } catch (error) {
      console.error("Error generating clarifying questions:", error);
      finalizeTaskDefinition();
    }
  }
  
  // Update showCurrentQuestion to use our new function
  function showCurrentQuestion() {
    if (currentQuestionIndex >= clarifyingQuestions.length) {
      // We've gone through all current questions, check if we need more
      generateOrUpdateQuestions();
      return;
    }
    
    const q = clarifyingQuestions[currentQuestionIndex];
    questionContainer.innerHTML = `
      <h3>Question ${currentQuestionIndex + 1}</h3>
      <p class="question-text">${q.question}</p>
      ${q.hint ? `<p class="question-hint">${q.hint}</p>` : ''}
    `;
    questionAnswer.value = "";
    
    // Focus on answer field
    questionAnswer.focus();
  }
  
  // Skip a question
  skipQuestionBtn.addEventListener('click', () => {
    const q = clarifyingQuestions[currentQuestionIndex];
    answers[q.id] = "unsure/skip";
    currentQuestionIndex++;
    showCurrentQuestion();
  });
  
  // Answer a question
  nextQuestionBtn.addEventListener('click', () => {
    const userAns = questionAnswer.value.trim() || "unsure/skip";
    const q = clarifyingQuestions[currentQuestionIndex];
    answers[q.id] = userAns;
    currentQuestionIndex++;
    showCurrentQuestion();
  });
  
  // Enter key to submit answer
  questionAnswer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      nextQuestionBtn.click();
    }
  });
  
  /**
 * Sets up the animated typing of example prompts in the task description field
 */
function setupExamplePromptAnimation() {
  const taskField = document.getElementById('initialTaskDescription');
  if (!taskField) return;
  
  // Enhanced example prompts with bullet points, numbered lists, and varied lengths - unchanged
  const examplePrompts = [
    {
      mainConcept: "Build a browser extension that helps with language learning",
      details: `The extension should detect the language of the webpage and provide instant translations when hovering over words.

  Features:
  1. Support for at least 5 languages (Spanish, French, German, Japanese, and Mandarin)
  2. Personal vocabulary tracking system that remembers words you've learned
  3. Spaced repetition quiz system that adapts to your performance
  4. Context-aware translations that consider the surrounding text

  The UI must be minimal and non-intrusive with:
  - Customizable themes (dark/light mode)
  - Keyboard shortcuts for quick access
  - Option to disable on certain websites
  - Adjustable font size and style for accessibility`
    },
    {
      mainConcept: "Develop a 2D platformer game with gravity-shifting mechanics",
      details: `The player controls a character in a surreal world where gravity direction can be manipulated in four directions.

  Story elements:
  - Protagonist is a dimensional physicist trapped in an experiment gone wrong
  - Collectible journal entries reveal the narrative as player progresses
  - Multiple endings based on player choices and collected items

  Game design:
  1. 30 progressively challenging levels across 3 distinct worlds
  2. 5 unique enemy types with different gravity-related behaviors
  3. Boss battles requiring creative use of gravity mechanics
  4. Hidden areas and secrets that reward exploration
  5. Upgradable abilities that enhance gravity manipulation`
    },
    {
      mainConcept: "Create a comprehensive personal finance tracker with predictive analytics",
      details: `Design an application that not only tracks expenses but uses AI to predict future financial trends and provide actionable insights.

  Core functionality:
  1. Automatic import from bank statements and credit cards
  2. AI-powered transaction categorization with learning capabilities
  3. Budget setting with customizable categories and sub-categories
  4. Real-time alerts for unusual spending patterns or potential fraud
  5. Bill payment reminders with calendar integration

  Analytics dashboard showing:
  - Monthly spending breakdowns with comparative analysis
  - Debt reduction forecasting and optimization suggestions
  - Investment portfolio performance tracking
  - Retirement savings projections based on current habits
  - "What-if" scenario modeling for major life decisions (buying a home, career change, etc.)

  The system should generate personalized recommendations for:
  - Optimizing spending habits
  - Identifying potential tax deductions
  - Suggesting investment opportunities based on risk tolerance
  - Detecting subscription services that aren't being utilized`
    },
    {
      mainConcept: "Design a nutrition and meal planning system for professional athletes",
      details: `Create a comprehensive platform that synchronizes nutrition with training schedules to optimize athletic performance.

  Athlete profiling:
  - Body composition analysis integration
  - Sport-specific energy expenditure calculations
  - Genetic factors consideration for personalized nutrition
  - Injury history and recovery needs assessment

  Meal planning features:
  1. AI-generated meal plans based on training phase (pre-season, competition, recovery)
  2. Automatic adjustment of macronutrient ratios based on training intensity
  3. Hydration scheduling and reminders
  4. Supplement timing recommendations with scientific rationale

  Performance correlation:
  - Track key performance indicators against nutritional compliance
  - Correlate recovery metrics with specific nutritional interventions
  - Generate visualizations showing the relationship between nutrition and performance metrics
  - Provide predictive analytics for performance based on nutritional adjustments`
    },
    {
      mainConcept: "Build an AI-powered writing assistant for creative fiction authors",
      details: `Develop a specialized tool that helps fiction writers overcome blocks, maintain consistency, and enhance their creative output.

  The system should include:
  1. Character consistency tracking to flag contradictions in traits, dialogue patterns, or actions
  2. World-building database with relationship mapping and timeline visualization
  3. Genre-specific suggestion engine for plot developments and scene structuring
  4. Stylistic analysis that identifies overused phrases, passive voice, and pacing issues

  Advanced features:
  - "What-if" scenario generation to explore alternative plot directions
  - Emotional arc mapping to ensure character development feels natural
  - Dialogue enhancement suggestions based on character personality profiles
  - Reader emotion prediction based on narrative techniques employed

  Research capabilities:
  - Historical accuracy verification for period pieces
  - Scientific plausibility checking for science fiction concepts
  - Geographical and cultural reference validation
  - Literary device identification and suggestion for strengthening themes`
    }
  ];
  
  let currentIndex = 0;
  let typingTimeout;
  let backspaceTimeout;
  let blinkInterval;
  let currentText = '';
  let isTyping = false;
  let isAnimating = false;  // Track if animation is currently running
  let isFocused = false;    // Track if field is focused
  
  // Start cursor blinking
  function startCursorBlink() {
    clearInterval(blinkInterval);
    let showCursor = true;
    blinkInterval = setInterval(() => {
      if (!isTyping && !isFocused) {  // Only blink cursor if not typing and not focused
        taskField.setAttribute('placeholder', currentText + (showCursor ? '|' : ''));
        showCursor = !showCursor;
      }
    }, 500);
  }
  
  // Type text one character at a time
  function typeText(text, onComplete, initialDelay = 0) {
    isTyping = true;
    let i = 0;
    
    function typeNextChar() {
      if (isFocused) {  // Stop typing if field is focused
        isTyping = false;
        if (onComplete) onComplete();
        return;
      }
      
      if (i < text.length) {
        // Add character to current text
        currentText += text[i];
        taskField.setAttribute('placeholder', currentText + '|');
        i++;
        
        // Random delay for next character
        let delay;
        const char = text[i - 1];
        if (['.', ',', '!', '?', ':'].includes(char)) {
          // delay = Math.random() * 11 + 5; // Longer pause after punctuation
          delay = 0;
        } else if (char === '\n') {
          // delay = Math.random() * 16 + 5; // Longer pause after newline
          delay = 0;
        } else {
          // delay = Math.random() * 3 + 1; // Normal characters
          delay = 0;
        }
        
        typingTimeout = setTimeout(typeNextChar, delay);
      } else {
        // Typing complete
        isTyping = false;
        if (onComplete) onComplete();
      }
    }
    
    // Start typing after initial delay
    setTimeout(typeNextChar, initialDelay);
  }
  
  // Backspace text one character at a time
  function backspaceText(onComplete) {
    isTyping = true;
    
    function backspaceNextChar() {
      if (isFocused) {  // Stop backspacing if field is focused
        isTyping = false;
        if (onComplete) onComplete();
        return;
      }
      
      if (currentText.length > 0) {
        // Remove last character (or multiple characters for faster effect)
        currentText = currentText.slice(0, -8);
        taskField.setAttribute('placeholder', currentText + '|');
        
        // Faster backspace speed
        const delay = 0;
        backspaceTimeout = setTimeout(backspaceNextChar, delay);
      } else {
        // Backspace complete
        isTyping = false;
        if (onComplete) onComplete();
      }
    }
    
    backspaceNextChar();
  }
  
  // Start the animation cycle
  function startAnimationCycle() {
    if (isAnimating || isFocused) return;  // Prevent animation if focused or already animating
    isAnimating = true;
    
    // Reset variables
    clearTimeout(typingTimeout);
    clearTimeout(backspaceTimeout);
    currentText = '';
    
    const example = examplePrompts[currentIndex];
    
    // Type main concept
    typeText(example.mainConcept, () => {
      // Wait 3 seconds
      setTimeout(() => {
        if (isFocused) {  // Check if focused before continuing
          isAnimating = false;
          return;
        }
        // Type details
        typeText('\n\n' + example.details, () => {
          // Wait 5 seconds
          setTimeout(() => {
            if (isFocused) {  // Check if focused before continuing
              isAnimating = false;
              return;
            }
            // Delete everything
            backspaceText(() => {
              // Move to next example
              currentIndex = (currentIndex + 1) % examplePrompts.length;
              isAnimating = false;  // Mark animation as complete
              if (!isFocused) {  // Only continue if not focused
                setTimeout(startAnimationCycle, 500);
              }
            });
          }, 1500);
        });
      }, 1500);
    });
  }
  
  // Function to stop all animations
  function stopAllAnimations() {
    clearTimeout(typingTimeout);
    clearTimeout(backspaceTimeout);
    clearInterval(blinkInterval);
    isTyping = false;
    isAnimating = false;
    currentText = '';
  }
  
  // Stop animation when user focuses
  taskField.addEventListener('focus', () => {
    // Clear placeholder and stop animation
    taskField.setAttribute('placeholder', '');
    isFocused = true;  // Set focus flag
    stopAllAnimations();
  });
  
  // Restart animation when user clicks away (if field is empty)
  taskField.addEventListener('blur', () => {
    isFocused = false;  // Clear focus flag
    if (taskField.value === '') {
      stopAllAnimations();
      
      // Add 2-second delay before restarting animation
      setTimeout(() => {
        if (!isFocused) {  // Only restart if still not focused
          startCursorBlink();
          startAnimationCycle();
        }
      }, 2000);
    }
  });
  
  // Start blinking and animation initially
  startCursorBlink();
  startAnimationCycle();
  
  // Return cleanup function
  return function cleanupAnimation() {
    stopAllAnimations();
  };
}
  
  /**
   * Sets up the Test Prompt button functionality
   */
  function setupTestPromptButton() {
    const testPromptButton = document.getElementById('testPromptButton');
    const taskField = document.getElementById('initialTaskDescription');
    
    if (testPromptButton && taskField) {
      testPromptButton.addEventListener('click', () => {
        taskField.value = "Develop a 2D platformer game with gravity-shifting mechanics";
        
        // Add a subtle highlight animation
        taskField.classList.add('highlight-animation');
        setTimeout(() => {
          taskField.classList.remove('highlight-animation');
        }, 1000);
        
        // Focus the textarea
        taskField.focus();
      });
    }
  }

  /**
   * Finalize task definition by generating global context and to-do list
   */
  async function finalizeTaskDefinition() {
    // Show loading in results area
    window.dispatchEvent(new CustomEvent('clarification-complete'));
    
    if (globalContextOutput) {
      globalContextOutput.innerHTML = `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Generating global context...</p>
        </div>
      `;
    }
    
    if (todoListOutput) {
      todoListOutput.innerHTML = `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Creating to-do list...</p>
        </div>
      `;
    }
    
    // Reconstruct conversation
    const conversation = reconstructConversation();
    
    // 3a) Generate & save the Global Context
    try {
      const globalPrompt = await loadPrompt('prompts/global-context/create-context.txt', {
        conversation
      });
      
      const globalContext = await window.electronAPI.sendMessage(
        globalPrompt,
        'deepseek/deepseek-chat-v3-0324:free',
        null,
        false
      );
      
      await window.electronAPI.saveGlobalContext(globalContext);
      if (globalContextOutput) {
        globalContextOutput.innerHTML = globalContext;
      }
    } catch (error) {
      console.error("Error generating global context:", error);
      if (globalContextOutput) {
        globalContextOutput.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
      }
    }
    
    // 3b) Generate & save the To-Do List
    try {
      const todoPrompt = await loadPrompt('prompts/task-breakdown/task-breakdown.txt', {
        conversation
      });
      
      const todoListResponse = await window.electronAPI.sendMessage(
        todoPrompt,
        'deepseek/deepseek-chat-v3-0324:free',
        null,
        false
      );
      
      let todoListJson;
      try {
        todoListJson = JSON.parse(todoListResponse);
        await window.electronAPI.saveTodoList(todoListJson);
        
        // Format JSON for display
        if (todoListOutput) {
          todoListOutput.innerHTML = JSON.stringify(todoListJson, null, 2);
        }
      } catch (e) {
        console.error("Failed to parse to-do list JSON:", e);
        if (todoListOutput) {
          todoListOutput.innerHTML = todoListResponse;
        }
      }
    } catch (error) {
      console.error("Error generating to-do list:", error);
      if (todoListOutput) {
        todoListOutput.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
      }
    }
  }
  
  /**
   * Reconstruct the conversation text for context
   */
  function reconstructConversation() {
    let convo = `Task Description:\n"${originalTask}"\n\nClarifying Responses:\n`;
    
    clarifyingQuestions.forEach((q, i) => {
      if (i < currentQuestionIndex || additionalQuestionsAttempted) {
        const ans = answers[q.id] || "unsure/skip";
        convo += `- ${q.question}\n  Answer: ${ans}\n`;
      }
    });
    
    return convo;
  }
}