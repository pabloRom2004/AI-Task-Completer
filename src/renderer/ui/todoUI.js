/**
 * UI component for the to-do list panel
 */

import { getCurrentTasksData, updateTaskStatus, getTaskById } from '../services/taskService.js';

// DOM elements
let todoList;
let currentTaskTitle;
let currentTaskDescription;
let conversationContainer;
let messageInput;
let sendMessageBtn;
let completeTaskBtn;
let backToMenuBtn;

// Current state
let selectedTaskId = null;

/**
 * Initialize the to-do UI
 */
export function initTodoUI() {
  // Get DOM elements
  todoList = document.getElementById('todoList');
  currentTaskTitle = document.getElementById('currentTaskTitle');
  currentTaskDescription = document.getElementById('currentTaskDescription');
  conversationContainer = document.getElementById('conversationContainer');
  messageInput = document.getElementById('messageInput');
  sendMessageBtn = document.getElementById('sendMessageBtn');
  completeTaskBtn = document.getElementById('completeTaskBtn');
  backToMenuBtn = document.getElementById('backToMenuBtn');
  
  // Set up event listeners
  setupEventListeners();
  
  // Listen for tasks generated event
  document.addEventListener('tasksGenerated', renderTaskList);
}

/**
 * Set up event listeners for the to-do UI
 */
function setupEventListeners() {
  // Complete task button
  if (completeTaskBtn) {
    completeTaskBtn.addEventListener('click', () => {
      if (selectedTaskId) {
        markTaskComplete(selectedTaskId);
      }
    });
  }
  
  // Send message button
  if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', sendMessage);
  }
  
  // Message input enter key
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        sendMessage();
        e.preventDefault();
      }
    });
  }
  
  // Back to main menu button
  if (backToMenuBtn) {
    backToMenuBtn.addEventListener('click', () => {
        goToMainMenu();
    });
  }
}

/**
 * Return to the main menu
 */
function goToMainMenu() {
  // Hide current pages
  const clarificationPage = document.getElementById('taskClarificationPage');
  const todoExecutionPage = document.getElementById('todoExecutionPage');
  
  if (clarificationPage) clarificationPage.style.display = 'none';
  if (todoExecutionPage) todoExecutionPage.style.display = 'none';
  
  // Show main menu
  const taskEntryPage = document.getElementById('taskEntryPage');
  if (taskEntryPage) taskEntryPage.style.display = 'flex';
  
  // Reset any state if needed
  selectedTaskId = null;
}

/**
 * Render the task list from current data
 */
export function renderTaskList() {
  const tasksData = getCurrentTasksData();
  
  if (!todoList) {
    console.error('Todo list element not found');
    return;
  }
  
  if (!tasksData || !tasksData.sections) {
    todoList.innerHTML = '<li class="todo-item empty">No tasks available</li>';
    return;
  }
  
  // Clear the list
  todoList.innerHTML = '';
  
  // Add each section and its tasks
  tasksData.sections.forEach(section => {
    // Create section header
    const sectionHeader = document.createElement('li');
    sectionHeader.className = 'todo-section-header';
    sectionHeader.textContent = section.title;
    todoList.appendChild(sectionHeader);
    
    // Add tasks for this section
    section.tasks.forEach(task => {
      const taskItem = document.createElement('li');
      taskItem.className = `todo-item ${task.status}`;
      taskItem.dataset.taskId = task.id;
      taskItem.innerHTML = `
        <div class="task-status-indicator"></div>
        <div class="task-content">
          <div class="task-title">${task.title}</div>
        </div>
      `;
      
      // Add click event - only allow selecting if it's the next incomplete task
      taskItem.addEventListener('click', () => {
        // Only allow selecting if this is the next task or already selected
        if (canSelectTask(task.id)) {
          selectTask(task.id);
        }
      });
      
      todoList.appendChild(taskItem);
    });
  });
  
  // Select the first incomplete task automatically
  selectFirstIncompleteTask();
}

/**
 * Check if a task can be selected
 * @param {string} taskId - The ID of the task to check
 * @returns {boolean} Whether the task can be selected
 */
function canSelectTask(taskId) {
  // If this is the currently selected task, always allow
  if (taskId === selectedTaskId) return true;
  
  const tasksData = getCurrentTasksData();
  if (!tasksData) return false;
  
  // Find all tasks in order
  const allTasks = [];
  tasksData.sections.forEach(section => {
    section.tasks.forEach(task => {
      allTasks.push(task);
    });
  });
  
  // Find first incomplete task
  const firstIncompleteTask = allTasks.find(task => task.status !== 'completed');
  
  // Only allow selecting the first incomplete task
  return firstIncompleteTask && firstIncompleteTask.id === taskId;
}

