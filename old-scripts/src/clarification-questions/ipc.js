/**
 * Clarification Questions IPC Handlers
 * Handles communication between renderer and main processes for task clarification
 */
const fs = require('fs').promises;
const path = require('path');

class ClarificationQuestionsIPC {
  /**
   * Initialize the IPC handlers
   * @param {object} params - Parameters object
   * @param {object} params.ipcMain - Electron IPC main
   * @param {object} params.aiClient - AI Client instance
   * @param {object} params.fileSystem - File system instance
   * @param {object} params.projectHandler - Project handler instance
   */
  constructor({ ipcMain, aiClient, fileSystem, projectHandler }) {
    this.ipcMain = ipcMain;
    this.aiClient = aiClient;
    this.fileSystem = fileSystem;
    this.projectHandler = projectHandler;
    
    // Register handlers immediately
    this.registerHandlers();
    console.log('Clarification Questions IPC handlers registered');
  }
  
  /**
   * Register all IPC handlers
   */
  registerHandlers() {
    // Get clarification questions based on task description
    this.ipcMain.handle(
      'clarification:getQuestions', 
      this.handleGetQuestions.bind(this)
    );
    
    // Submit answers and generate global context
    this.ipcMain.handle(
      'clarification:submitAnswers', 
      this.handleSubmitAnswers.bind(this)
    );
    
    // Generate todo list based on global context
    this.ipcMain.handle(
      'clarification:generateTodo', 
      this.handleGenerateTodo.bind(this)
    );
  }
  
  /**
   * Handle request to get clarification questions
   * @param {Event} event - IPC event
   * @param {object} params - Request parameters
   * @param {string} params.taskDescription - Task description
   * @param {string} params.projectId - Project ID
   * @returns {Promise<object>} Response object with questions
   */
  async handleGetQuestions(event, { taskDescription, projectId }) {
    console.log(`Getting clarification questions for project ${projectId}`);
    
    try {
      // Set current project in file system
      await this.fileSystem.setCurrentProject(projectId);
      
      // Load task clarification prompt
      const taskClarificationPrompt = await this.aiClient.loadPrompt('task-clarification');
      
      // Reset conversation history
      this.aiClient.resetConversation();
      
      // Prepare file information
      const fileInfo = await this.aiClient.prepareFileInformation();
      
      // Create system message with prompt and file info
      const systemMessage = `${taskClarificationPrompt}\n\n${fileInfo}`;
      
      // Add system message to conversation
      this.aiClient.conversationHistory.push({
        role: 'system',
        content: systemMessage
      });
      
      // Add user message
      this.aiClient.conversationHistory.push({
        role: 'user',
        content: `My task is: ${taskDescription}\n\nPlease provide questions to clarify this task.`
      });
      
      // Process message
      console.log('Sending request to AI for clarification questions...');
      const result = await this.aiClient.processMessage(
        `My task is: ${taskDescription}\n\nPlease provide clarification questions in JSON format.`
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate clarification questions');
      }
      
      // Extract questions from response
      const questions = this.extractQuestionsFromResponse(result.response);
      
      // Store questions in project directory
      const projectPath = path.join(this.projectHandler.projectsDir, projectId);
      await fs.writeFile(
        path.join(projectPath, 'clarification-questions.json'),
        JSON.stringify({ 
          questions, 
          timestamp: new Date().toISOString(),
          taskDescription
        }, null, 2)
      );
      
      // Update project progress
      await this.projectHandler.updateProjectProgress(projectId, 'clarification');
      
      return {
        success: true,
        questions,
        projectId
      };
    } catch (error) {
      console.error('Error getting clarification questions:', error);
      return {
        success: false,
        error: error.message || 'Unknown error getting clarification questions'
      };
    }
  }
  
