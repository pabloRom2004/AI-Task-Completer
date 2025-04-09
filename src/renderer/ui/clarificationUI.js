/**
 * UI controller for the task clarification page
 */

import {
    initClarification,
    getQuestions,
    addExchange,
    getClarificationState
} from '../services/clarificationService.js';

// State management
let currentQuestions = [];
let currentQuestionIndex = 0;
let needsMoreQuestions = true;

// DOM elements
let questionContainer;
let questionTitle;
let questionText;
let questionAnswer;
let nextButton;
let progressFill;
let progressText;
let clarificationPage;
let todoExecutionPage;
let clarificationTitle;

/**
 * Initialize the clarification UI
 */
export function initClarificationUI() {
    // Get DOM elements
    questionContainer = document.getElementById('questionContainer');
    questionTitle = document.getElementById('questionTitle');
    questionText = document.getElementById('questionText');
    questionAnswer = document.getElementById('questionAnswer');
    nextButton = document.getElementById('nextQuestionBtn');
    progressFill = document.getElementById('progressFill');
    progressText = document.getElementById('progressText');
    clarificationPage = document.getElementById('taskClarificationPage');
    todoExecutionPage = document.getElementById('todoExecutionPage');
    clarificationTitle = document.getElementById('clarificationTitle');

    // Set up event listeners if elements exist
    if (nextButton && questionAnswer) {
        setupEventListeners();
    } else {
        console.error('Critical UI elements missing for clarification page');
    }

    // Listen for task entry events
    document.addEventListener('taskClarificationStart', handleTaskStart);
}

/**
 * Set up event listeners for UI interactions
 */
function setupEventListeners() {
    // Next/submit button
    nextButton.addEventListener('click', handleNextButton);

    // Enter key in textarea
    questionAnswer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleNextButton();
            e.preventDefault();
        }
    });
}

/**
 * Handle the start of a new task clarification
 * @param {CustomEvent} event - Event containing task information
 */
async function handleTaskStart(event) {
    try {
        const { taskDescription } = event.detail;

        // Reset state
        currentQuestions = [];
        currentQuestionIndex = 0;

        // Initialize clarification service with the task
        initClarification(taskDescription);

        // Show loading state
        showLoadingState();

        // Get first batch of questions
        const result = await getQuestions();

        if (result.error) {
            showError(result.error);
            return;
        }

        // Store questions and state
        currentQuestions = result.questions || [];
        needsMoreQuestions = result.needsMoreQuestions;

        console.log('Got questions:', currentQuestions);
        console.log('Needs more questions:', needsMoreQuestions);

        // If no questions are needed, proceed to next phase
        if (currentQuestions.length === 0 && !needsMoreQuestions) {
            finishClarification();
            return;
        }

        // Make sure all UI elements exist
        if (!questionTitle || !questionText || !questionAnswer || !nextButton) {
            createQuestionElements();
        }

        // Display first question
        showCurrentQuestion();

    } catch (error) {
        console.error('Error starting task clarification:', error);
        showError('Failed to start task clarification. Please try again.');
    }
}

/**
 * Create question elements dynamically if they don't exist
 */
function createQuestionElements() {
    // If container exists but child elements don't
    if (questionContainer) {
        // Clear container
        questionContainer.innerHTML = '';
        questionContainer.classList.remove('loading');

        // Create title
        if (!questionTitle) {
            questionTitle = document.createElement('h3');
            questionTitle.id = 'questionTitle';
            questionContainer.appendChild(questionTitle);
        }

        // Create text
        if (!questionText) {
            questionText = document.createElement('p');
            questionText.id = 'questionText';
            questionContainer.appendChild(questionText);
        }

        // Create answer textarea
        if (!questionAnswer) {
            questionAnswer = document.createElement('textarea');
            questionAnswer.id = 'questionAnswer';
            questionAnswer.className = 'answer-input';
            questionAnswer.placeholder = 'Enter your answer here...';
            questionContainer.appendChild(questionAnswer);
        }

        // Create button container
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button-group';
        questionContainer.appendChild(buttonGroup);

        // Create next button
        if (!nextButton) {
            nextButton = document.createElement('button');
            nextButton.id = 'nextQuestionBtn';
            nextButton.className = 'primary-button';
            nextButton.textContent = 'Submit Answer';
            nextButton.addEventListener('click', handleNextButton);
            buttonGroup.appendChild(nextButton);
        }

        // Set up event listeners again
        setupEventListeners();
    }
}

/**
 * Show a loading state while waiting for questions
 */
