/**
 * Clarification Questions UI module
 * Handles UI interactions for task clarification workflow
 */

class ClarificationQuestionsUI {
    constructor() {
      // DOM elements
      this.taskEntryPage = document.getElementById('taskEntryPage');
      this.clarificationPage = document.getElementById('taskClarificationPage');
      this.todoExecutionPage = document.getElementById('todoExecutionPage');
      
      // Clarification elements
      this.questionTitle = document.getElementById('questionTitle');
      this.questionText = document.getElementById('questionText');
      this.questionAnswer = document.getElementById('questionAnswer');
      this.nextQuestionBtn = document.getElementById('nextQuestionBtn');
      this.prevQuestionBtn = document.getElementById('prevQuestionBtn');
      this.progressFill = document.getElementById('progressFill');
      this.progressText = document.getElementById('progressText');
      
      // State
      this.currentProject = null;
      this.questions = [];
      this.currentQuestionIndex = 0;
      this.answers = [];
      this.taskDescription = '';
      
      // Bind event handlers
      this.bindEvents();
      
      // Initialize UI if elements exist
      this.initializeUI();
      
      // Store a reference to this instance for event listeners
      const self = this;
      
      // Listen for task clarification start event
      document.addEventListener('taskClarificationStart', function(event) {
        if (event.detail) {
          // Using self instead of this to reference the class instance
          self.currentProject = event.detail.projectId;
          self.taskDescription = event.detail.taskDescription;
          self.questions = event.detail.questions || [];
          
          // Initialize answers array
          self.answers = Array(self.questions.length).fill('');
          
          // Display first question
          self.currentQuestionIndex = 0;
          self.displayCurrentQuestion();
        }
      });
    }
    
    // Rest of your class methods...
    
    /**
     * Initialize UI components
     */
    initializeUI() {
      // Check if we have the necessary elements
      if (!this.clarificationPage) {
        console.error('Clarification page not found in DOM');
        return;
      }
      
      // Set initial state for progress
      if (this.progressFill) {
        this.progressFill.style.width = '0%';
      }
    }
    