  /**
   * Extract questions from AI response
   * @param {string} response - AI response text
   * @returns {Array} Array of question objects
   */
  extractQuestionsFromResponse(response) {
    try {
      // Try to find JSON in the response
      const jsonRegex = /{[\s\S]*}/g;
      const match = response.match(jsonRegex);
      
      if (match) {
        // Try parsing each match until we find valid questions
        for (const jsonStr of match) {
          try {
            const parsed = JSON.parse(jsonStr);
            
            // Check if this looks like a questions object
            if (parsed.questions && Array.isArray(parsed.questions)) {
              return parsed.questions;
            } else if (parsed.title && parsed.questions && Array.isArray(parsed.questions)) {
              return parsed.questions;
            }
          } catch (e) {
            // Skip invalid JSON and try the next match
            console.warn('Failed to parse potential JSON match:', e);
          }
        }
      }
      
      // If no valid JSON found or parsing failed, use regex to extract questions
      console.log('No valid JSON found, falling back to extraction...');
      const questionsExtracted = this.extractQuestionsManually(response);
      
      if (questionsExtracted.length > 0) {
        return questionsExtracted;
      }
      
      // If all else fails, return default questions
      console.warn('Falling back to default questions');
      return this.getDefaultQuestions();
    } catch (error) {
      console.error('Error extracting questions:', error);
      return this.getDefaultQuestions();
    }
  }
  
  /**
   * Extract questions manually using regex patterns
   * @param {string} response - AI response text
   * @returns {Array} Array of question objects
   */
  extractQuestionsManually(response) {
    const questionPatterns = [
      /(\d+\.\s*.*\?)/g,  // Numbered questions: "1. What is your goal?"
      /- (.*\?)/g,         // Bullet questions: "- What is your goal?"
      /Question:?\s*(.*\?)/gi // Explicit "Question: What is your goal?"
    ];
    
    const questions = [];
    
    for (const pattern of questionPatterns) {
      const matches = [...response.matchAll(pattern)];
      
      for (const match of matches) {
        // Get the question text and clean it up
        const questionText = match[1].trim();
        
        // Skip very short questions or duplicate questions
        if (questionText.length < 10 || questions.some(q => q.question === questionText)) {
          continue;
        }
        
        questions.push({
          question: questionText,
          hint: ''
        });
      }
    }
    
    return questions;
  }
  
  /**
   * Get default clarification questions
   * @returns {Array} Array of default question objects
   */
  getDefaultQuestions() {
    return [
      {
        question: "What specific features or components are most important for this task?",
        hint: "Prioritizing features helps focus the implementation."
      },
      {
        question: "What is your experience level with the technologies involved?",
        hint: "This helps tailor the level of detail in explanations."
      },
      {
        question: "Do you have any specific requirements or constraints to consider?",
        hint: "E.g., performance needs, compatibility requirements, etc."
      },
      {
        question: "What is the primary goal or outcome you wish to achieve?",
        hint: "Understanding your main objective helps ensure the task meets your needs."
      }
    ];
  }
  
  /**
   * Handle submission of clarification answers
   * @param {Event} event - IPC event
   * @param {object} params - Request parameters
   * @param {string} params.projectId - Project ID
   * @param {Array} params.questions - Array of question objects
   * @param {Array} params.answers - Array of answer strings
   * @param {string} params.taskDescription - Original task description
   * @returns {Promise<object>} Response object with global context
   */
  async handleSubmitAnswers(event, { projectId, questions, answers, taskDescription }) {
    console.log(`Submitting answers for project ${projectId}`);
    
    try {
      // Set current project in file system
      await this.fileSystem.setCurrentProject(projectId);
      
      // Store answers in project directory
      const projectPath = path.join(this.projectHandler.projectsDir, projectId);
      await fs.writeFile(
        path.join(projectPath, 'clarification-answers.json'),
        JSON.stringify({ 
          questions, 
          answers,
          timestamp: new Date().toISOString()
        }, null, 2)
      );
      
      // Format Q&A for AI
      let clarificationText = "# Task Clarification\n\n";
      clarificationText += `Original Task: ${taskDescription}\n\n`;
      clarificationText += "## Questions and Answers\n\n";
      
      for (let i = 0; i < questions.length; i++) {
        clarificationText += `Q: ${questions[i].question}\n`;
        clarificationText += `A: ${answers[i] || 'No answer provided.'}\n\n`;
      }
      
      // Load global context prompt
      const createContextPrompt = await this.aiClient.loadPrompt('create-context');
      
      // Reset conversation history
      this.aiClient.resetConversation();
      
      // Add system message with prompt
      this.aiClient.conversationHistory.push({
        role: 'system',
        content: createContextPrompt
      });
      
      // Prepare file information
      const fileInfo = await this.aiClient.prepareFileInformation();
      
      // Add file information
      this.aiClient.conversationHistory.push({
        role: 'system',
        content: `Available Files:\n${fileInfo}`
      });
      
      // Add user message with clarification details
      this.aiClient.conversationHistory.push({
        role: 'user',
        content: `${clarificationText}\n\nBased on the above task and clarification, please generate a comprehensive global context document.`
      });
      
      // Process message
      console.log('Generating global context...');
      const result = await this.aiClient.processMessage(
        `Generate a global context document based on this task clarification: ${clarificationText}`
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate global context');
      }
      
      // Save global context to project
      const globalContextPath = path.join(projectPath, 'globalContext.txt');
      await fs.writeFile(globalContextPath, result.response, 'utf8');
      
      // Update project progress
      await this.projectHandler.updateProjectProgress(projectId, 'global-context');
      
      return {
        success: true,
        globalContext: result.response,
        projectId
      };
    } catch (error) {
      console.error('Error submitting answers:', error);
      return {
        success: false,
        error: error.message || 'Unknown error submitting answers'
      };
    }
  }
  
