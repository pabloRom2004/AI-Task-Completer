/**
 * Handles all file system operations within the selected project folder
 */
class FileService {
  constructor() {
    this.projectFolderPath = null;
    this.openFilePaths = new Set(); // Track files we've interacted with
  }

  /**
   * Set the project folder
   * @param {string} folderPath - The absolute path of the selected project folder
   */
  setProjectFolder(folderPath) {
    // Close any open resources from previous folder
    this.closeAllResources();
    
    this.projectFolderPath = folderPath;
    return folderPath;
  }

  /**
   * Get the currently selected project folder
   * @returns {string|null} The project folder path or null if not set
   */
  getProjectFolder() {
    return this.projectFolderPath;
  }

  /**
   * Reset the project folder selection and clean up resources
   */
  resetProjectFolder() {
    this.closeAllResources();
    this.projectFolderPath = null;
  }
  
  /**
   * Close any open resources and clean up
   */
  closeAllResources() {
    // Clear tracking of open files
    this.openFilePaths.clear();
    
    // Force garbage collection if available (helps with resource cleanup)
    if (window.gc) {
      try {
        window.gc();
      } catch (error) {
        console.error('Error during garbage collection:', error);
      }
    }
  }

  /**
   * Check if a path is within the project folder (security check)
   * @param {string} filePath - The path to check
   * @returns {boolean} True if the path is within the project folder
   * @private
   */
  _isPathWithinProject(filePath) {
    if (!this.projectFolderPath) {
      console.error('Project folder not set');
      return false;
    }

    // Normalize paths to handle different path separators
    const normalizedFilePath = filePath.replace(/\\/g, '/');
    const normalizedProjectPath = this.projectFolderPath.replace(/\\/g, '/');
    
    return normalizedFilePath.startsWith(normalizedProjectPath);
  }

  /**
   * Prompts the user to select a project folder
   */
  async selectFolder() {
    try {
      // Clean up any existing resources first
      this.closeAllResources();
      
      const result = await window.electronAPI.files.selectFolder();
      if (result.canceled) {
        return null;
      }
      const folderPath = result.filePaths[0];
      this.setProjectFolder(folderPath);
      return folderPath;
    } catch (error) {
      console.error('Error selecting folder:', error);
      return null;
    }
  }

  /**
   * Read a file from the project folder
   * @param {string} filePath - Path to file, relative or absolute
   * @returns {Promise<string>} Content of the file
   */
  async readFile(filePath) {
    // If the path is relative, make it absolute
    const absolutePath = this._makeAbsolutePath(filePath);
    
    // Security check
    if (!this._isPathWithinProject(absolutePath)) {
      throw new Error('Security violation: Attempted to read file outside project folder');
    }

    try {
      // Track that we're accessing this file
      this.openFilePaths.add(absolutePath);
      
      const content = await window.electronAPI.files.readFile(absolutePath);
      return content;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Write content to a file within the project folder
   * @param {string} filePath - Path to file, relative or absolute
   * @param {string} content - Content to write
   * @returns {Promise<string>} Path of the written file
   */
  async writeFile(filePath, content) {
    // If the path is relative, make it absolute
    const absolutePath = this._makeAbsolutePath(filePath);
    
    // Security check
    if (!this._isPathWithinProject(absolutePath)) {
      throw new Error('Security violation: Attempted to write file outside project folder');
    }

    try {
      // Track that we're accessing this file
      this.openFilePaths.add(absolutePath);
      
      await window.electronAPI.files.writeFile(absolutePath, content);
      return absolutePath;
    } catch (error) {
      console.error(`Error writing file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file within the project folder
   * @param {string} filePath - Path to file, relative or absolute
   * @returns {Promise<boolean>} True if successful
   */
  async deleteFile(filePath) {
    // If the path is relative, make it absolute
    const absolutePath = this._makeAbsolutePath(filePath);
    
    // Security check
    if (!this._isPathWithinProject(absolutePath)) {
      throw new Error('Security violation: Attempted to delete file outside project folder');
    }

    // Prevent deletion of the root project folder
    if (absolutePath === this.projectFolderPath) {
      throw new Error('Security violation: Cannot delete the root project folder');
    }

    try {
      await window.electronAPI.files.deleteFile(absolutePath);
      // Remove from tracking if it was tracked
      this.openFilePaths.delete(absolutePath);
      return true;
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get a list of all files in the project folder
   * @returns {Promise<string[]>} Array of file paths
   */
  async listAllFiles() {
    if (!this.projectFolderPath) {
      throw new Error('Project folder not set');
    }

    try {
      return await window.electronAPI.files.listFiles();
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Convert a relative path to absolute path
   * @param {string} filePath - Path to convert
   * @returns {string} Absolute path
   * @private
   */
  _makeAbsolutePath(filePath) {
    if (!this.projectFolderPath) {
      throw new Error('Project folder not set');
    }

    // If the path is already absolute and starts with the project folder, return it
    if (filePath.startsWith(this.projectFolderPath)) {
      return filePath;
    }

    // If it's a relative path, join it with the project folder path
    const path = window.require ? window.require('path') : { join: (a, b) => `${a}/${b.replace(/^\//, '')}` };
    return path.join(this.projectFolderPath, filePath.replace(/^\//, ''));
  }
}

// Export a singleton instance
const fileService = new FileService();

// Listen for window unload event to clean up resources
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    console.log('Window unloading, cleaning up file resources');
    fileService.closeAllResources();
  });
}

export default fileService;