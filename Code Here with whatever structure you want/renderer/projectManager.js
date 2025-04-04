export function initializeProjectManager() {
  createProjectManagerUI();
  setupProjectManagerEvents();
  loadProjects();
}

// Create project manager UI
function createProjectManagerUI() {
  // Check if it already exists
  if (document.getElementById('projectManagerSidebar')) {
    return;
  }
  
  // Create the hamburger menu button
  const hamburgerButton = document.createElement('button');
  hamburgerButton.id = 'hamburgerMenuButton';
  hamburgerButton.className = 'hamburger-menu-button';
  hamburgerButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  `;
  
  // Create the project manager sidebar
  const projectManagerSidebar = document.createElement('div');
  projectManagerSidebar.id = 'projectManagerSidebar';
  projectManagerSidebar.className = 'project-manager-sidebar';
  projectManagerSidebar.innerHTML = `
    <div class="sidebar-header">
      <h3>Projects</h3>
      <button id="closeProjectManager" class="close-button">×</button>
    </div>
    <div class="project-list" id="projectList">
      <!-- Projects will be listed here -->
      <div class="loading-spinner"></div>
    </div>
  `;
  
  // Append to body
  document.body.appendChild(hamburgerButton);
  document.body.appendChild(projectManagerSidebar);
}

// Setup project manager event listeners
function setupProjectManagerEvents() {
  const hamburgerButton = document.getElementById('hamburgerMenuButton');
  const sidebar = document.getElementById('projectManagerSidebar');
  const closeButton = document.getElementById('closeProjectManager');
  
  if (!hamburgerButton || !sidebar || !closeButton) {
    console.error('Project manager elements not found');
    return;
  }
  
  // Toggle sidebar visibility
  hamburgerButton.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    loadProjects(); // Refresh projects when opening
  });
  
  // Close sidebar
  closeButton.addEventListener('click', () => {
    sidebar.classList.remove('open');
  });
}

// Load projects from backend
async function loadProjects() {
  const projectList = document.getElementById('projectList');
  if (!projectList) return;
  
  projectList.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    const result = await window.electronAPI.listProjects();
    
    if (result.success) {
      projectList.innerHTML = '';
      
      if (result.projects.length === 0) {
        projectList.innerHTML = '<p class="empty-message">No projects yet. Projects will be created automatically when you start a conversation.</p>';
        return;
      }
      
      // Get current project
      const currentProject = await getCurrentProject();
      
      // Create project items
      result.projects.forEach(project => {
        const projectItem = document.createElement('div');
        projectItem.className = 'project-item';
        if (currentProject && currentProject.name === project.name) {
          projectItem.classList.add('selected');
        }
        
        // Format date
        const createdDate = new Date(project.createdDate);
        const dateString = createdDate.toLocaleDateString();
        
        projectItem.innerHTML = `
          <div class="project-info" data-project="${project.name}">
            <div class="project-title">${project.title || project.name}</div>
            <div class="project-date">${dateString}</div>
          </div>
          <div class="project-actions">
            <button class="delete-project" data-project="${project.name}">×</button>
          </div>
        `;
        
        projectList.appendChild(projectItem);
      });
      
      // Add event listeners for project selection
      document.querySelectorAll('.project-info').forEach(element => {
        element.addEventListener('click', async () => {
          const projectName = element.getAttribute('data-project');
          await selectProject(projectName);
        });
      });
      
      // Add event listeners for project deletion
      document.querySelectorAll('.delete-project').forEach(button => {
        button.addEventListener('click', async (e) => {
          e.stopPropagation();
          const projectName = button.getAttribute('data-project');
          
          if (confirm(`Are you sure you want to delete project "${projectName}"?`)) {
            try {
              const result = await window.electronAPI.deleteProject(projectName);
              
              if (result.success) {
                await loadProjects();
                
                // If deleted the current project, go back to main menu
                if (currentProject && currentProject.name === projectName) {
                  goToMainMenu();
                }
              } else {
                showNotification('Error deleting project: ' + result.error, 'error');
              }
            } catch (error) {
              console.error('Error deleting project:', error);
              showNotification('Error deleting project', 'error');
            }
          }
        });
      });
    } else {
      projectList.innerHTML = `<p class="error-message">Error loading projects: ${result.error}</p>`;
    }
  } catch (error) {
    console.error('Error loading projects:', error);
    projectList.innerHTML = '<p class="error-message">Error loading projects</p>';
  }
}

// Get current project
async function getCurrentProject() {
  try {
    // Use the getProjectDirectory to determine current project
    const directory = await window.electronAPI.getProjectDirectory();
    
    if (directory) {
      return {
        name: path.basename(directory),
        path: directory
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting current project:', error);
    return null;
  }
}

// Select a project
async function selectProject(projectName) {
  try {
    const result = await window.electronAPI.selectProject(projectName);
    
    if (result.success) {
      // Update UI to show selected project
      document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('selected');
      });
      
      document.querySelectorAll(`.project-item .project-info[data-project="${projectName}"]`).forEach(element => {
        element.closest('.project-item').classList.add('selected');
      });
      
      // Show notification
      showNotification(`Project "${result.project.title || projectName}" selected`, 'success');
      
      // Refresh file list if on task execution page
      if (typeof loadFiles === 'function') {
        loadFiles();
      }
      
      // Reset conversation history since we switched projects
      await window.electronAPI.resetConversation();
      
      return result.project;
    } else {
      showNotification('Error selecting project: ' + result.error, 'error');
      return null;
    }
  } catch (error) {
    console.error('Error selecting project:', error);
    showNotification('Error selecting project', 'error');
    return null;
  }
}

// Go to main menu
function goToMainMenu() {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.style.display = 'none';
  });
  
  // Show task entry page
  const taskEntryPage = document.getElementById('taskEntryPage');
  if (taskEntryPage) {
    taskEntryPage.style.display = 'flex';
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Check if notification container exists
  let container = document.getElementById('notificationContainer');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'notificationContainer';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
  
  // Create notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">${message}</div>
    <button class="notification-close">×</button>
  `;
  
  // Add to container
  container.appendChild(notification);
  
  // Setup close button
  const closeButton = notification.querySelector('.notification-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      notification.classList.add('fadeout');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    });
  }
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    notification.classList.add('fadeout');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

// Export functions
export {
  loadProjects,
  selectProject
};