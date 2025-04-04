// src/renderer/pageNavigation.js
// Handles navigation between pages

export function setupPageNavigation() {
    // Page elements
    const taskEntryPage = document.getElementById('taskEntryPage');
    const clarificationPage = document.getElementById('clarificationPage');
    const definitionResultsPage = document.getElementById('definitionResultsPage');
    const taskExecutionPage = document.getElementById('taskExecutionPage');
    
    // Navigation buttons
    const startTaskEntryBtn = document.getElementById('startTaskEntry');
    const proceedToExecutionBtn = document.getElementById('proceedToExecution');
    const backToDashboardBtn = document.getElementById('backToDashboard');
    
    // Task Entry -> Clarification
    startTaskEntryBtn.addEventListener('click', () => {
      const taskDescription = document.getElementById('initialTaskDescription').value.trim();
      if (!taskDescription) {
        // Show a subtle error animation on the text area
        const textArea = document.getElementById('initialTaskDescription');
        textArea.classList.add('error-shake');
        setTimeout(() => textArea.classList.remove('error-shake'), 500);
        return;
      }
      
      // Trigger the task clarification process
      window.dispatchEvent(new CustomEvent('start-task-clarification', { 
        detail: { taskDescription } 
      }));
      
      // Navigate to clarification page
      taskEntryPage.style.display = 'none';
      clarificationPage.style.display = 'flex';
    });
    
    // Clarification -> Definition Results (handled by clarification process)
    window.addEventListener('clarification-complete', () => {
      clarificationPage.style.display = 'none';
      definitionResultsPage.style.display = 'flex';
    });
    
    // Definition Results -> Task Execution
    proceedToExecutionBtn.addEventListener('click', () => {
      definitionResultsPage.style.display = 'none';
      taskExecutionPage.style.display = 'flex';
      
      // Initialize the task execution system
      window.dispatchEvent(new CustomEvent('initialize-task-execution'));
    });
    
    // Task Execution -> Task Entry (restart)
    backToDashboardBtn.addEventListener('click', () => {
      // Confirm dialog since this loses progress
      if (confirm('Return to dashboard? This will clear your current task session.')) {
        taskExecutionPage.style.display = 'none';
        taskEntryPage.style.display = 'flex';
        
        // Clear the task entry field for a fresh start
        document.getElementById('initialTaskDescription').value = '';
      }
    });
    
    // Public API
    return {
      navigateToPage: (pageName) => {
        // Hide all pages
        taskEntryPage.style.display = 'none';
        clarificationPage.style.display = 'none';
        definitionResultsPage.style.display = 'none';
        taskExecutionPage.style.display = 'none';
        
        // Show the requested page
        switch (pageName) {
          case 'taskEntry':
            taskEntryPage.style.display = 'flex';
            break;
          case 'clarification':
            clarificationPage.style.display = 'flex';
            break;
          case 'definitionResults':
            definitionResultsPage.style.display = 'flex';
            break;
          case 'taskExecution':
            taskExecutionPage.style.display = 'flex';
            break;
        }
      }
    };
  }