/**
 * Select the first incomplete task
 */
function selectFirstIncompleteTask() {
  const tasksData = getCurrentTasksData();
  if (!tasksData) return;
  
  // Find all tasks
  const allTasks = [];
  tasksData.sections.forEach(section => {
    section.tasks.forEach(task => {
      allTasks.push(task);
    });
  });
  
  // Find first incomplete task
  const firstIncompleteTask = allTasks.find(task => task.status !== 'completed');
  
  if (firstIncompleteTask) {
    selectTask(firstIncompleteTask.id);
  }
}

/**
 * Select a task and show its details
 * @param {string} taskId - The ID of the task to select
 */
function selectTask(taskId) {
  // Update selected state in UI
  const taskItems = document.querySelectorAll('.todo-item');
  taskItems.forEach(item => {
    item.classList.remove('selected');
    if (item.dataset.taskId === taskId) {
      item.classList.add('selected');
    }
  });
  
  // Update current task
  selectedTaskId = taskId;
  const task = getTaskById(taskId);
  
  if (!task) {
    console.error('Task not found:', taskId);
    return;
  }
  
  // Update task title and description
  if (currentTaskTitle) {
    currentTaskTitle.textContent = task.title;
  }
  
  if (currentTaskDescription) {
    currentTaskDescription.textContent = task.description;
  }
  
  // Enable input fields
  if (messageInput) {
    messageInput.disabled = false;
    messageInput.placeholder = 'Ask for help with this task...';
    messageInput.focus();
  }
  
  if (sendMessageBtn) {
    sendMessageBtn.disabled = false;
  }
  
  if (completeTaskBtn) {
    completeTaskBtn.disabled = false;
  }
  
  // Clear conversation and add initial assistant message
  if (conversationContainer) {
    conversationContainer.innerHTML = '';
    
    // Add initial assistant message
    const assistantMessage = document.createElement('div');
    assistantMessage.className = 'message assistant-message';
    assistantMessage.innerHTML = `
      <div class="message-content">
        <p>I'm ready to help you with: <strong>${task.title}</strong></p>
        <p>${task.description}</p>
        <p>How would you like to proceed?</p>
      </div>
    `;
    
    conversationContainer.appendChild(assistantMessage);
    
    // Scroll to bottom
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
  }
}

/**
 * Mark a task as complete
 * @param {string} taskId - The ID of the task to complete
 */
function markTaskComplete(taskId) {
  // Update task status
  const success = updateTaskStatus(taskId, 'completed');
  
  if (!success) {
    console.error('Failed to update task status');
    return;
  }
  
  // Update UI
  const taskItem = document.querySelector(`.todo-item[data-task-id="${taskId}"]`);
  if (taskItem) {
    taskItem.classList.remove('pending', 'in-progress');
    taskItem.classList.add('completed');
  }
  
  // Add completion message
  if (conversationContainer) {
    const completionMessage = document.createElement('div');
    completionMessage.className = 'message system-message';
    completionMessage.innerHTML = `
      <div class="message-content">
        <p>✅ Task marked as complete.</p>
      </div>
    `;
    
    conversationContainer.appendChild(completionMessage);
    
    // Scroll to bottom
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
  }
  
  // Automatically select next incomplete task
  selectFirstIncompleteTask();
}

/**
 * Send a message in the conversation
 */
function sendMessage() {
  if (!messageInput || !messageInput.value.trim()) {
    return;
  }
  
  const messageText = messageInput.value.trim();
  
  // Add user message to conversation
  if (conversationContainer) {
    const userMessage = document.createElement('div');
    userMessage.className = 'message user-message';
    userMessage.innerHTML = `
      <div class="message-content">
        <p>${messageText}</p>
      </div>
    `;
    
    conversationContainer.appendChild(userMessage);
    
    // Scroll to bottom
    conversationContainer.scrollTop = conversationContainer.scrollHeight;
  }
  
  // Clear input
  messageInput.value = '';
  
  // This would normally call an API to get a response
  // For now, just add a placeholder assistant response
  setTimeout(() => {
    if (conversationContainer) {
      const assistantMessage = document.createElement('div');
      assistantMessage.className = 'message assistant-message';
      assistantMessage.innerHTML = `
        <div class="message-content">
          <p>This is a placeholder response. In the complete implementation, this would call the AI API to get a helpful response about this specific task.</p>
        </div>
      `;
      
      conversationContainer.appendChild(assistantMessage);
      
      // Scroll to bottom
      conversationContainer.scrollTop = conversationContainer.scrollHeight;
    }
  }, 1000);
}