function showLoadingState() {
    if (!questionContainer) return;
    
    // Make the title bigger and more prominent
    if (clarificationTitle) {
      clarificationTitle.style.fontSize = '2rem';
      clarificationTitle.style.textAlign = 'center';
      clarificationTitle.style.display = 'block';
    }
    
    // Hide existing elements instead of removing them
    questionContainer.classList.add('loading');
    
    if (questionTitle) questionTitle.style.display = 'none';
    if (questionText) questionText.style.display = 'none';
    if (questionAnswer) questionAnswer.style.display = 'none';
    if (nextButton && nextButton.parentElement) {
      nextButton.parentElement.style.display = 'none';
    }
    
    // Remove any existing loading elements
    const existingSpinner = questionContainer.querySelector('.loading-spinner');
    const existingText = questionContainer.querySelector('.loading-text');
    
    if (existingSpinner) existingSpinner.remove();
    if (existingText) existingText.remove();
    
    // Add loading spinner
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    questionContainer.appendChild(spinner);
    
    // Add loading text
    const loadingText = document.createElement('p');
    loadingText.className = 'loading-text';
    loadingText.textContent = 'Analyzing your task...';
    questionContainer.appendChild(loadingText);
    
    // Hide progress bar section
    const progressContainer = document.querySelector('.question-progress');
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }
  }

/**
 * Display the current question and update UI state
 */
function showCurrentQuestion() {
    if (!questionContainer) {
      console.error('Question container not found');
      return;
    }
    
    // Hide the "Let's clarify your task" title
    if (clarificationTitle) {
      clarificationTitle.style.display = 'none';
    }
    
    // Remove loading state
    questionContainer.classList.remove('loading');
    
    // Remove loading elements
    const spinner = questionContainer.querySelector('.loading-spinner');
    const loadingText = questionContainer.querySelector('.loading-text');
    
    if (spinner) spinner.remove();
    if (loadingText) loadingText.remove();
    
    // Safety check for questions
    if (!currentQuestions || currentQuestions.length === 0) {
      console.error('No questions available to display');
      showError('No questions available. The task might be clear enough already.');
      return;
    }
    
    // Get current question with bounds checking
    if (currentQuestionIndex >= currentQuestions.length) {
      currentQuestionIndex = currentQuestions.length - 1;
    }
    
    const current = currentQuestions[currentQuestionIndex];
    
    if (!current) {
      console.error('No question found at index', currentQuestionIndex);
      showError('Question data is missing. Please try again.');
      return;
    }
    
    // Show question elements
    if (questionTitle) {
      questionTitle.style.display = 'block';
      questionTitle.textContent = current.question;
    }
    
    if (questionText) {
      questionText.style.display = 'block';
      questionText.textContent = current.hint || 'Please provide your answer below.';
    }
    
    if (questionAnswer) {
      questionAnswer.style.display = 'block';
      questionAnswer.value = current.savedAnswer || '';
      questionAnswer.placeholder = 'Enter your answer here...';
      questionAnswer.disabled = false;
    }
    
    // Show button group with progress
    const buttonGroup = nextButton ? nextButton.parentElement : null;
    if (buttonGroup) {
      buttonGroup.style.display = 'flex';
    }
    
    // Show progress elements
    const progressContainer = document.querySelector('.question-progress');
    if (progressContainer) {
      progressContainer.style.display = 'flex';
    }
    
    // Update button
    if (nextButton) {
      nextButton.textContent = 'Submit Answer';
      nextButton.disabled = false;
    }
    
    // Update progress indicators
    if (progressFill && progressText) {
      const progressPercent = ((currentQuestionIndex + 1) / currentQuestions.length) * 100;
      progressFill.style.width = `${progressPercent}%`;
      progressText.textContent = `Question ${currentQuestionIndex + 1}/${currentQuestions.length}`;
    }
    
    // Focus textarea
    if (questionAnswer) {
      setTimeout(() => {
        questionAnswer.focus();
      }, 100);
    }
  }

/**
 * Handle next button click
 */
async function handleNextButton() {
    // Save current answer
    saveCurrentAnswer();

    // Check if answer is provided
    const current = currentQuestions[currentQuestionIndex];
    if (!current) {
        console.error('No current question found at index', currentQuestionIndex);
        return;
    }

    if (!current.savedAnswer || current.savedAnswer.trim() === '') {
        // Highlight textarea as error
        if (questionAnswer) {
            questionAnswer.classList.add('error');
            setTimeout(() => {
                questionAnswer.classList.remove('error');
            }, 1000);
        }
        return;
    }

    // Move to next question or get more questions
    if (currentQuestionIndex < currentQuestions.length - 1) {
        // Move to next question in current batch
        currentQuestionIndex++;
        showCurrentQuestion();
    } else if (needsMoreQuestions) {
        // Save answers to conversation before requesting more
        currentQuestions.forEach(q => {
            if (q.savedAnswer) {
                addExchange(q.question, q.savedAnswer);
            }
        });

        // Request more questions
        await getMoreQuestions();
    } else {
        // Final question answered, proceed to next step
        finishClarification();
    }
}