    /**
     * Bind event handlers
     */
    bindEvents() {
      // Next/previous question buttons
      if (this.nextQuestionBtn) {
        this.nextQuestionBtn.addEventListener('click', this.handleNextQuestion.bind(this));
      }
      
      if (this.prevQuestionBtn) {
        this.prevQuestionBtn.addEventListener('click', this.handlePrevQuestion.bind(this));
      }
      
      // Handle Enter key in answer field
      if (this.questionAnswer) {
        this.questionAnswer.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && e.ctrlKey) {
            this.handleNextQuestion();
          }
        });
      }
    }
    
    /**
     * Display current question
     */
    displayCurrentQuestion() {
      if (!this.questions || this.questions.length === 0) {
        this.showError('No questions available');
        return;
      }
      
      const currentQuestion = this.questions[this.currentQuestionIndex];
      
      // Update question title and text
      if (this.questionTitle) {
        this.questionTitle.textContent = `Question ${this.currentQuestionIndex + 1} of ${this.questions.length}`;
      }
      
      if (this.questionText) {
        let questionContent = currentQuestion.question;
        
        // Add hint if available
        if (currentQuestion.hint) {
          questionContent += `\n\nHint: ${currentQuestion.hint}`;
        }
        
        this.questionText.textContent = questionContent;
      }
      
      // Set answer value
      if (this.questionAnswer) {
        this.questionAnswer.value = this.answers[this.currentQuestionIndex] || '';
        this.questionAnswer.disabled = false;
        this.questionAnswer.focus();
      }
      
      // Update progress
      if (this.progressFill) {
        const progressPercent = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
        this.progressFill.style.width = `${progressPercent}%`;
      }
      
      if (this.progressText) {
        this.progressText.textContent = `Question ${this.currentQuestionIndex + 1} of ${this.questions.length}`;
      }
      
      // Enable/disable navigation buttons
      if (this.prevQuestionBtn) {
        this.prevQuestionBtn.disabled = this.currentQuestionIndex === 0;
      }
      
      if (this.nextQuestionBtn) {
        this.nextQuestionBtn.disabled = false;
        this.nextQuestionBtn.textContent = 
          this.currentQuestionIndex === this.questions.length - 1 ? 'Finish' : 'Next';
      }
    }
    
    /**
     * Handle next question button click
     */
    async handleNextQuestion() {
      // Save current answer
      if (this.questionAnswer) {
        this.answers[this.currentQuestionIndex] = this.questionAnswer.value.trim();
      }
      
      // Check if this is the last question
      if (this.currentQuestionIndex === this.questions.length - 1) {
        // Process final submission
        await this.handleFinalSubmission();
      } else {
        // Go to next question
        this.currentQuestionIndex++;
        this.displayCurrentQuestion();
      }
    }
    
    /**
     * Handle previous question button click
     */
    handlePrevQuestion() {
      // Save current answer
      if (this.questionAnswer) {
        this.answers[this.currentQuestionIndex] = this.questionAnswer.value.trim();
      }
      
      // Go to previous question
      if (this.currentQuestionIndex > 0) {
        this.currentQuestionIndex--;
        this.displayCurrentQuestion();
      }
    }
    
    /**
     * Handle final submission of all answers
     */
    async handleFinalSubmission() {
      try {
        // Update UI to show processing state
        this.setProcessingState();
        
        // Submit answers to generate global context
        const submitResult = await window.electronAPI.clarification.submitAnswers({
          projectId: this.currentProject,
          questions: this.questions,
          answers: this.answers,
          taskDescription: this.taskDescription
        });
        
        if (!submitResult.success) {
          throw new Error(submitResult.error || 'Failed to process answers');
        }
        
        // Generate todo list
        const todoResult = await window.electronAPI.clarification.generateTodo({
          projectId: this.currentProject
        });
        
        if (!todoResult.success) {
          throw new Error(todoResult.error || 'Failed to generate todo list');
        }
        
        // Transition to todo execution page
        this.transitionToTodoExecution(todoResult.todoList);
        
      } catch (error) {
        console.error('Error processing answers:', error);
        this.showError(`Error: ${error.message}`);
        
        // Re-enable the finish button
        if (this.nextQuestionBtn) {
          this.nextQuestionBtn.disabled = false;
          this.nextQuestionBtn.textContent = 'Finish';
        }
      }
    }
    
    /**
     * Set processing state while generating results
     */
    setProcessingState() {
      if (this.questionTitle) {
        this.questionTitle.textContent = 'Processing...';
      }
      
      if (this.questionText) {
        this.questionText.textContent = 'Creating task breakdown and planning next steps...';
      }
      
      if (this.questionAnswer) {
        this.questionAnswer.disabled = true;
      }
      
      if (this.nextQuestionBtn) {
        this.nextQuestionBtn.disabled = true;
        this.nextQuestionBtn.textContent = 'Processing...';
      }
      
      if (this.prevQuestionBtn) {
        this.prevQuestionBtn.disabled = true;
      }
    }
    
    /**
     * Transition to todo execution page
     * @param {object} todoList - Todo list data
     */
    transitionToTodoExecution(todoList) {
      // Hide clarification page
      if (this.clarificationPage) {
        this.clarificationPage.style.display = 'none';
      }
      
      // Trigger event for todo execution page
      const event = new CustomEvent('todoListReady', {
        detail: {
          todoList,
          projectId: this.currentProject
        }
      });
      
      document.dispatchEvent(event);
      
      // Show todo execution page
      if (this.todoExecutionPage) {
        this.todoExecutionPage.style.display = 'flex';
      } else {
        console.error('Todo execution page not found');
        this.showError('Failed to load task execution page');
      }
    }
    
    /**
     * Show error message to user
     * @param {string} message - Error message
     */
    showError(message) {
      // Implement appropriate error display
      // This could be a simple alert for now
      alert(message);
      
      // Log to console as well
      console.error(message);
    }
  }
  
  // Initialize module when DOM is loaded
  window.addEventListener('DOMContentLoaded', () => {
    window.clarificationQuestionsUI = new ClarificationQuestionsUI();
  });
  
  // Export the class if we're in a Node.js environment
  // This approach prevents the "module is not defined" error in browsers
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClarificationQuestionsUI;
  }