  /**
   * Handle request to generate todo list
   * @param {Event} event - IPC event
   * @param {object} params - Request parameters
   * @param {string} params.projectId - Project ID
   * @returns {Promise<object>} Response object with todo list
   */
  async handleGenerateTodo(event, { projectId }) {
    console.log(`Generating todo list for project ${projectId}`);
    
    try {
      // Set current project in file system
      await this.fileSystem.setCurrentProject(projectId);
      
      // Get project path
      const projectPath = path.join(this.projectHandler.projectsDir, projectId);
      
      // Read global context
      const globalContextPath = path.join(projectPath, 'globalContext.txt');
      const globalContext = await fs.readFile(globalContextPath, 'utf8');
      
      // Load task breakdown prompt
      const taskBreakdownPrompt = await this.aiClient.loadPrompt('task-breakdown');
      
      // Reset conversation history
      this.aiClient.resetConversation();
      
      // Add system message with prompt
      this.aiClient.conversationHistory.push({
        role: 'system',
        content: taskBreakdownPrompt
      });
      
      // Prepare file information
      const fileInfo = await this.aiClient.prepareFileInformation();
      
      // Add file information
      this.aiClient.conversationHistory.push({
        role: 'system',
        content: `Available Files:\n${fileInfo}`
      });
      
      // Add user message with global context
      this.aiClient.conversationHistory.push({
        role: 'user',
        content: `Generate a to-do list based on this global context:\n\n${globalContext}`
      });
      
      // Process message
      console.log('Generating todo list...');
      const result = await this.aiClient.processMessage(
        `Generate a structured to-do list in JSON format based on this global context: ${globalContext}`
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate todo list');
      }
      
      // Extract todo list from response
      const todoList = this.extractTodoListFromResponse(result.response);
      
      // Save todo list to project
      const todoPath = path.join(projectPath, 'todo.json');
      await fs.writeFile(todoPath, JSON.stringify(todoList, null, 2), 'utf8');
      
      // Update project progress
      await this.projectHandler.updateProjectProgress(projectId, 'todo-list');
      
      return {
        success: true,
        todoList,
        projectId
      };
    } catch (error) {
      console.error('Error generating todo list:', error);
      return {
        success: false,
        error: error.message || 'Unknown error generating todo list'
      };
    }
  }
  
