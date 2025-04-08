/**
 * Project Handler for the main process
 * Manages project-related operations like creation, deletion, and loading
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ProjectHandler {
  constructor(app) {
    this.app = app;
    this.projectsDir = path.join(app.getPath('userData'), 'projects');
    
    // We need to ensure the projects directory is set up before any operations
    this.initialized = this.setupProjectsDirectory();
  }

  /**
   * Set up the projects directory
   */
  async setupProjectsDirectory() {
    try {
      // Check if projects directory exists, create if not
      try {
        await fs.access(this.projectsDir);
      } catch (error) {
        await fs.mkdir(this.projectsDir, { recursive: true });
        console.log('Projects directory created:', this.projectsDir);
      }
      
      return true;
    } catch (error) {
      console.error('Error setting up projects directory:', error);
      throw error;
    }
  }

  /**
   * Register IPC handlers for project operations
   * @param {Object} ipcMain - Electron IPC main instance
   */
  registerIpcHandlers(ipcMain) {
    ipcMain.handle('projects:getProjects', this.getProjects.bind(this));
    ipcMain.handle('projects:createProject', (event, projectData) => this.createProject(projectData));
    ipcMain.handle('projects:deleteProject', (event, projectId) => this.deleteProject(projectId));
    ipcMain.handle('projects:getProject', (event, projectId) => this.getProject(projectId));
    ipcMain.handle('projects:updateProjectProgress', (event, projectId, progress) => 
      this.updateProjectProgress(projectId, progress));
  }

  /**
   * Get all projects
   * @returns {Promise<Array>} Array of project objects
   */
  async getProjects() {
    try {
      // Make sure initialization is complete
      await this.initialized;
      
      const projectFolders = await fs.readdir(this.projectsDir);
      
      const projects = [];
      for (const folder of projectFolders) {
        try {
          const projectPath = path.join(this.projectsDir, folder);
          const stats = await fs.stat(projectPath);
          
          // Skip if not a directory
          if (!stats.isDirectory()) continue;
          
          // Read metadata
          const metadataPath = path.join(projectPath, 'metadata.json');
          const metadataContent = await fs.readFile(metadataPath, 'utf8');
          const metadata = JSON.parse(metadataContent);
          
          projects.push({
            id: folder,
            ...metadata
          });
        } catch (error) {
          console.error(`Error reading project ${folder}:`, error);
          // Skip this project if there's an error
        }
      }
      
      // Sort by creation date, newest first
      return projects.sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
    } catch (error) {
      console.error('Error getting projects:', error);
      return [];
    }
  }

  /**
   * Create a new project
   * @param {Object} projectData - Project data
   * @returns {Promise<Object>} Created project
   */
  async createProject(projectData) {
    try {
      // Make sure initialization is complete
      await this.initialized;
      
      // Generate unique ID
      const projectId = this.generateProjectId(projectData.title);
      const projectDir = path.join(this.projectsDir, projectId);
      
      // Create project directory
      await fs.mkdir(projectDir, { recursive: true });
      
      // Also create a files subdirectory for the project
      const projectFilesDir = path.join(projectDir, 'files');
      await fs.mkdir(projectFilesDir, { recursive: true });
      
      // Create metadata
      const metadata = {
        title: projectData.title,
        description: projectData.description || '',
        createdDate: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        outputDirectory: projectData.outputDirectory || '',
        progress: projectData.progress || 'clarification'
      };
      
      // Write metadata.json
      await fs.writeFile(
        path.join(projectDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2),
        'utf8'
      );
      
      // Initialize empty files.json
      await fs.writeFile(
        path.join(projectDir, 'files.json'),
        JSON.stringify({ lastUpdated: new Date().toISOString(), files: [] }, null, 2),
        'utf8'
      );
      
      // Initialize empty todo.json
      await fs.writeFile(
        path.join(projectDir, 'todo.json'),
        JSON.stringify({ title: metadata.title, sections: [] }, null, 2),
        'utf8'
      );
      
      // Initialize empty conversations.json
      await fs.writeFile(
        path.join(projectDir, 'conversations.json'),
        JSON.stringify({}, null, 2),
        'utf8'
      );
      
      // Initialize globalContext.txt
      await fs.writeFile(
        path.join(projectDir, 'globalContext.txt'),
        `# Global Context for ${metadata.title}\n\n${projectData.description || ''}`,
        'utf8'
      );
      
      // Initialize empty sanityChecks.json
      await fs.writeFile(
        path.join(projectDir, 'sanityChecks.json'),
        JSON.stringify({ checks: [] }, null, 2),
        'utf8'
      );
      
      // Return the created project with ID
      return {
        id: projectId,
        ...metadata
      };
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error(`Failed to create project: ${error.message}`);
    }
  }

  /**
   * Generate a URL-friendly project ID from title
   * @param {string} title - Project title
   * @returns {string} Project ID
   */
  generateProjectId(title) {
    // Convert title to kebab-case
    const kebabCase = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .substring(0, 50); // Limit length
    
    // Add timestamp hash for uniqueness
    const timestamp = Date.now().toString();
    const hash = crypto.createHash('md5').update(timestamp).digest('hex').substring(0, 6);
    
    return `${kebabCase}-${hash}`;
  }

  /**
   * Delete a project
   * @param {string} projectId - ID of the project to delete
   * @returns {Promise<Object>} Result of deletion
   */
  async deleteProject(projectId) {
    try {
      // Make sure initialization is complete
      await this.initialized;
      
      // Safety check - prevent path traversal
      if (projectId.includes('..') || projectId.includes('/') || projectId.includes('\\')) {
        throw new Error('Invalid project ID');
      }
      
      const projectDir = path.join(this.projectsDir, projectId);
      
      // Get project info before deletion
      let projectInfo = null;
      try {
        const metadataPath = path.join(projectDir, 'metadata.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        projectInfo = JSON.parse(metadataContent);
      } catch (error) {
        console.warn('Could not read project metadata before deletion:', error);
      }
      
      // Delete project directory recursively
      const { rm } = require('fs').promises;
      await rm(projectDir, { recursive: true, force: true });
      
      return { 
        success: true,
        deleted: projectId,
        projectInfo 
      };
    } catch (error) {
      console.error('Error deleting project:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Get a specific project
   * @param {string} projectId - ID of the project to get
   * @returns {Promise<Object>} Project data
   */
  async getProject(projectId) {
    try {
      // Make sure initialization is complete
      await this.initialized;
      
      // Safety check
      if (projectId.includes('..') || projectId.includes('/') || projectId.includes('\\')) {
        throw new Error('Invalid project ID');
      }
      
      const projectDir = path.join(this.projectsDir, projectId);
      
      // Read metadata
      const metadataPath = path.join(projectDir, 'metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      // Read global context
      const globalContextPath = path.join(projectDir, 'globalContext.txt');
      const globalContext = await fs.readFile(globalContextPath, 'utf8');
      
      // Read todo list if it exists
      let todoList = null;
      try {
        const todoPath = path.join(projectDir, 'todo.json');
        const todoContent = await fs.readFile(todoPath, 'utf8');
        todoList = JSON.parse(todoContent);
      } catch (error) {
        console.warn(`Todo list not found for project ${projectId}`);
      }
      
      return {
        id: projectId,
        ...metadata,
        globalContext,
        todoList
      };
    } catch (error) {
      console.error(`Error getting project ${projectId}:`, error);
      throw new Error(`Failed to get project: ${error.message}`);
    }
  }

  /**
   * Update project progress state
   * @param {string} projectId - ID of the project
   * @param {string} progress - New progress state
   * @returns {Promise<Object>} Updated project
   */
  async updateProjectProgress(projectId, progress) {
    try {
      // Make sure initialization is complete
      await this.initialized;
      
      // Safety check
      if (projectId.includes('..') || projectId.includes('/') || projectId.includes('\\')) {
        throw new Error('Invalid project ID');
      }
      
      const metadataPath = path.join(this.projectsDir, projectId, 'metadata.json');
      
      // Read current metadata
      const metadataContent = await fs.readFile(metadataPath, 'utf8');
      const metadata = JSON.parse(metadataContent);
      
      // Update progress and last modified
      metadata.progress = progress;
      metadata.lastModified = new Date().toISOString();
      
      // Write updated metadata
      await fs.writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        'utf8'
      );
      
      // Return updated project
      return {
        id: projectId,
        ...metadata
      };
    } catch (error) {
      console.error(`Error updating project progress for ${projectId}:`, error);
      throw new Error(`Failed to update project progress: ${error.message}`);
    }
  }
}

module.exports = ProjectHandler;