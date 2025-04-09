/**
 * UI component for the to-do list panel
 */

import { getCurrentTasksData, updateTaskStatus, getTaskById } from '../services/taskService.js';
import { startTaskConversation, sendMessageService } from '../services/todoService.js';
import { initSimpleMarkdownRenderer } from './markdownRenderer.js';

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
let markdownRenderer;

/**
 * Initialize the to-do UI
 */
export async function initTodoUI() {
  // Get DOM elements
  todoList = document.getElementById('todoList');
  currentTaskTitle = document.getElementById('currentTaskTitle');
  currentTaskDescription = document.getElementById('currentTaskDescription');
  conversationContainer = document.getElementById('conversationContainer');
  messageInput = document.getElementById('messageInput');
  sendMessageBtn = document.getElementById('sendMessageBtn');
  completeTaskBtn = document.getElementById('completeTaskBtn');
  backToMenuBtn = document.getElementById('backToMenuBtn');
  
  // Initialize the simple markdown renderer
  markdownRenderer = initSimpleMarkdownRenderer();
  
  // Set up event listeners
  setupEventListeners();
  
  // Initialize code copy functionality for the conversation container
  markdownRenderer.setupCopyButtons(conversationContainer);
  
  // Listen for tasks generated event
  document.addEventListener('tasksGenerated', renderTaskList);
}

// Update your event listeners to use the new function name
function setupEventListeners() {
  // Complete task button
  if (completeTaskBtn) {
    completeTaskBtn.addEventListener('click', () => {
      if (selectedTaskId) {
        markTaskComplete(selectedTaskId);
      }
    });
  }

  // Send message button - update to use the new function name
  if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', handleSendMessage);
  }

  // Message input enter key - update to use the new function name
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        handleSendMessage();
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
  console.log(tasksData)
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
 * Check if the user is scrolled to (or near) the bottom of the container
 * @param {HTMLElement} container - The scrollable container
 * @param {number} threshold - How close to bottom counts as "at bottom" (in pixels)
 * @returns {boolean} - Whether user is at/near bottom
 */
function isScrolledNearBottom(container, threshold = 50) {
  return container.scrollHeight - container.clientHeight - container.scrollTop <= threshold;
}

/**
 * Scroll container to bottom if appropriate
 * @param {HTMLElement} container - The scrollable container
 * @param {boolean} force - Whether to force scrolling regardless of current position
 */
function scrollIfNeeded(container, force = false) {
  // Only auto-scroll if user was already near bottom or force is true
  if (force || isScrolledNearBottom(container)) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Select a task and show its details
 * @param {string} taskId - The ID of the task to select
 */
async function selectTask(taskId) {
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

    // Add loading message
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'message system-message';
    loadingMessage.innerHTML = `
      <div class="message-content">
        <p>Loading assistant response...</p>
      </div>
    `;
    conversationContainer.appendChild(loadingMessage);

    // Always scroll to bottom when selecting a new task (force=true)
    scrollIfNeeded(conversationContainer, true);

    try {
      // Get initial message from the AI
      const initialResponse = await startTaskConversation(taskId);

      // Remove loading message
      conversationContainer.removeChild(loadingMessage);

      // Add assistant message
      const assistantMessage = document.createElement('div');
      assistantMessage.className = 'message assistant-message';
      assistantMessage.innerHTML = `
      <div class="message-content">
        ${markdownRenderer.render(initialResponse)}
      </div>
    `;

      conversationContainer.appendChild(assistantMessage);

      // Always scroll to bottom for initial message (force=true)
      scrollIfNeeded(conversationContainer, true);
    } catch (error) {
      // Update loading message to show error
      loadingMessage.innerHTML = `
        <div class="message-content">
          <p>Error: ${error.message}</p>
          <p>Please try again or check your API settings.</p>
        </div>
      `;
      // Also scroll for errors
      scrollIfNeeded(conversationContainer, true);
    }
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

// Update the sendMessage function's scrolling behavior
async function handleSendMessage() {
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

    // User just sent a message, so we want to see the loading indicator
    // Always scroll to bottom after user sends message (force=true)
    scrollIfNeeded(conversationContainer, true);

    // Add loading message
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'message system-message';
    loadingMessage.innerHTML = `
      <div class="message-content">
        <p>Loading assistant response...</p>
      </div>
    `;
    conversationContainer.appendChild(loadingMessage);

    // Also scroll to see the loading indicator
    scrollIfNeeded(conversationContainer, true);
  }

  // Clear input
  messageInput.value = '';

  try {
    // Get response from the AI - use the imported service function
    const response = await sendMessageService(messageText);

    if (conversationContainer) {
      // Remove loading message
      conversationContainer.removeChild(conversationContainer.lastChild);

      // Add assistant message
      const assistantMessage = document.createElement('div');
      assistantMessage.className = 'message assistant-message';
      assistantMessage.innerHTML = `
      <div class="message-content">
        ${markdownRenderer.render(response)}
      </div>
    `;

      conversationContainer.appendChild(assistantMessage);

      // Check if we should auto-scroll based on where the user was before the response
      scrollIfNeeded(conversationContainer);
    }
  } catch (error) {
    if (conversationContainer) {
      // Update loading message to show error
      conversationContainer.lastChild.innerHTML = `
        <div class="message-content">
          <p>Error: ${error.message}</p>
          <p>Please try again or check your API settings.</p>
        </div>
      `;

      // Auto-scroll to show error
      scrollIfNeeded(conversationContainer);
    }
  }
}