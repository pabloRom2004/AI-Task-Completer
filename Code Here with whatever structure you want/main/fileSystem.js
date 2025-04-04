const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const { shell, app } = require('electron');

// Store the current project directory
let projectDirectory = null;
let projectsDirectory = path.join(app.getPath('userData'), 'projects');
// Track if we're in first message mode (defer file processing)
let isFirstMessage = true;
// Queue for staged files in first message
let stagedFiles = [];

// Constants for file management
const FILE_REGISTRY_NAME = 'file_registry.json';

/**
 * Initialize projects directory
 */
async function initializeProjectsDirectory() {
  try {
    await fsPromises.mkdir(projectsDirectory, { recursive: true });
    console.log('Projects directory initialized:', projectsDirectory);
    return true;
  } catch (error) {
    console.error('Error initializing projects directory:', error);
    return false;
  }
}

/**
 * List all available projects
 * @returns {Promise<Object>} Result with list of projects
 */
async function listProjects() {
  try {
    await initializeProjectsDirectory();
    
    const entries = await fsPromises.readdir(projectsDirectory, { withFileTypes: true });
    const projects = [];
    
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const projectPath = path.join(projectsDirectory, entry.name);
        
        // Get creation date
        const stats = await fsPromises.stat(projectPath);
        const createdDate = stats.birthtime;
        
        // Check if project has a title
        let title = entry.name;
        try {
          const metadataPath = path.join(projectPath, 'metadata.json');
          if (await fileExists(metadataPath)) {
            const metadata = JSON.parse(await fsPromises.readFile(metadataPath, 'utf8'));
            if (metadata.title) {
              title = metadata.title;
            }
          }
        } catch (error) {
          console.error(`Error reading project metadata for ${entry.name}:`, error);
        }
        
        projects.push({
          name: entry.name,
          path: projectPath,
          title: title,
          createdDate: createdDate
        });
      }
    }
    
    // Sort projects by creation date (newest first)
    projects.sort((a, b) => b.createdDate - a.createdDate);
    
    return { success: true, projects };
  } catch (error) {
    console.error('Error listing projects:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new project
 * @param {string} projectName - Name of the project
 * @param {string} title - AI generated title for the project (optional)
 * @returns {Promise<Object>} Result with project info
 */
async function createProject(projectName, title = '') {
  try {
    await initializeProjectsDirectory();
    
    // Sanitize project name to be folder-friendly
    const sanitizedName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    // Generate a unique name if it already exists
    let uniqueName = sanitizedName;
    let counter = 1;
    while (await directoryExists(path.join(projectsDirectory, uniqueName))) {
      uniqueName = `${sanitizedName}_${counter}`;
      counter++;
    }
    
    const projectPath = path.join(projectsDirectory, uniqueName);
    
    // Create project directory
    await fsPromises.mkdir(projectPath, { recursive: true });
    
    // Create metadata file
    const metadata = {
      name: uniqueName,
      title: title || uniqueName,
      createdDate: new Date().toISOString()
    };
    
    await fsPromises.writeFile(
      path.join(projectPath, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );
    
    // Create empty file registry
    const fileRegistry = {
      files: [],
      lastUpdated: new Date().toISOString()
    };
    
    await fsPromises.writeFile(
      path.join(projectPath, FILE_REGISTRY_NAME),
      JSON.stringify(fileRegistry, null, 2),
      'utf8'
    );
    
    // Set as current project
    projectDirectory = projectPath;
    
    // No longer in first message mode
    isFirstMessage = false;
    
    // Process any staged files
    if (stagedFiles.length > 0) {
      for (const file of stagedFiles) {
        await processFileForContext(file.path, file.content);
      }
      stagedFiles = []; // Clear the queue
    }
    
    return { 
      success: true, 
      project: {
        name: uniqueName,
        path: projectPath,
        title: title || uniqueName
      }
    };
  } catch (error) {
    console.error('Error creating project:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Select a project to work with
 * @param {string} projectName - Name of the project
 * @returns {Promise<Object>} Result with project info
 */
async function selectProject(projectName) {
  try {
    const projectPath = path.join(projectsDirectory, projectName);
    
    if (!await directoryExists(projectPath)) {
      return { success: false, error: 'Project does not exist' };
    }
    
    // Set as current project
    projectDirectory = projectPath;
    
    // Reset first message flag since we're using an existing project
    isFirstMessage = false;
    
    // Try to read metadata
    let title = projectName;
    try {
      const metadataPath = path.join(projectPath, 'metadata.json');
      if (await fileExists(metadataPath)) {
        const metadata = JSON.parse(await fsPromises.readFile(metadataPath, 'utf8'));
        if (metadata.title) {
          title = metadata.title;
        }
      }
    } catch (error) {
      console.error(`Error reading project metadata for ${projectName}:`, error);
    }
    
    return { 
      success: true, 
      project: {
        name: projectName,
        path: projectPath,
        title: title
      }
    };
  } catch (error) {
    console.error('Error selecting project:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a project
 * @param {string} projectName - Name of the project
 * @returns {Promise<Object>} Result with success status
 */
async function deleteProject(projectName) {
  try {
    const projectPath = path.join(projectsDirectory, projectName);
    
    if (!await directoryExists(projectPath)) {
      return { success: false, error: 'Project does not exist' };
    }
    
    // Check if it's the current project
    if (projectDirectory === projectPath) {
      projectDirectory = null;
      // Reset first message flag since we'll need a new project
      isFirstMessage = true;
    }
    
    // Delete the project directory
    await fsPromises.rm(projectPath, { recursive: true, force: true });
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting project:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Sets the current project directory
 * @param {string} directory - Directory path
 * @returns {string} The set directory path
 */
function setProjectDirectory(directory) {
  projectDirectory = directory;
  return projectDirectory;
}

/**
 * Gets the current project directory
 * @returns {string} The current project directory
 */
function getProjectDirectory() {
  return projectDirectory;
}

/**
 * Get and optionally load the project's file registry
 * @returns {Promise<Object>} The file registry
 */
async function getFileRegistry() {
  if (!projectDirectory) {
    return { files: [] };
  }
  
  const registryPath = path.join(projectDirectory, FILE_REGISTRY_NAME);
  
  try {
    if (await fileExists(registryPath)) {
      const content = await fsPromises.readFile(registryPath, 'utf8');
      return JSON.parse(content);
    } else {
      // Create empty registry if it doesn't exist
      const emptyRegistry = { 
        files: [],
        lastUpdated: new Date().toISOString()
      };
      
      await fsPromises.writeFile(
        registryPath,
        JSON.stringify(emptyRegistry, null, 2),
        'utf8'
      );
      
      return emptyRegistry;
    }
  } catch (error) {
    console.error('Error getting file registry:', error);
    return { files: [] };
  }
}

/**
 * Save the file registry
 * @param {Object} registry - The file registry to save
 * @returns {Promise<boolean>} Success status
 */
async function saveFileRegistry(registry) {
  if (!projectDirectory) {
    return false;
  }
  
  try {
    const registryPath = path.join(projectDirectory, FILE_REGISTRY_NAME);
    
    // Update the last updated timestamp
    registry.lastUpdated = new Date().toISOString();
    
    await fsPromises.writeFile(
      registryPath, 
      JSON.stringify(registry, null, 2),
      'utf8'
    );
    
    return true;
  } catch (error) {
    console.error('Error saving file registry:', error);
    return false;
  }
}

/**
 * Recursively scans a directory and returns its structure
 * @param {string} dirPath - Directory to scan
 * @param {string} basePath - Base path for relative paths
 * @returns {Array} Directory structure
 */
async function scanDirectoryRecursive(dirPath, basePath = '') {
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    
    const result = [];
    
    for (const entry of entries) {
      // Skip hidden files and directories (starting with .)
      if (entry.name.startsWith('.')) {
        continue;
      }
      
      const relativePath = path.join(basePath, entry.name);
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        const children = await scanDirectoryRecursive(fullPath, relativePath);
        result.push({
          name: entry.name,
          path: relativePath,
          fullPath: fullPath,
          type: 'directory',
          children
        });
      } else {
        result.push({
          name: entry.name,
          path: relativePath,
          fullPath: fullPath,
          type: 'file'
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
    return [];
  }
}

/**
 * Scans the current project directory
 * @returns {Array} Directory structure
 */
async function scanDirectory() {
  if (!projectDirectory) {
    return [];
  }
  
  try {
    return await scanDirectoryRecursive(projectDirectory);
  } catch (error) {
    console.error('Error scanning directory:', error);
    return [];
  }
}

/**
 * Generate a file description placeholder - will be replaced by real description later
 * @param {string} fileName - Name of the file
 * @param {string} content - Content of the file
 * @returns {string} A placeholder description
 */
function generatePlaceholderDescription(fileName, content) {
  const extension = path.extname(fileName).toLowerCase();
  const sizeInKB = Math.round((content.length / 1024) * 100) / 100;
  
  // Default placeholder based on file type
  switch (extension) {
    case '.js':
      return `JavaScript file (${sizeInKB}KB) - Contains code for application functionality`;
    case '.html':
      return `HTML file (${sizeInKB}KB) - Defines structure for web content`;
    case '.css':
      return `CSS file (${sizeInKB}KB) - Contains styling information`;
    case '.json':
      return `JSON file (${sizeInKB}KB) - Contains structured data`;
    case '.md':
      return `Markdown file (${sizeInKB}KB) - Contains formatted documentation`;
    case '.txt':
      return `Text file (${sizeInKB}KB) - Contains plain text information`;
    default:
      return `File with ${extension} extension (${sizeInKB}KB) - Will be summarized by AI`;
  }
}

/**
 * Process a file for context - either stage it or add it immediately
 * @param {string} filePath - Path to the file
 * @param {string} content - File content (optional)
 * @returns {Promise<Object>} Result with success status
 */
async function processFileForContext(filePath, content = null) {
  try {
    // If content not provided, try to read it
    if (!content) {
      try {
        content = await fsPromises.readFile(filePath, 'utf8');
      } catch (error) {
        return { success: false, error: `Could not read file: ${error.message}` };
      }
    }
    
    // If we're in first message mode, stage the file
    if (isFirstMessage) {
      stagedFiles.push({
        path: filePath,
        content: content
      });
      
      return { success: true, staged: true };
    }
    
    // If we have a project, process immediately
    if (!projectDirectory) {
      return { success: false, error: 'No active project to add file to' };
    }
    
    // Get the registry
    const registry = await getFileRegistry();
    
    // Check if file already exists in registry
    const fileName = path.basename(filePath);
    const existingFileIndex = registry.files.findIndex(f => 
      f.originalPath === filePath || f.name === fileName
    );
    
    // Get file stats
    let stats;
    try {
      stats = await fsPromises.stat(filePath);
    } catch (error) {
      // If we can't get stats (e.g., file was created in memory), use content length
      stats = {
        size: content.length,
        mtimeMs: Date.now(),
        birthtime: new Date()
      };
    }
    
    // Create file record
    const fileRecord = {
      name: fileName,
      originalPath: filePath,
      relativePath: fileName,
      addedDate: new Date().toISOString(),
      lastModified: new Date(stats.mtimeMs).toISOString(),
      size: stats.size,
      extension: path.extname(filePath),
      description: generatePlaceholderDescription(fileName, content)
    };
    
    // Add or update file in registry
    if (existingFileIndex >= 0) {
      registry.files[existingFileIndex] = fileRecord;
    } else {
      registry.files.push(fileRecord);
    }
    
    // Save registry
    await saveFileRegistry(registry);
    
    return { success: true, file: fileRecord };
  } catch (error) {
    console.error('Error processing file for context:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a file description in the registry
 * @param {string} filePath - Path to the file
 * @param {string} description - The description to set
 * @returns {Promise<Object>} Result with success status
 */
async function updateFileDescription(filePath, description) {
  if (!projectDirectory) {
    return { success: false, error: 'Project directory not set' };
  }
  
  try {
    const registry = await getFileRegistry();
    
    const fileName = path.basename(filePath);
    const fileIndex = registry.files.findIndex(f => 
      f.originalPath === filePath || f.name === fileName
    );
    
    if (fileIndex < 0) {
      return { success: false, error: 'File not found in registry' };
    }
    
    registry.files[fileIndex].description = description;
    
    await saveFileRegistry(registry);
    
    return { success: true };
  } catch (error) {
    console.error('Error updating file description:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Creates a new file in the project directory
 * @param {string} fileName - Name of the file to create, relative to project dir
 * @param {string} content - Content to write to the file
 * @returns {Object} Result object
 */
async function createFile(fileName, content) {
  if (!projectDirectory) {
    return { success: false, error: 'Project directory not set' };
  }
  
  try {
    const filePath = path.join(projectDirectory, fileName);
    
    // Create directories if they don't exist
    await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
    
    // Write file
    await fsPromises.writeFile(filePath, content);
    
    // Process file for context
    await processFileForContext(filePath, content);
    
    return { success: true, path: fileName };
  } catch (error) {
    console.error(`Error creating file ${fileName}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Reads a file, either from the project directory or its original location
 * @param {string} filePath - Path to the file, relative to project directory
 * @returns {Object} Result object with file content
 */
async function readFile(filePath) {
  try {
    // First, check if it's a project file
    if (projectDirectory) {
      const projectFilePath = path.join(projectDirectory, filePath);
      if (await fileExists(projectFilePath)) {
        const content = await fsPromises.readFile(projectFilePath, 'utf8');
        return { success: true, content };
      }
      
      // If not found in project, check registry for original path
      const registry = await getFileRegistry();
      const fileEntry = registry.files.find(f => f.relativePath === filePath || f.name === path.basename(filePath));
      
      if (fileEntry && fileEntry.originalPath) {
        try {
          const content = await fsPromises.readFile(fileEntry.originalPath, 'utf8');
          return { success: true, content };
        } catch (error) {
          // Fall through to try other methods if original path fails
        }
      }
    }
    
    // If not found in project or registry, try as absolute path or relative to cwd
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    
    if (await fileExists(fullPath)) {
      const content = await fsPromises.readFile(fullPath, 'utf8');
      return { success: true, content };
    }
    
    return { success: false, error: 'File not found' };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a file from the project directory
 * @param {string} filePath - Path to the file, can be absolute or relative
 * @returns {Object} Result object
 */
async function deleteFile(filePath) {
  if (!projectDirectory) {
    return { success: false, error: 'Project directory not set' };
  }
  
  try {
    // Check if file is in project directory
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(projectDirectory, filePath);
    
    // Remove from registry
    const registry = await getFileRegistry();
    const fileName = path.basename(filePath);
    
    registry.files = registry.files.filter(f => 
      f.originalPath !== filePath && 
      f.relativePath !== filePath && 
      f.name !== fileName
    );
    
    await saveFileRegistry(registry);
    
    // Delete file if it exists in project directory
    if (await fileExists(fullPath)) {
      await fsPromises.unlink(fullPath);
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Opens a file or folder in the native file explorer
 * @param {string} filePath - Path to the file/folder
 * @returns {Object} Result object
 */
async function openInFileExplorer(filePath) {
  try {
    let pathToOpen = filePath;
    
    // Check if it's a file in the registry
    if (projectDirectory) {
      const registry = await getFileRegistry();
      const fileEntry = registry.files.find(f => 
        f.relativePath === filePath || 
        f.name === path.basename(filePath)
      );
      
      if (fileEntry && fileEntry.originalPath) {
        pathToOpen = fileEntry.originalPath;
      } else {
        // Check if it's in the project directory
        const projectFilePath = path.join(projectDirectory, filePath);
        if (await fileExists(projectFilePath)) {
          pathToOpen = projectFilePath;
        }
      }
    }
    
    // Make sure we have an absolute path
    if (!path.isAbsolute(pathToOpen)) {
      pathToOpen = path.resolve(pathToOpen);
    }
    
    await shell.showItemInFolder(pathToOpen);
    return { success: true };
  } catch (error) {
    console.error(`Error opening file in explorer ${filePath}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * List all files in the project's registry
 * @returns {Promise<Object>} List of files with success status
 */
async function listFiles() {
  try {
    if (!projectDirectory) {
      return { success: false, error: 'Project directory not set' };
    }
    
    const registry = await getFileRegistry();
    
    // Also scan the project directory for files not in registry
    const files = [];
    await traverseDirectory(projectDirectory, files);
    
    // Add scanned files not already in registry
    for (const file of files) {
      const existingFile = registry.files.find(f => 
        f.relativePath === file.relativePath || 
        f.name === file.name
      );
      
      if (!existingFile) {
        try {
          await processFileForContext(file.path);
        } catch (error) {
          console.error(`Error processing scanned file ${file.path}:`, error);
        }
      }
    }
    
    // Reload registry after possible changes
    const updatedRegistry = await getFileRegistry();
    
    return { 
      success: true, 
      files: updatedRegistry.files.map(file => ({
        name: file.name,
        path: file.originalPath,
        relativePath: file.relativePath,
        description: file.description
      }))
    };
  } catch (error) {
    console.error('Error listing files:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Recursively traverse a directory and collect file information
 * @param {string} dir - Directory to traverse
 * @param {Array} files - Array to collect files
 */
async function traverseDirectory(dir, files) {
  try {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip hidden files and directories (starting with .)
      if (entry.name.startsWith('.')) {
        continue;
      }
      
      if (entry.isDirectory()) {
        await traverseDirectory(fullPath, files);
      } else {
        files.push({
          name: entry.name,
          path: fullPath,
          relativePath: path.relative(projectDirectory, fullPath)
        });
      }
    }
  } catch (error) {
    console.error(`Error traversing directory ${dir}:`, error);
  }
}

/**
 * Save file content to the project directory
 * @param {string} fileName - Name of the file, relative to project dir
 * @param {string|Buffer} content - Content to write
 * @returns {Promise<Object>} Result with success status
 */
async function saveFile(fileName, content) {
  try {
    if (!projectDirectory) {
      return { success: false, error: 'Project directory not set' };
    }
    
    const filePath = path.join(projectDirectory, fileName);
    
    // Create directories if needed
    const dir = path.dirname(filePath);
    await fsPromises.mkdir(dir, { recursive: true });
    
    // Write file content
    await fsPromises.writeFile(filePath, content);
    
    // Process file for context
    await processFileForContext(filePath, content);
    
    return { success: true, path: filePath, relativePath: fileName };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a directory exists
 * @param {string} dirPath - Path to check
 * @returns {Promise<boolean>} True if directory exists
 */
async function directoryExists(dirPath) {
  try {
    const stats = await fsPromises.stat(dirPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Check if a file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    const stats = await fsPromises.stat(filePath);
    return stats.isFile();
  } catch (error) {
    return false;
  }
}

/**
 * First message was sent - process any staged files and create project
 * @param {string} projectName - Name of the project
 * @param {string} title - Title for the project
 * @returns {Promise<Object>} Result with project info
 */
async function finalizeFirstMessage(projectName, title) {
  // Create the project
  const result = await createProject(projectName, title);
  
  // The createProject function will automatically process staged files
  return result;
}

/**
 * Reset first message state (useful for app reset)
 */
function resetFirstMessageState() {
  isFirstMessage = true;
  stagedFiles = [];
}

/**
 * Update project metadata
 * @param {string} projectName - Name of the project
 * @param {Object} updates - Properties to update
 * @returns {Promise<Object>} Result with success status
 */
async function updateProjectMetadata(projectName, updates) {
  try {
    const projectPath = path.join(projectsDirectory, projectName);
    
    if (!await directoryExists(projectPath)) {
      return { success: false, error: 'Project does not exist' };
    }
    
    const metadataPath = path.join(projectPath, 'metadata.json');
    let metadata = {
      name: projectName,
      createdDate: new Date().toISOString()
    };
    
    // Read existing metadata if it exists
    if (await fileExists(metadataPath)) {
      try {
        const data = await fsPromises.readFile(metadataPath, 'utf8');
        const existingMetadata = JSON.parse(data);
        metadata = { ...existingMetadata };
      } catch (e) {
        console.error(`Error reading metadata for ${projectName}:`, e);
      }
    }
    
    // Apply updates
    metadata = { ...metadata, ...updates };
    
    // Write updated metadata
    await fsPromises.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      'utf8'
    );
    
    return { success: true, metadata };
  } catch (error) {
    console.error('Error updating project metadata:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  setProjectDirectory,
  getProjectDirectory,
  scanDirectory,
  createFile,
  readFile,
  deleteFile,
  openInFileExplorer,
  listFiles,
  saveFile,
  initializeProjectsDirectory,
  listProjects,
  createProject,
  selectProject,
  deleteProject,
  updateProjectMetadata,
  processFileForContext,
  finalizeFirstMessage,
  resetFirstMessageState,
  updateFileDescription,
  getFileRegistry
};