/**
 * Request additional questions from the model
 */
async function getMoreQuestions() {
    try {
        // Show loading state
        showLoadingState();

        // Get next batch of questions
        const result = await getQuestions();

        if (result.error) {
            showError(result.error);
            return;
        }

        // Store new questions and state
        currentQuestions = result.questions || [];
        needsMoreQuestions = result.needsMoreQuestions;
        currentQuestionIndex = 0;

        console.log('Got more questions:', currentQuestions.length);
        console.log('Still needs more questions:', needsMoreQuestions);

        // If no more questions needed, finish
        if (currentQuestions.length === 0 && !needsMoreQuestions) {
            finishClarification();
            return;
        }

        // Show first question from new batch
        showCurrentQuestion();

    } catch (error) {
        console.error('Error getting more questions:', error);
        showError('Failed to get additional questions. Please try again.');
    }
}

/**
 * Save the answer for the current question
 */
function saveCurrentAnswer() {
    if (currentQuestionIndex < 0 || currentQuestionIndex >= currentQuestions.length) {
        console.error('Cannot save answer: index out of bounds', currentQuestionIndex);
        return;
    }

    if (!questionAnswer) {
        console.error('Question answer element not found');
        return;
    }

    const answer = questionAnswer.value.trim();
    if (currentQuestions[currentQuestionIndex]) {
        currentQuestions[currentQuestionIndex].savedAnswer = answer;
    }
}

/**
 * Complete the clarification process and move to next phase
 */
async function finishClarification() {
    try {
        // Save any remaining answers to conversation
        if (currentQuestions && currentQuestions.length > 0) {
            currentQuestions.forEach(q => {
                if (q.savedAnswer) {
                    addExchange(q.question, q.savedAnswer);
                }
            });
        }

        // Get complete clarification state
        const state = getClarificationState();

        console.log('Clarification complete. Task:', state.task);
        console.log('Collected information:', state.conversation);

        // Show loading message
        if (questionContainer) {
            questionContainer.innerHTML = '';
            questionContainer.classList.add('loading');

            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            questionContainer.appendChild(spinner);

            const loadingText = document.createElement('p');
            loadingText.textContent = 'Generating project context and task breakdown...';
            questionContainer.appendChild(loadingText);
        }

        // Generate global context
        const { generateGlobalContext } = await import('../services/contextService.js');
        const context = await generateGlobalContext(state.task, state.conversation);
        
        // Dispatch context event
        document.dispatchEvent(new CustomEvent('contextUpdated', { detail: { context } }));

        // Generate task breakdown
        const { generateTaskBreakdown } = await import('../services/taskService.js');
        const tasks = await generateTaskBreakdown();

        // Dispatch tasks event
        document.dispatchEvent(new CustomEvent('tasksGenerated', { detail: { tasks } }));

        // Trigger event for next phase
        const event = new CustomEvent('clarificationComplete', {
            detail: state
        });

        document.dispatchEvent(event);

        // Transition to todo execution page
        if (clarificationPage) clarificationPage.style.display = 'none';
        if (todoExecutionPage) todoExecutionPage.style.display = 'flex';

    } catch (error) {
        console.error('Error finishing clarification:', error);
        showError('Failed to complete task clarification. Please try again.');
    }
}

/**
 * Show an error message in the question container
 * @param {string} message - Error message to display
 */
function showError(message) {
    if (!questionContainer) {
        console.error('Cannot show error: question container not found');
        return;
    }

    questionContainer.classList.remove('loading');
    questionContainer.innerHTML = '';

    // Create error title
    const errorTitle = document.createElement('h3');
    errorTitle.textContent = 'Error';
    questionContainer.appendChild(errorTitle);

    // Create error message
    const errorText = document.createElement('p');
    errorText.textContent = message;
    errorText.style.color = 'var(--error-color)';
    questionContainer.appendChild(errorText);

    // Create retry button
    const retryButton = document.createElement('button');
    retryButton.className = 'primary-button';
    retryButton.textContent = 'Try Again';
    retryButton.style.marginTop = '20px';
    retryButton.onclick = () => {
        const taskDescription = getClarificationState().task;
        if (taskDescription) {
            handleTaskStart({ detail: { taskDescription } });
        } else {
            // Return to task entry page if task description is missing
            if (clarificationPage) clarificationPage.style.display = 'none';
            const taskEntryPage = document.getElementById('taskEntryPage');
            if (taskEntryPage) taskEntryPage.style.display = 'flex';
        }
    };
    questionContainer.appendChild(retryButton);
}