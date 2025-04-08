/**
 * File system module for the main process
 * Manages file references without copying files
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class FileSystem {
  constructor(appDataPath) {
    // Base directory for all app data
    this.appDataPath = appDataPath || path.join(process.cwd(), 'data');
    
    // Temporary directory for pending files (before project creation)
    this.tempDir = path.join(this.appDataPath, 'temp');
    
    // Current project reference
    this.currentProject = null;
    
    // Initialize paths
    this.initialize();
  }
  
  /**
   * Initialize directories
   */
  async initialize() {
    try {
      // Create app data directory if it doesn't exist
      await this.ensureDirectoryExists(this.appDataPath);
      
      // Create temp directory for pending files
      await this.ensureDirectoryExists(this.tempDir);
      
      // Create projects directory
      await this.ensureDirectoryExists(path.join(this.appDataPath, 'projects'));
      
      console.log('File system initialized:', this.appDataPath);
    } catch (error) {
      console.error('Error initializing file system:', error);
    }
  }
  
  /**
   * Ensure a directory exists, create if it doesn't
   * @param {string} dirPath - Directory path
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
  
  /**
   * Set current project
   * @param {string} projectId - Project ID
   */
  async setCurrentProject(projectId) {
    if (!projectId) {
      this.currentProject = null;
      return { success: true };
    }
    
    const projectPath = path.join(this.appDataPath, 'projects', projectId);
    
    try {
      // Check if project exists
      await fs.access(projectPath);
      this.currentProject = projectId;
      
      // Ensure files.json exists
      const filesJsonPath = path.join(projectPath, 'files.json');
      try {
        await fs.access(filesJsonPath);
      } catch {
        // Create empty files.json
        await fs.writeFile(
          filesJsonPath,
          JSON.stringify({ lastUpdated: new Date().toISOString(), files: [] }, null, 2)
        );
      }
      
      // Ensure project files directory exists
      await this.ensureDirectoryExists(path.join(projectPath, 'files'));
      
      return { success: true, projectId };
    } catch (error) {
      console.error(`Error setting current project ${projectId}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get current project path
   * @returns {string|null} Current project path or null if no project is set
   */
  getCurrentProjectPath() {
    if (!this.currentProject) {
      return null;
    }
    
    return path.join(this.appDataPath, 'projects', this.currentProject);
  }
  
  /**
   * Process a file for the current context
   * @param {string} filePath - Original file path
   * @param {string} content - File content (optional, for text files)
   * @param {boolean} isBinary - Whether the file is binary
   * @returns {Promise<Object>} Processing result
   */
  async processFileForContext(filePath, content = null, isBinary = false) {
    try {
      // Generate a unique ID for the file
      const fileId = crypto.randomUUID();
      
      // Create a file reference object
      const fileName = path.basename(filePath);
      const fileExt = path.extname(filePath).replace('.', '').toLowerCase();
      
      // Get file size
      const stats = await fs.stat(filePath);
      
      // Create file reference
      const fileRef = {
        id: fileId,
        name: fileName,
        originalPath: filePath,
        type: fileExt || 'txt',
        size: stats.size,
        isDirectory: stats.isDirectory(),
        description: `File: ${fileName}`,
        status: 'pending'
      };
      
      // If there's no current project, store in temporary registry
      if (!this.currentProject) {
        // Save to temp registry
        await this.addToTempRegistry(fileRef);
      } else {
        // Add to project's file registry
        await this.addToProjectRegistry(fileRef);
      }
      
      return { success: true, fileRef };
    } catch (error) {
      console.error('Error processing file:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Add a file to the temporary registry
   * @param {Object} fileRef - File reference object
   */
  async addToTempRegistry(fileRef) {
    const tempRegistryPath = path.join(this.tempDir, 'pending-files.json');
    
    try {
      // Read existing registry if it exists
      let registry = { files: [] };
      try {
        const content = await fs.readFile(tempRegistryPath, 'utf8');
        registry = JSON.parse(content);
      } catch {
        // File doesn't exist or isn't valid JSON, use default
      }
      
      // Add the new file
      registry.files.push(fileRef);
      registry.lastUpdated = new Date().toISOString();
      
      // Write back to file
      await fs.writeFile(
        tempRegistryPath,
        JSON.stringify(registry, null, 2)
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error adding to temp registry:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Add a file to the current project's registry
   * @param {Object} fileRef - File reference object
   */
  async addToProjectRegistry(fileRef) {
    if (!this.currentProject) {
      return { success: false, error: 'No current project' };
    }
    
    const projectPath = this.getCurrentProjectPath();
    const registryPath = path.join(projectPath, 'files.json');
    
    try {
      // Read existing registry
      let registry = { files: [] };
      try {
        const content = await fs.readFile(registryPath, 'utf8');
        registry = JSON.parse(content);
      } catch {
        // File doesn't exist or isn't valid JSON, use default
      }
      
      // Add the new file
      registry.files.push(fileRef);
      registry.lastUpdated = new Date().toISOString();
      
      // Write back to file
      await fs.writeFile(
        registryPath,
        JSON.stringify(registry, null, 2)
      );
      
      return { success: true };
    } catch (error) {
      console.error('Error adding to project registry:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get the current file registry
   * @returns {Promise<Object>} File registry object
   */
  async getFileRegistry() {
    // If no project is selected, get temporary registry
    if (!this.currentProject) {
      const tempRegistryPath = path.join(this.tempDir, 'pending-files.json');
      
      try {
        const content = await fs.readFile(tempRegistryPath, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        // Return empty registry if file doesn't exist
        return { lastUpdated: new Date().toISOString(), files: [] };
      }
    }
    
    // Get project registry
    const projectPath = this.getCurrentProjectPath();
    const registryPath = path.join(projectPath, 'files.json');
    
    try {
      const content = await fs.readFile(registryPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      // Return empty registry if file doesn't exist
      return { lastUpdated: new Date().toISOString(), files: [] };
    }
  }
  
  /**
   * Read a file from its original location
   * @param {string} fileId - File ID in the registry
   * @returns {Promise<Object>} File content
   */
  async readFile(fileId) {
    try {
      // Get file registry
      const registry = await this.getFileRegistry();
      
      // Find file in registry
      const fileRef = registry.files.find(f => f.id === fileId);
      if (!fileRef) {
        return { success: false, error: 'File not found in registry' };
      }
      
      // Read file content
      const content = await fs.readFile(fileRef.originalPath, 'utf8');
      
      return { success: true, content, fileRef };
    } catch (error) {
      console.error('Error reading file:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Update a file description
   * @param {string} fileId - File ID
   * @param {string} description - New description
   * @returns {Promise<Object>} Update result
   */
  async updateFileDescription(fileId, description) {
    try {
      // Get current registry
      const registry = await this.getFileRegistry();
      
      // Find file in registry
      const fileIndex = registry.files.findIndex(f => f.id === fileId);
      if (fileIndex === -1) {
        return { success: false, error: 'File not found in registry' };
      }
      
      // Update description
      registry.files[fileIndex].description = description;
      registry.lastUpdated = new Date().toISOString();
      
      // Save registry
      const registryPath = this.currentProject
        ? path.join(this.getCurrentProjectPath(), 'files.json')
        : path.join(this.tempDir, 'pending-files.json');
      
      await fs.writeFile(
        registryPath,
        JSON.stringify(registry, null, 2)
      );
      
      return { success: true, fileRef: registry.files[fileIndex] };
    } catch (error) {
      console.error('Error updating file description:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Save a large text paste as a file
   * @param {string} text - Text content
   * @param {string} projectId - Optional project ID (uses current if not provided)
   * @returns {Promise<Object>} Result with file reference
   */
  async saveTextPaste(text, projectId = null) {
    try {
      // Generate a unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `paste-${timestamp}.txt`;
      
      // Determine where to save the file
      let savePath;
      let targetProject = projectId || this.currentProject;
      
      if (targetProject) {
        const projectPath = path.join(this.appDataPath, 'projects', targetProject);
        savePath = path.join(projectPath, 'files', fileName);
        
        // Ensure files directory exists
        await this.ensureDirectoryExists(path.join(projectPath, 'files'));
      } else {
        savePath = path.join(this.tempDir, fileName);
      }
      
      // Write the file
      await fs.writeFile(savePath, text, 'utf8');
      
      // Create file reference
      const fileRef = {
        id: crypto.randomUUID(),
        name: fileName,
        originalPath: savePath,
        type: 'txt',
        size: text.length,
        isDirectory: false,
        description: 'Pasted text content',
        status: targetProject ? 'added' : 'pending'
      };
      
      // Add to registry
      if (targetProject) {
        await this.addToProjectRegistry(fileRef);
      } else {
        await this.addToTempRegistry(fileRef);
      }
      
      return { success: true, fileRef };
    } catch (error) {
      console.error('Error saving text paste:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Scan a directory and add all files to the registry
   * @param {string} dirPath - Directory path
   * @returns {Promise<Object>} Scan result
   */
  async scanDirectory(dirPath) {
    try {
      const results = [];
      const errors = [];
      
      // Recursive function to scan directory
      const scanDir = async (currentPath, relativePath = '') => {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const entryPath = path.join(currentPath, entry.name);
          const entryRelativePath = path.join(relativePath, entry.name);
          
          try {
            if (entry.isDirectory()) {
              // Recursively scan subdirectory
              await scanDir(entryPath, entryRelativePath);
            } else {
              // Process file
              const result = await this.processFileForContext(entryPath);
              if (result.success) {
                results.push(result.fileRef);
              } else {
                errors.push({
                  path: entryPath,
                  error: result.error
                });
              }
            }
          } catch (error) {
            errors.push({
              path: entryPath,
              error: error.message
            });
          }
        }
      };
      
      // Start scanning
      await scanDir(dirPath);
      
      return {
        success: true,
        processedFiles: results,
        errors: errors.length > 0 ? errors : null
      };
    } catch (error) {
      console.error('Error scanning directory:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Move pending files to a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Result of the operation
   */
  async movePendingFilesToProject(projectId) {
    try {
      // Check if project exists
      const projectPath = path.join(this.appDataPath, 'projects', projectId);
      await fs.access(projectPath);
      
      // Ensure project files directory exists
      const projectFilesDir = path.join(projectPath, 'files');
      await this.ensureDirectoryExists(projectFilesDir);
      
      // Get pending files
      const tempRegistryPath = path.join(this.tempDir, 'pending-files.json');
      let pendingRegistry;
      
      try {
        const content = await fs.readFile(tempRegistryPath, 'utf8');
        pendingRegistry = JSON.parse(content);
      } catch {
        // No pending files
        return { success: true, movedFiles: 0 };
      }
      
      if (!pendingRegistry.files || pendingRegistry.files.length === 0) {
        return { success: true, movedFiles: 0 };
      }
      
      // Get project registry
      const projectRegistryPath = path.join(projectPath, 'files.json');
      let projectRegistry;
      
      try {
        const content = await fs.readFile(projectRegistryPath, 'utf8');
        projectRegistry = JSON.parse(content);
      } catch {
        // Create new registry
        projectRegistry = { lastUpdated: new Date().toISOString(), files: [] };
      }
      
      // Process each pending file
      const movedFiles = [];
      
      for (const fileRef of pendingRegistry.files) {
        // For text files saved in temp, move them to project files directory
        if (fileRef.originalPath.startsWith(this.tempDir)) {
          const newPath = path.join(projectFilesDir, fileRef.name);
          
          // Read content and write to new location
          const content = await fs.readFile(fileRef.originalPath, 'utf8');
          await fs.writeFile(newPath, content, 'utf8');
          
          // Update file reference
          fileRef.originalPath = newPath;
          
          // Try to delete original file (non-critical if it fails)
          try {
            await fs.unlink(fileRef.originalPath);
          } catch {
            // Ignore errors when cleaning up
          }
        }
        
        // Update status
        fileRef.status = 'added';
        
        // Add to project registry
        projectRegistry.files.push(fileRef);
        movedFiles.push(fileRef);
      }
      
      // Update project registry
      projectRegistry.lastUpdated = new Date().toISOString();
      await fs.writeFile(
        projectRegistryPath,
        JSON.stringify(projectRegistry, null, 2)
      );
      
      // Clear pending registry
      await fs.writeFile(
        tempRegistryPath,
        JSON.stringify({ lastUpdated: new Date().toISOString(), files: [] }, null, 2)
      );
      
      return {
        success: true,
        movedFiles: movedFiles.length,
        files: movedFiles
      };
    } catch (error) {
      console.error('Error moving pending files to project:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Generate a placeholder description for a file
   * @param {string} fileName - File name
   * @param {string} fileType - File type
   * @returns {string} Placeholder description
   */
  generatePlaceholderDescription(fileName, fileType) {
    const ext = fileType.toLowerCase();
    
    // Default description based on file type
    if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') {
      return `JavaScript/TypeScript file: ${fileName}`;
    } else if (ext === 'css' || ext === 'scss' || ext === 'sass' || ext === 'less') {
      return `Stylesheet file: ${fileName}`;
    } else if (ext === 'html' || ext === 'htm') {
      return `HTML file: ${fileName}`;
    } else if (ext === 'json') {
      return `JSON data file: ${fileName}`;
    } else if (ext === 'md' || ext === 'markdown') {
      return `Markdown document: ${fileName}`;
    } else if (ext === 'py') {
      return `Python script: ${fileName}`;
    } else if (ext === 'cs') {
      return `C# source file: ${fileName}`;
    } else if (ext === 'java') {
      return `Java source file: ${fileName}`;
    } else if (ext === 'txt') {
      return `Text file: ${fileName}`;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
      return `Image file: ${fileName}`;
    } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
      return `Audio file: ${fileName}`;
    } else if (['mp4', 'webm', 'avi'].includes(ext)) {
      return `Video file: ${fileName}`;
    } else if (['pdf', 'doc', 'docx'].includes(ext)) {
      return `Document file: ${fileName}`;
    } else {
      return `File: ${fileName}`;
    }
  }
  
  /**
   * Check if a file is likely binary based on extension
   * @param {string} filePath - Path to the file
   * @returns {boolean} True if the file is likely binary
   */
  isLikelyBinaryFile(filePath) {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    const binaryExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'ico', 'svg',
      'mp3', 'wav', 'ogg', 'mp4', 'avi', 'mov', 'webm',
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
      'zip', 'rar', '7z', 'tar', 'gz',
      'ttf', 'otf', 'woff', 'woff2',
      'exe', 'dll', 'so', 'dylib'
    ];
    
    return binaryExtensions.includes(ext);
  }
  
  /**
   * Execute a file operation command
   * @param {Object} command - Command object
   * @returns {Promise<Object>} Command execution result
   */
  async executeCommand(command) {
    // Validate command structure
    if (!command || !command.command) {
      return { success: false, error: 'Invalid command structure' };
    }
    
    // Check if we have a current project
    if (!this.currentProject) {
      return { success: false, error: 'No current project set' };
    }
    
    // Get project path
    const projectPath = this.getCurrentProjectPath();
    const projectFilesDir = path.join(projectPath, 'files');
    
    // Ensure files directory exists
    await this.ensureDirectoryExists(projectFilesDir);
    
    // Execute command based on type
    switch (command.command) {
      case 'Create':
        return this.createFile(command, projectFilesDir);
      case 'Modify':
        return this.modifyFile(command);
      case 'Delete':
        return this.deleteFile(command);
      default:
        return { success: false, error: `Unknown command: ${command.command}` };
    }
  }
  
  /**
   * Create a file
   * @param {Object} command - Create command
   * @param {string} projectFilesDir - Project files directory
   * @returns {Promise<Object>} Command execution result
   */
  async createFile(command, projectFilesDir) {
    // Validate command
    if (!command.fileName || command.content === undefined) {
      return { success: false, error: 'Invalid create command: missing fileName or content' };
    }
    
    try {
      // Sanitize filename
      const safeFileName = this.sanitizeFileName(command.fileName);
      
      // Check if it's a nested path
      const dirPath = path.dirname(safeFileName);
      
      // If it's not in the root, ensure directory exists
      if (dirPath !== '.') {
        const fullDirPath = path.join(projectFilesDir, dirPath);
        await this.ensureDirectoryExists(fullDirPath);
      }
      
      // Full file path
      const filePath = path.join(projectFilesDir, safeFileName);
      
      // Write file
      await fs.writeFile(filePath, command.content, 'utf8');
      
      // Create file reference
      const fileRef = {
        id: crypto.randomUUID(),
        name: path.basename(safeFileName),
        originalPath: filePath,
        type: path.extname(safeFileName).replace('.', '').toLowerCase() || 'txt',
        size: command.content.length,
        isDirectory: false,
        description: command.description || this.generatePlaceholderDescription(
          path.basename(safeFileName),
          path.extname(safeFileName).replace('.', '').toLowerCase()
        ),
        status: 'added'
      };
      
      // Add to project registry
      await this.addToProjectRegistry(fileRef);
      
      return { success: true, fileRef };
    } catch (error) {
      console.error('Error creating file:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Modify a file
   * @param {Object} command - Modify command
   * @returns {Promise<Object>} Command execution result
   */
  async modifyFile(command) {
    // Validate command
    if (!command.fileName || !command.newContent) {
      return { success: false, error: 'Invalid modify command: missing fileName or newContent' };
    }
    
    try {
      // Get file registry
      const registry = await this.getFileRegistry();
      
      // Find file by name (can be path or just filename)
      let fileRef = null;
      const fileName = path.basename(command.fileName);
      
      // Try to find exact match first
      fileRef = registry.files.find(f => f.name === command.fileName || f.originalPath.endsWith(command.fileName));
      
      if (!fileRef) {
        // Fallback to just matching the basename
        fileRef = registry.files.find(f => path.basename(f.originalPath) === fileName);
      }
      
      if (!fileRef) {
        // File not found in registry, check if it exists in the project files
        const projectFilesDir = path.join(this.getCurrentProjectPath(), 'files');
        const potentialPath = path.join(projectFilesDir, this.sanitizeFileName(command.fileName));
        
        try {
          await fs.access(potentialPath);
          
          // File exists but not in registry, create entry
          fileRef = {
            id: crypto.randomUUID(),
            name: fileName,
            originalPath: potentialPath,
            type: path.extname(potentialPath).replace('.', '').toLowerCase() || 'txt',
            isDirectory: false,
            description: this.generatePlaceholderDescription(
              fileName,
              path.extname(potentialPath).replace('.', '').toLowerCase()
            ),
            status: 'added'
          };
          
          // Read current content to determine size
          const currentContent = await fs.readFile(potentialPath, 'utf8');
          fileRef.size = currentContent.length;
        } catch {
          // File doesn't exist
          return { success: false, error: `File not found: ${command.fileName}` };
        }
      }
      
      // Read current content
      let content;
      try {
        content = await fs.readFile(fileRef.originalPath, 'utf8');
      } catch (error) {
        return { success: false, error: `Error reading file: ${error.message}` };
      }
      
      // Determine how to modify the content
      let newContent;
      
      if (command.oldContent) {
        // Replace specific content
        if (content.includes(command.oldContent)) {
          newContent = content.replace(command.oldContent, command.newContent);
        } else {
          return { success: false, error: 'oldContent not found in file' };
        }
      } else {
        // Replace the entire content
        newContent = command.newContent;
      }
      
      // Write the updated content
      await fs.writeFile(fileRef.originalPath, newContent, 'utf8');
      
      // Update file size in registry
      fileRef.size = newContent.length;
      await this.updateFileInRegistry(fileRef);
      
      return { success: true, fileRef };
    } catch (error) {
      console.error('Error modifying file:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Delete a file
   * @param {Object} command - Delete command
   * @returns {Promise<Object>} Command execution result
   */
  async deleteFile(command) {
    // Validate command
    if (!command.fileName) {
      return { success: false, error: 'Invalid delete command: missing fileName' };
    }
    
    try {
      // Get file registry
      const registry = await this.getFileRegistry();
      
      // Find file by name or path
      const fileName = path.basename(command.fileName);
      let fileRef = registry.files.find(f => 
        f.name === command.fileName || 
        path.basename(f.originalPath) === fileName || 
        f.originalPath.endsWith(command.fileName)
      );
      
      if (!fileRef) {
        // File not found in registry, check if it exists in project files
        const projectFilesDir = path.join(this.getCurrentProjectPath(), 'files');
        const potentialPath = path.join(projectFilesDir, this.sanitizeFileName(command.fileName));
        
        try {
          await fs.access(potentialPath);
          fileRef = { originalPath: potentialPath, id: null };
        } catch {
          return { success: false, error: `File not found: ${command.fileName}` };
        }
      }
      
      // Delete the file
      await fs.unlink(fileRef.originalPath);
      
      // If file was in registry, remove it
      if (fileRef.id) {
        await this.removeFileFromRegistry(fileRef.id);
      }
      
      return { success: true, deleted: command.fileName };
    } catch (error) {
      console.error('Error deleting file:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Update a file in the registry
   * @param {Object} fileRef - File reference
   * @returns {Promise<Object>} Update result
   */
  async updateFileInRegistry(fileRef) {
    const registry = await this.getFileRegistry();
    const fileIndex = registry.files.findIndex(f => f.id === fileRef.id);
    
    if (fileIndex !== -1) {
      registry.files[fileIndex] = fileRef;
      registry.lastUpdated = new Date().toISOString();
      
      const registryPath = path.join(this.getCurrentProjectPath(), 'files.json');
      await fs.writeFile(
        registryPath,
        JSON.stringify(registry, null, 2)
      );
      
      return { success: true };
    } else {
      return { success: false, error: 'File not found in registry' };
    }
  }
  
  /**
   * Remove a file from the registry
   * @param {string} fileId - File ID
   * @returns {Promise<Object>} Removal result
   */
  async removeFileFromRegistry(fileId) {
    const registry = await this.getFileRegistry();
    const fileIndex = registry.files.findIndex(f => f.id === fileId);
    
    if (fileIndex !== -1) {
      registry.files.splice(fileIndex, 1);
      registry.lastUpdated = new Date().toISOString();
      
      const registryPath = path.join(this.getCurrentProjectPath(), 'files.json');
      await fs.writeFile(
        registryPath,
        JSON.stringify(registry, null, 2)
      );
      
      return { success: true };
    } else {
      return { success: false, error: 'File not found in registry' };
    }
  }
  
  /**
   * Sanitize a filename to ensure it's safe to use
   * @param {string} fileName - Original filename
   * @returns {string} Sanitized filename
   */
  sanitizeFileName(fileName) {
    // Replace any path traversal attempts
    return fileName.replace(/\.\.\//g, '').replace(/\.\./g, '');
  }
}

/**
 * Clean up temporary files and registry
 * @returns {Promise<Object>} Cleanup result
 */
async function cleanupTempFiles() {
  try {
    // Get temporary registry
    const tempRegistryPath = path.join(this.tempDir, 'pending-files.json');
    let registry;
    
    try {
      const content = await fs.readFile(tempRegistryPath, 'utf8');
      registry = JSON.parse(content);
    } catch (error) {
      // If no registry exists, nothing to delete
      return { success: true, deletedCount: 0 };
    }
    
    // Check if we have files to delete
    if (!registry.files || registry.files.length === 0) {
      return { success: true, deletedCount: 0 };
    }
    
    // Count files deleted
    let deletedCount = 0;
    
    // Process each file in the registry
    for (const fileRef of registry.files) {
      // Only delete files that are in the temp directory
      if (fileRef.originalPath.startsWith(this.tempDir)) {
        try {
          // Check if file exists
          await fs.access(fileRef.originalPath);
          
          // Delete the file
          await fs.unlink(fileRef.originalPath);
          deletedCount++;
        } catch (error) {
          // File might not exist, just continue
          console.warn(`Could not delete temporary file ${fileRef.originalPath}: ${error.message}`);
        }
      }
    }
    
    // Clear the registry
    await fs.writeFile(
      tempRegistryPath,
      JSON.stringify({ lastUpdated: new Date().toISOString(), files: [] }, null, 2)
    );
    
    return {
      success: true,
      deletedCount
    };
  } catch (error) {
    console.error('Error cleaning up temporary files:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Add this method to the FileSystem class
FileSystem.prototype.cleanupTempFiles = cleanupTempFiles;

module.exports = FileSystem;