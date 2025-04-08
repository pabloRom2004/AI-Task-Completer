/**
 * Project sidebar component
 * Handles displaying and interacting with the list of projects
 */

import { setupProjectIPC } from './ipc.js';

export function initProjectSidebar() {
  // DOM elements
  const projectSidebar = document.getElementById('projectSidebar');
  const toggleProjectSidebar = document.getElementById('toggleProjectSidebar');
  const closeSidebar = document.getElementById('closeSidebar');
  const projectList = document.getElementById('projectList');
  const newProject = document.getElementById('newProject');
  
  // Project page elements
  const taskEntryPage = document.getElementById('taskEntryPage');
  const initialTaskDescription = document.getElementById('initialTaskDescription');
  const startTaskEntry = document.getElementById('startTaskEntry');
  
  // State variables
  let selectedProjectId = null;
  let currentPage = 'main'; // Track which page/state we're on
  let projects = [];
  let isTextareaInteractionEnabled = true;
  
  // Setup IPC
  const projectIPC = setupProjectIPC(window.electronAPI);
  
  // Initialize
  setupEventListeners();
  loadProjects();
  
  // Create notification container
  const notificationContainer = document.createElement('div');
  notificationContainer.className = 'notification-container';
  document.body.appendChild(notificationContainer);

  /**
   * Set up event listeners for the project sidebar
   */
  function setupEventListeners() {
    // Toggle sidebar visibility
    toggleProjectSidebar.addEventListener('click', () => {
      projectSidebar.classList.toggle('open');
    });

    // Close sidebar
    closeSidebar.addEventListener('click', () => {
      projectSidebar.classList.remove('open');
    });

    // "New Project" button - returns to the main screen
    newProject.addEventListener('click', () => {
      // Clear the task description
      initialTaskDescription.value = '';
      
      // Make sure textarea is enabled and interactive
      enableTextareaInteraction();
      
      // Show the main task entry page
      showNotification('Started new project', 'info');
      projectSidebar.classList.remove('open');
      
      // Reset current page tracking
      currentPage = 'main';
    });
    
    // Fix: Add a click handler to ensure textarea is clickable
    initialTaskDescription.addEventListener('click', function(e) {
      // Make sure the textarea is focused when clicked
      this.focus();
      e.stopPropagation();
    });
    
    // Connect "Let's Begin" button to create a project just-in-time
    startTaskEntry.addEventListener('click', async () => {
      const taskDescription = initialTaskDescription.value.trim();
      
      if (!taskDescription) {
        showNotification('Please enter a task description', 'error');
        return;
      }
      
      try {
        // Generate a project title from the task
        const projectTitle = generateProjectTitle(taskDescription);
        
        // Create the project (just-in-time)
        await createProject(projectTitle, taskDescription);
        
        // Show notification
        showNotification(`Project "${projectTitle}" created`, 'success');
        
        // Use notification instead of alert to avoid focus issues
        showNotification('Task clarification would begin here', 'info', 5000);
        
        // Update current page tracking
        currentPage = 'clarification';
      } catch (error) {
        showNotification(`Error creating project: ${error.message}`, 'error');
      }
    });
    
    // Test prompt button handling
    document.getElementById('testPromptButton').addEventListener('click', () => {
      // Make sure textarea is interactive
      enableTextareaInteraction();
    });
  }

  /**
   * Enable interaction with the textarea
   * Fixes issues with textarea becoming unclickable
   */
  function enableTextareaInteraction() {
    isTextareaInteractionEnabled = true;
    initialTaskDescription.style.pointerEvents = 'auto';
    initialTaskDescription.disabled = false;
    
    // Force a focus to ensure it's interactive
    setTimeout(() => {
      initialTaskDescription.focus();
    }, 100);
  }

  /**
   * Load projects from storage
   */
  async function loadProjects() {
    try {
      // Show loading state
      projectList.innerHTML = '<div class="empty-message">Loading projects...</div>';
      
      // Get projects from IPC
      projects = await projectIPC.getProjects();
      
      // Render projects
      renderProjectList(projects);
    } catch (error) {
      console.error('Error loading projects:', error);
      projectList.innerHTML = '<div class="empty-message">Error loading projects</div>';
      showNotification('Failed to load projects', 'error');
    }
  }

  /**
   * Generate a project title from the task description
   * This is a mock implementation - in the real app, the AI would do this
   * @param {string} taskDescription - The task description
   * @returns {string} A generated project title
   */
  function generateProjectTitle(taskDescription) {
    // Simple mock implementation - take first few words
    const words = taskDescription.split(' ');
    let title = words.slice(0, 4).join(' ');
    
    // Add ellipsis if we truncated
    if (words.length > 4) {
      title += '...';
    }
    
    return title;
  }
  
  /**
   * Create a new project
   * @param {string} title - Project title
   * @param {string} description - Project description
   */
  async function createProject(title, description) {
    try {
      // Create project using IPC
      const newProject = await projectIPC.createProject({
        title: title,
        description: description,
        progress: 'clarification'
      });
      
      // Add to local projects array
      projects.push(newProject);
      
      // Update UI
      renderProjectList(projects);
      
      // Select the new project
      selectProject(newProject.id);
      
      return newProject;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  /**
   * Render the list of projects in the sidebar
   * @param {Array} projectsArray - Array of project objects
   */
  function renderProjectList(projectsArray) {
    projectList.innerHTML = '';
    
    if (projectsArray.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'No projects yet';
      projectList.appendChild(emptyMessage);
      return;
    }
    
    projectsArray.forEach(project => {
      const projectItem = document.createElement('div');
      projectItem.className = 'project-item';
      if (project.id === selectedProjectId) {
        projectItem.classList.add('selected');
      }
      
      const projectInfo = document.createElement('div');
      projectInfo.className = 'project-info';
      
      const titleElement = document.createElement('div');
      titleElement.className = 'project-title';
      titleElement.textContent = project.title;
      
      const dateElement = document.createElement('div');
      dateElement.className = 'project-date';
      dateElement.textContent = formatDate(project.createdDate);
      
      const progressElement = document.createElement('div');
      progressElement.className = 'project-progress';
      progressElement.textContent = formatProgress(project.progress);
      
      projectInfo.appendChild(titleElement);
      projectInfo.appendChild(dateElement);
      projectInfo.appendChild(progressElement);
      
      const projectActions = document.createElement('div');
      projectActions.className = 'project-actions';
      
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-project-btn';
      deleteButton.innerHTML = '&times;';
      deleteButton.title = 'Delete project';
      
      // Project selection (click on project info)
      projectInfo.addEventListener('click', () => {
        selectProject(project.id);
      });
      
      // Delete button click
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the project selection
        deleteProject(project.id);
      });
      
      projectActions.appendChild(deleteButton);
      projectItem.appendChild(projectInfo);
      projectItem.appendChild(projectActions);
      projectList.appendChild(projectItem);
    });
  }

  /**
   * Format the progress state for display
   * @param {string} progress - Progress state
   * @returns {string} Formatted progress text
   */
  function formatProgress(progress) {
    switch (progress) {
      case 'main':
        return 'Not started';
      case 'clarification':
        return 'Task clarification';
      case 'todo':
        return 'To-do list created';
      case 'execution':
        return 'In progress';
      default:
        return 'Unknown state';
    }
  }

  /**
   * Select a project
   * @param {string} projectId - ID of the project to select
   */
  async function selectProject(projectId) {
    try {
      selectedProjectId = projectId;
      
      // Update UI to show selected project
      renderProjectList(projects);
      
      // Get full project details
      const project = await projectIPC.getProject(projectId);
      
      if (project) {
        // Use notification instead of alert to avoid focus issues
        showNotification(`Loading project: "${project.title}"`, 'info', 3000);
        showNotification(`Would transition to ${project.progress} stage`, 'info', 5000);
        
        // Update current page tracking
        currentPage = project.progress;
        
        // Make sure textarea is interactive after project selection
        enableTextareaInteraction();
      }
    } catch (error) {
      console.error('Error selecting project:', error);
      showNotification('Failed to load project', 'error');
    }
  }

  /**
   * Delete a project
   * @param {string} projectId - ID of the project to delete
   */
  async function deleteProject(projectId) {
    try {
      // Find project name before deletion
      const project = projects.find(p => p.id === projectId);
      const projectName = project ? project.title : 'Unknown project';
      
      // Delete project using IPC
      const result = await projectIPC.deleteProject(projectId);
      
      if (result.success) {
        // Remove from our local array
        projects = projects.filter(p => p.id !== projectId);
        
        // If the deleted project was selected, reset selection
        if (selectedProjectId === projectId) {
          selectedProjectId = null;
        }
        
        // Re-render the list
        renderProjectList(projects);
        
        // Show notification
        showNotification(`Project "${projectName}" deleted`, 'success');
        
        // Make sure textarea is interactive
        enableTextareaInteraction();
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      showNotification(`Failed to delete project: ${error.message}`, 'error');
    }
  }

  /**
   * Format a date for display
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date
   */
  function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Show a notification message
   * @param {string} message - Message to display
   * @param {string} type - Message type (success, error, info)
   * @param {number} duration - How long to show the notification (ms)
   */
  function showNotification(message, type = 'info', duration = 3000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Create content
    const content = document.createElement('div');
    content.className = 'notification-content';
    content.textContent = message;
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      notification.classList.add('fadeout');
      setTimeout(() => notification.remove(), 300);
    });
    
    // Assemble notification
    notification.appendChild(content);
    notification.appendChild(closeBtn);
    
    // Add to document
    document.querySelector('.notification-container').appendChild(notification);
    
    // Auto-remove after specified duration
    setTimeout(() => {
      notification.classList.add('fadeout');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  // Return public methods
  return {
    openSidebar() {
      projectSidebar.classList.add('open');
    },
    
    closeSidebar() {
      projectSidebar.classList.remove('open');
    },
    
    refreshProjects() {
      loadProjects();
    }
  };
}