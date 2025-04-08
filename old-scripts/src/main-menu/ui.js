/**
 * Main menu screen UI component
 * Handles the interaction with the main task entry screen
 */

export function initMainMenu() {
  // DOM elements
  const initialTaskDescription = document.getElementById('initialTaskDescription');
  const testPromptButton = document.getElementById('testPromptButton');
  const startTaskEntry = document.getElementById('startTaskEntry');
  const settingsButton = document.getElementById('settingsButton');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettings = document.getElementById('closeSettings');
  const closeModalBottom = document.getElementById('closeModalBottom');
  const apiKey = document.getElementById('settingsApiKey');
  const modelSelection = document.getElementById('modelInput');

  // Page elements
  const taskEntryPage = document.getElementById('taskEntryPage');
  const clarificationPage = document.getElementById('taskClarificationPage');

  // Animation control variables
  let typingInterval = null;
  let currentPromptIndex = 0;
  let isTyping = false;
  let currentText = '';
  let charIndex = 0;
  let userInteracted = false;

  // Task conversation tracking
  let currentTask = '';
  let taskConversation = [];
  let projectId = null;

  // Example prompts with varied content and formatting
  const examplePrompts = [
    // Game Development prompt - with numbered list
    `Develop a 2D platformer game with gravity-shifting mechanics. The game should:
  
  1. Allow the player to reverse gravity at will
  2. Feature puzzles that require creative use of gravity shifts
  3. Include at least 10 levels of increasing difficulty
  4. Have collectible items that unlock special abilities
  5. Feature a unique art style with vibrant colors and smooth animations
  
  The protagonist should be a robot exploring a research facility after an experiment goes wrong. Each level should introduce a new mechanic or obstacle that builds on previous levels.`,

    // Mobile App Development prompt - flowing text only, no lists
    `Create a personal finance tracking mobile app with budgeting features. I need a comprehensive app that helps users track daily expenses and income. The app should be able to categorize transactions automatically and allow users to set monthly budgets for different spending categories. It's important that it visualizes spending patterns using charts and graphs, and sends notifications when approaching budget limits. Users should be able to sync data across multiple devices securely and export their financial data for tax purposes. The design needs to be clean and minimalist with dark mode support. It must work offline and sync when connection is restored. Security is absolutely critical since we're handling sensitive financial information. I'd like recommendations on the tech stack that would be best for this kind of application, particularly for cross-platform development that doesn't sacrifice performance or user experience.`,

    // Research Paper prompt - mixed format with section headings
    `I need to write a research paper on artificial intelligence ethics. The scope should include:
  
  HISTORICAL CONTEXT
  A brief history of AI development and when ethical concerns first emerged. Include early philosophical discussions and how they evolved as technology advanced.
  
  CURRENT CHALLENGES
  Examine bias in algorithms, privacy concerns, automation's impact on labor markets, and responsibility for AI decisions. Use real-world examples like facial recognition controversies and autonomous vehicle accidents.
  
  PROPOSED FRAMEWORKS
  Analyze existing ethical frameworks from academia, industry, and government bodies. Compare approaches from different cultural contexts (Western, Eastern, etc.).
  
  The paper should be approximately 5,000 words with a focus on practical implications rather than purely theoretical concerns. I want to conclude with actionable recommendations for policymakers and technology companies.`,

    // Book Writing prompt - pure flowing text
    `I want to write a mystery novel set in a remote coastal village during winter. The story centers around a local librarian who discovers an old manuscript that appears to predict deaths in the village. As strange occurrences begin matching events in the manuscript, she realizes she might be the only one who can prevent the next tragedy. The atmosphere should be atmospheric and slightly supernatural without fully committing to paranormal elements - leaving readers wondering if there's a rational explanation or something truly unexplainable. I'm aiming for a slow-burn mystery with rich character development, particularly exploring how isolated communities create their own dynamics and hierarchies. I struggle with plotting mysteries that offer enough clues without making the solution obvious, so I'd especially appreciate help with structuring the revelation of information and creating compelling red herrings. I want the setting to almost function as a character itself, with the harsh winter weather and isolation playing crucial roles in the unfolding events. The manuscript itself should have an interesting origin story that's gradually revealed throughout the novel.`,

    // Website Development prompt - mix of paragraphs and bullet points
    `Design a portfolio website for a professional photographer specializing in wildlife and landscape photography. The site needs to showcase images in the best possible way while still loading quickly.
  
  The photographer travels frequently to remote locations, so the site should include:
  • An interactive map showing photo locations
  • Galleries organized by region and subject matter
  • A blog section for sharing stories behind the photos
  
  The most important requirement is that the images display at optimal quality without sacrificing load times. The photographer has approximately 2,000 high-resolution images that need to be managed efficiently.
  
  The website should emphasize the visual content while maintaining a clean, minimalist interface that doesn't distract from the photography. The target audience includes potential clients (magazines, conservation organizations) and fine art buyers. Responsive design is essential since many users will view the site on mobile devices while traveling.`,

    // Educational Course prompt - mostly paragraphs with simple emphasis
    `I need to develop an online course teaching data analysis for environmental scientists. The course is aimed at researchers and field scientists who have strong domain knowledge but limited programming experience. It needs to take students from basic concepts to being able to process their own field data and create publication-ready visualizations.
  
  The course should start with fundamentals of Python specifically relevant to scientific data processing. Then it should progress through increasingly complex data manipulation techniques. The final modules should cover advanced visualization and basic machine learning applications for environmental data.
  
  IMPORTANT: All examples must use real-world environmental datasets. Students will be more engaged if they work with realistic data like water quality measurements, species population surveys, or climate records.
  
  Each module needs video lectures, coding exercises, quizzes, and a mini-project. I envision a 10-week course with approximately 4-6 hours of student work per week. I also want to incorporate some collaborative elements where students can share their analyses of provided datasets.`
  ];

  // Initialize with random prompt animation
  setupEventListeners();
  currentPromptIndex = Math.floor(Math.random() * examplePrompts.length);
  startTypingAnimation();

  /**
   * Sets up the typing animation for example prompts
   */
  function startTypingAnimation() {
    // Don't start animation if user has interacted with the textarea
    if (document.activeElement === initialTaskDescription || userInteracted) {
      return;
    }

    stopTypingAnimation(); // Clear any existing animation

    const currentPrompt = examplePrompts[currentPromptIndex];
    currentText = '';
    charIndex = 0;
    isTyping = true;

    // Clear the placeholder and set typing speed (adjusted to be 2x faster)
    initialTaskDescription.placeholder = '';
    const typingSpeed = 15; // milliseconds per character (was 30ms)

    typingInterval = setInterval(() => {
      if (charIndex < currentPrompt.length) {
        // Add the next character
        currentText += currentPrompt.charAt(charIndex);
        initialTaskDescription.placeholder = currentText;
        charIndex++;
      } else {
        // Finished typing the current prompt
        clearInterval(typingInterval);
        isTyping = false;

        // Wait 2.5 seconds (changed from 2.0), then fade out
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
    initialTaskDescription.classList.add('text-fade-out');

    setTimeout(() => {
      initialTaskDescription.placeholder = '';
      initialTaskDescription.classList.remove('text-fade-out');
      if (callback) callback();
    }, 500);
  }

  /**
   * Sets up event listeners for main menu interactions
   */
  function setupEventListeners() {
    // Force reset textarea interaction on page load
    resetTextareaInteraction();

    // Test prompt button - apply highlight animation and set test prompt
    testPromptButton.addEventListener('click', () => {
      testPromptButton.classList.add('highlight-animation');

      // Reset the textarea to ensure it's clickable
      resetTextareaInteraction();

      // Use the first example as the test prompt (the 2D platformer with gravity-shifting)
      initialTaskDescription.value = 'Develop a 2D platformer game with gravity-shifting mechanics';
      userInteracted = true;

      // Stop placeholder animation when a prompt is inserted
      stopTypingAnimation();
      initialTaskDescription.placeholder = '';

      // Force focus on textarea
      setTimeout(() => {
        initialTaskDescription.focus();
      }, 50);

      // Remove animation class after it completes
      setTimeout(() => {
        testPromptButton.classList.remove('highlight-animation');
      }, 1000);
    });

    // Stop animation when user focuses on textarea
    initialTaskDescription.addEventListener('focus', () => {
      userInteracted = true;
      stopTypingAnimation();
      initialTaskDescription.placeholder = '';
    });

    // Handle clicks on textarea explicitly to force focus
    initialTaskDescription.addEventListener('click', (e) => {
      initialTaskDescription.focus();
      e.stopPropagation();
      userInteracted = true;
    });

    // Resume animation when user blurs textarea if it's empty
    initialTaskDescription.addEventListener('blur', () => {
      if (!initialTaskDescription.value.trim()) {
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
    initialTaskDescription.addEventListener('input', () => {
      userInteracted = true;
    });

    // Settings modal
    settingsButton.addEventListener('click', () => {
      settingsModal.style.display = 'block';
    });

    // Auto-save settings when input fields lose focus
    apiKey.addEventListener('blur', saveSettingsAutomatically);
    modelSelection.addEventListener('blur', saveSettingsAutomatically);

    // Also add debounced auto-save on typing (saves after user stops typing)
    let saveTimeout = null;
    apiKey.addEventListener('input', debounceSettingsSave);
    modelSelection.addEventListener('input', debounceSettingsSave);

    // Close modal buttons with auto-save
    closeSettings.addEventListener('click', () => {
      saveSettingsAutomatically(); // Save settings when closing
      settingsModal.style.display = 'none';
      resetTextareaInteraction();
    });

    closeModalBottom.addEventListener('click', () => {
      saveSettingsAutomatically(); // Save settings when closing
      settingsModal.style.display = 'none';
      resetTextareaInteraction();
    });

    // Close modal if clicked outside the content
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        saveSettingsAutomatically(); // Save settings when closing
        settingsModal.style.display = 'none';
        resetTextareaInteraction();
      }
    });

    /**
     * Debounces the auto-save - waits until user stops typing
     */
    function debounceSettingsSave() {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      saveTimeout = setTimeout(saveSettingsAutomatically, 1000); // 1 second delay
    }

    /**
     * Saves settings automatically without user confirmation
     */
    async function saveSettingsAutomatically() {
      try {
        // Check if apiKey element exists
        if (!apiKey) {
          console.error('API key input field not found (settingsApiKey)');
          return;
        }

        const apiKeyValue = apiKey.value ? apiKey.value.trim() : '';
        const modelValue = modelSelection ? modelSelection.value : 'deepseek/deepseek-chat-v3-0324:free';

        // Create settings object
        const settings = {
          apiKey: apiKeyValue,
          model: modelValue
        };

        // Save to localStorage
        localStorage.setItem('appSettings', JSON.stringify(settings));

        // Send to main process
        const result = await window.electronAPI.saveSettings(settings);

        if (result && result.success) {
          // Show subtle visual feedback that settings were saved (optional)
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

          // Add to modal content
          document.querySelector('.modal-content').appendChild(savedIndicator);

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
        } else {
          console.error('Failed to save settings to main process');
        }
      } catch (error) {
        console.error('Error auto-saving settings:', error);
        // No alert - silent failure is better for auto-save
      }
    }

    // Replace just the startTaskEntry event listener in your main-menu/ui.js:

    // Let's Begin button - now connected to the IPC handler
    startTaskEntry.addEventListener('click', async () => {
      const taskText = initialTaskDescription.value.trim();

      if (!taskText) {
        alert('Please enter a task description before continuing.');
        return;
      }

      // Store the current task
      currentTask = taskText;

      // Check for API key in settings
      let apiKeyValue = '';
      try {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          apiKeyValue = settings.apiKey || '';
        }

        if (!apiKeyValue) {
          alert('Please enter your API key in Settings before starting a task.');
          settingsModal.style.display = 'block'; // Show settings modal
          return;
        }

        // Continue with sending API key to main process before task starts
        await window.electronAPI.saveSettings({
          apiKey: apiKeyValue,
          model: modelSelection ? modelSelection.value : 'deepseek/deepseek-chat-v3-0324:free'
        });
      } catch (error) {
        console.error('Error loading settings:', error);
      }

      try {
        // Show loading state
        startTaskEntry.disabled = true;
        startTaskEntry.textContent = 'Processing...';

        // Create a project for the task
        const projectData = {
          title: taskText.split('\n')[0].substring(0, 50), // Use first line as title
          description: taskText
        };

        // Call IPC to create project
        const project = await window.electronAPI.projects.createProject(projectData);

        if (!project || !project.id) {
          throw new Error('Failed to create project');
        }

        // Save project ID
        projectId = project.id;

        // Trigger the clarification questions process
        const questionsResult = await window.electronAPI.clarification.getQuestions({
          taskDescription: taskText,
          projectId: project.id
        });

        if (!questionsResult.success) {
          throw new Error(questionsResult.error || 'Failed to get clarification questions');
        }

        // Update file manager with new project if available
        if (window.fileManager) {
          window.fileManager.setCurrentProject(project.id, project.title || 'Untitled Project');
          window.fileManager.refreshFiles();
          window.fileManager.openSidebar();
        }

        // Transition to the clarification page
        // Hide task entry page
        taskEntryPage.style.display = 'none';

        // The clarification page UI should handle showing itself
        // This should trigger the clarificationQuestionsUI to initialize
        const event = new CustomEvent('taskClarificationStart', {
          detail: {
            projectId: project.id,
            taskDescription: taskText,
            questions: questionsResult.questions
          }
        });

        document.dispatchEvent(event);

        // Show clarification page
        clarificationPage.style.display = 'flex';

      } catch (error) {
        console.error('Error starting task:', error);
        alert(`Error: ${error.message}`);
      } finally {
        // Reset button state
        startTaskEntry.disabled = false;
        startTaskEntry.textContent = "Let's Begin";
      }
    });

    // Load settings from localStorage
    try {
      const savedSettings = localStorage.getItem('appSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.apiKey && apiKey) apiKey.value = settings.apiKey;
        if (settings.model && modelSelection) modelSelection.value = settings.model;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  /**
   * Reset textarea interaction state to ensure it's clickable
   */
  function resetTextareaInteraction() {
    initialTaskDescription.disabled = false;
    initialTaskDescription.style.pointerEvents = 'auto';

    // Reset the user interaction flag if the textarea is empty
    if (!initialTaskDescription.value.trim()) {
      userInteracted = false;
    }
  }

  // Return any public methods you want to expose
  return {
    resetTextareaInteraction
  };
}