  /**
   * Extract todo list from AI response
   * @param {string} response - AI response text
   * @returns {object} Todo list object
   */
  extractTodoListFromResponse(response) {
    try {
      // Try to find JSON in the response
      const jsonRegex = /{[\s\S]*}/g;
      const match = response.match(jsonRegex);
      
      if (match) {
        // Try parsing each match until we find valid todo list
        for (const jsonStr of match) {
          try {
            const parsed = JSON.parse(jsonStr);
            
            // Check if this looks like a todo list
            if (parsed.sections && Array.isArray(parsed.sections)) {
              return parsed;
            } else if (parsed.title && parsed.tasks && Array.isArray(parsed.tasks)) {
              // Convert to expected format if needed
              return {
                title: parsed.title,
                sections: [
                  {
                    title: "Tasks",
                    tasks: parsed.tasks
                  }
                ]
              };
            }
          } catch (e) {
            // Skip invalid JSON and try the next match
            console.warn('Failed to parse potential JSON match:', e);
          }
        }
      }
      
      // If no valid JSON found or parsing failed, extract manually
      console.log('No valid JSON found, falling back to extraction...');
      const todoListExtracted = this.extractTodoListManually(response);
      
      if (todoListExtracted.sections.length > 0) {
        return todoListExtracted;
      }
      
      // If all else fails, return a default todo list
      console.warn('Falling back to default todo list');
      return this.getDefaultTodoList();
    } catch (error) {
      console.error('Error extracting todo list:', error);
      return this.getDefaultTodoList();
    }
  }
  
  /**
   * Extract todo list manually using regex patterns
   * @param {string} response - AI response text
   * @returns {object} Todo list object
   */
  extractTodoListManually(response) {
    const sections = [];
    let currentSection = null;
    
    // Split by lines
    const lines = response.split('\n');
    
    // Look for section headers (## or # followed by text)
    // and task items (1. or - followed by text)
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if this is a section header
      if (trimmedLine.startsWith('## ') || trimmedLine.startsWith('# ')) {
        // If we have a current section with tasks, add it to sections
        if (currentSection && currentSection.tasks.length > 0) {
          sections.push(currentSection);
        }
        
        // Create new section
        currentSection = {
          title: trimmedLine.replace(/^#+ /, ''),
          tasks: []
        };
      }
      // Check if this is a task item
      else if ((trimmedLine.match(/^\d+\.\s/) || trimmedLine.match(/^-\s/)) && currentSection) {
        const taskText = trimmedLine.replace(/^\d+\.\s|-\s/, '');
        
        // Skip very short tasks
        if (taskText.length < 5) continue;
        
        // Add to current section
        currentSection.tasks.push({
          id: `task${currentSection.tasks.length + 1}`,
          title: taskText,
          description: '',
          status: 'pending'
        });
      }
      // Check if this might be a task description
      else if (trimmedLine && currentSection && currentSection.tasks.length > 0) {
        // If the line is indented or starts with a space, it might be a description
        if (line.startsWith('    ') || line.startsWith('  ')) {
          const lastTask = currentSection.tasks[currentSection.tasks.length - 1];
          if (lastTask.description) {
            lastTask.description += '\n' + trimmedLine;
          } else {
            lastTask.description = trimmedLine;
          }
        }
      }
    }
    
    // Add the last section if needed
    if (currentSection && currentSection.tasks.length > 0) {
      sections.push(currentSection);
    }
    
    // If no sections were found but we have tasks, create a default section
    if (sections.length === 0 && currentSection && currentSection.tasks.length > 0) {
      sections.push(currentSection);
    }
    
    return {
      title: 'Task Breakdown',
      sections
    };
  }
  
  /**
   * Get default todo list
   * @returns {object} Default todo list object
   */
  getDefaultTodoList() {
    return {
      title: 'Task Breakdown',
      sections: [
        {
          title: 'Setup & Planning',
          tasks: [
            {
              id: 'task1',
              title: 'Initial setup and requirements',
              description: 'Set up the project structure and define key requirements',
              status: 'pending'
            },
            {
              id: 'task2',
              title: 'Design core components',
              description: 'Design the main components and their interactions',
              status: 'pending'
            }
          ]
        },
        {
          title: 'Implementation',
          tasks: [
            {
              id: 'task3',
              title: 'Implement core functionality',
              description: 'Develop the main features and functionality',
              status: 'pending'
            },
            {
              id: 'task4',
              title: 'Testing and refinement',
              description: 'Test the implementation and refine as needed',
              status: 'pending'
            }
          ]
        }
      ]
    };
  }
}

module.exports = ClarificationQuestionsIPC;