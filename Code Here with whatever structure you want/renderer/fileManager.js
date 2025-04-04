// src/renderer/fileManager.js

// Initialize the file manager
export function initializeFileManager() {
  createFileSidebar();
  setupFileSidebar();
  setupDragAndDrop();
  setupPasteHandler();
  setupFolderUpload();
  loadFiles();
}

function createFileSidebar() {
  // Check if it already exists
  if (document.getElementById('fileSidebar')) {
    return;
  }
  
  // Just set up event listeners for existing sidebar elements
  setupFileSidebar();
}

// Setup the file sidebar functionality
function setupFileSidebar() {
  const sidebar = document.getElementById('fileSidebar');
  const toggleButton = document.getElementById('toggleFileSidebar');
  const closeButton = document.getElementById('closeSidebar');
  const fileUploadButton = document.getElementById('fileUploadButton');
  const fileInput = document.getElementById('fileInput');
  
  if (!sidebar || !toggleButton || !closeButton || !fileUploadButton || !fileInput) {
    console.error('File sidebar elements not found');
    return;
  }
  
  // Toggle sidebar visibility
  toggleButton.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
  
  // Close sidebar
  closeButton.addEventListener('click', () => {
    sidebar.classList.remove('open');
  });
  
  // Handle file selection
  fileUploadButton.addEventListener('click', () => {
    fileInput.click();
  });
  
  // Handle file input change
  fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
    fileInput.value = ''; // Reset to allow uploading the same file again
  });
}

// Setup folder upload functionality
function setupFolderUpload() {
  const folderUploadButton = document.getElementById('folderUploadButton');
  const folderInput = document.getElementById('folderInput');
  
  if (!folderUploadButton || !folderInput) {
    // This is expected in some cases, so don't show an error
    return;
  }
  
  folderUploadButton.addEventListener('click', () => {
    folderInput.click();
  });
  
  folderInput.addEventListener('change', async (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      // Get the base folder name from the first file
      const firstFilePath = files[0].webkitRelativePath;
      const baseFolderName = firstFilePath.split('/')[0];
      
      showFolderUploadProgress(baseFolderName, files.length);
      
      try {
        // This will extract all files from the FileList and send to main process
        const fileArray = Array.from(files);
        await handleFolderUpload(fileArray, baseFolderName);
      } catch (error) {
        console.error('Error uploading folder:', error);
        showFolderUploadError(baseFolderName, error.message);
      }
    }
    folderInput.value = ''; // Reset to allow uploading the same folder again
  });
}

// Show folder upload progress
function showFolderUploadProgress(folderName, fileCount) {
  const fileList = document.getElementById('fileList');
  if (!fileList) return;
  
  const progressElement = document.createElement('div');
  progressElement.id = 'folder-upload-progress';
  progressElement.className = 'folder-upload-progress';
  progressElement.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="folder-upload-info">
      <strong>Uploading folder: ${folderName}</strong>
      <div class="upload-status">Processing ${fileCount} files...</div>
    </div>
  `;
  
  fileList.insertBefore(progressElement, fileList.firstChild);
}

// Show folder upload error
function showFolderUploadError(folderName, errorMessage) {
  const progressElement = document.getElementById('folder-upload-progress');
  if (!progressElement) return;
  
  progressElement.className = 'folder-upload-error';
  progressElement.innerHTML = `
    <div class="error-icon">⚠️</div>
    <div class="folder-upload-info">
      <strong>Failed to upload: ${folderName}</strong>
      <div class="upload-status error">${errorMessage}</div>
    </div>
    <button class="close-error">×</button>
  `;
  
  const closeButton = progressElement.querySelector('.close-error');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      progressElement.remove();
    });
  }
}

// Handle folder upload
async function handleFolderUpload(files, baseFolderName) {
  // Need to organize files by their paths and create directory structure
  const filesByPath = {};
  
  // Group files by their directory
  for (const file of files) {
    const relativePath = file.webkitRelativePath;
    filesByPath[relativePath] = file;
  }
  
  // Process and upload all files
  const processedFiles = [];
  
  for (const relativePath in filesByPath) {
    const file = filesByPath[relativePath];
    
    try {
      // Read file content
      let content;
      if (isBinaryFile(file.name)) {
        const buffer = await readFileAsArrayBuffer(file);
        content = `[Binary file: ${file.size} bytes]`;
      } else {
        content = await readFileAsText(file);
      }
      
      // Process file for context instead of directly saving
      const result = await window.electronAPI.processFileForContext(relativePath, content);
      
      if (result.success) {
        processedFiles.push({
          name: file.name,
          relativePath: relativePath
        });
      }
    } catch (error) {
      console.error(`Error processing file ${relativePath}:`, error);
    }
  }
  
  // Update progress indicator
  const progressElement = document.getElementById('folder-upload-progress');
  if (progressElement) {
    progressElement.className = 'folder-upload-success';
    progressElement.innerHTML = `
      <div class="success-icon">✓</div>
      <div class="folder-upload-info">
        <strong>Uploaded folder: ${baseFolderName}</strong>
        <div class="upload-status success">Processed ${processedFiles.length} files</div>
      </div>
      <button class="close-success">×</button>
    `;
    
    const closeButton = progressElement.querySelector('.close-success');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        progressElement.remove();
      });
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (progressElement.parentNode) {
        progressElement.remove();
      }
    }, 5000);
  }
  
  // Refresh file list
  await loadFiles();
}

// Setup drag and drop functionality
function setupDragAndDrop() {
  const fileUploadArea = document.getElementById('fileUploadArea');
  const sidebar = document.getElementById('fileSidebar');
  
  if (!fileUploadArea || !sidebar) {
    console.error('Drag and drop elements not found');
    return;
  }
  
  // Create overlay for full window drag and drop if it doesn't exist
  if (!document.getElementById('dragDropOverlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'dragDropOverlay';
    document.body.appendChild(overlay);
  }
  
  const overlay = document.getElementById('dragDropOverlay');
  
  // File upload area drag events
  fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileUploadArea.classList.add('drag-over');
  });
  
  fileUploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileUploadArea.classList.remove('drag-over');
  });
  
  fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileUploadArea.classList.remove('drag-over');
    overlay.style.display = 'none';
    
    // Handle dropped files or folders
    if (e.dataTransfer.items) {
      const items = e.dataTransfer.items;
      
      // Check if items contain folders
      let hasFolder = false;
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry();
        if (item && item.isDirectory) {
          hasFolder = true;
          handleDroppedFolder(item);
          break;
        }
      }
      
      // If no folders, process as files
      if (!hasFolder && e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files);
      }
    } else if (e.dataTransfer.files.length > 0) {
      // Fallback for browsers that don't support items
      handleFileUpload(e.dataTransfer.files);
    }
  });
  
  // Window drag events
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    overlay.style.display = 'block';
    sidebar.classList.add('open');
  });
  
  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (e.clientX <= 0 || e.clientY <= 0 || 
        e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      overlay.style.display = 'none';
    }
  });
  
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    overlay.style.display = 'none';
    
    // This is handled by the fileUploadArea drop event
    // If dropped outside, still open sidebar
    sidebar.classList.add('open');
  });
}

// Handle dropped folder using the FileSystem API
async function handleDroppedFolder(folderEntry) {
  const files = [];
  const baseFolderName = folderEntry.name;
  
  // Show progress indicator
  showFolderUploadProgress(baseFolderName, 0);
  
  try {
    // Recursively process the folder
    await processDirectoryEntry(folderEntry, '', files);
    
    // Update progress indicator with file count
    const progressElement2 = document.getElementById('folder-upload-progress');
    if (progressElement2) {
      const statusElement = progressElement2.querySelector('.upload-status');
      if (statusElement) {
        statusElement.textContent = `Processing ${files.length} files...`;
      }
    }
    
    // Create an array to hold processed files for reporting
    const processedFiles = [];
    
    // Process all collected files
    for (let i = 0; i < files.length; i++) {
      const fileInfo = files[i];
      
      try {
        // Read file content
        let content;
        if (isBinaryFile(fileInfo.name)) {
          content = `[Binary file: ${fileInfo.file.size} bytes]`;
        } else {
          content = await readFileAsText(fileInfo.file);
        }
        
        // Process for context instead of directly saving
        const result = await window.electronAPI.processFileForContext(fileInfo.relativePath, content);
        
        if (result.success) {
          processedFiles.push({
            name: fileInfo.name,
            relativePath: fileInfo.relativePath
          });
        }
        
        // Update progress on every 5 files or on the last file
        if (i % 5 === 0 || i === files.length - 1) {
          const progressElement = document.getElementById('folder-upload-progress');
          if (progressElement) {
            const statusElement = progressElement.querySelector('.upload-status');
            if (statusElement) {
              statusElement.textContent = `Processed ${i + 1} of ${files.length} files...`;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing file ${fileInfo.relativePath}:`, error);
      }
    }
    
    // Show success message
    const progressElement = document.getElementById('folder-upload-progress');
    if (progressElement) {
      progressElement.className = 'folder-upload-success';
      progressElement.innerHTML = `
        <div class="success-icon">✓</div>
        <div class="folder-upload-info">
          <strong>Uploaded folder: ${baseFolderName}</strong>
          <div class="upload-status success">Processed ${processedFiles.length} files</div>
        </div>
        <button class="close-success">×</button>
      `;
      
      const closeButton = progressElement.querySelector('.close-success');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          progressElement.remove();
        });
      }
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (progressElement.parentNode) {
          progressElement.remove();
        }
      }, 5000);
    }
    
    // Refresh file list
    await loadFiles();
    
  } catch (error) {
    console.error('Error processing folder:', error);
    showFolderUploadError(baseFolderName, error.message);
  }
}

// Recursively process a directory entry
function processDirectoryEntry(directoryEntry, currentPath, files) {
  return new Promise((resolve, reject) => {
    const dirReader = directoryEntry.createReader();
    const readEntries = () => {
      dirReader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve();
        } else {
          try {
            // Process all entries
            for (const entry of entries) {
              const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
              
              if (entry.isFile) {
                // Get file and add to files array with relative path
                await new Promise((resolveFile, rejectFile) => {
                  entry.file(
                    (file) => {
                      files.push({
                        file: file,
                        name: entry.name,
                        relativePath: entryPath
                      });
                      resolveFile();
                    },
                    rejectFile
                  );
                });
              } else if (entry.isDirectory) {
                // Recursively process subdirectory
                await processDirectoryEntry(entry, entryPath, files);
              }
            }
            
            // Continue reading (readEntries only returns some entries at a time)
            readEntries();
          } catch (error) {
            reject(error);
          }
        }
      }, reject);
    };
    
    readEntries();
  });
}

// Handle paste events to create files from clipboard
function setupPasteHandler() {
  document.addEventListener('paste', (e) => {
    // Skip if paste target is an input or textarea
    if (document.activeElement.tagName === 'TEXTAREA' || 
        document.activeElement.tagName === 'INPUT') {
      return;
    }
    
    const text = e.clipboardData.getData('text/plain');
    if (text && text.length > 500) { // Only handle "large" text
      // Generate a filename based on content
      const firstLine = text.split('\n')[0].trim();
      let fileName = firstLine.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
      
      // Add timestamp to ensure uniqueness
      const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
      fileName = `${fileName}_${timestamp}.txt`;
      
      // Create file object
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], fileName, { type: 'text/plain' });
      
      // Open sidebar and upload
      document.getElementById('fileSidebar').classList.add('open');
      
      // Upload file
      uploadFile(file);
    }
  });
}

// Handle file upload process
async function handleFileUpload(fileList) {
  for (const file of fileList) {
    await uploadFile(file);
  }
}

// Upload a single file
async function uploadFile(file) {
  try {
    // Show loading state in file list
    const fileList = document.getElementById('fileList');
    const loadingItem = document.createElement('div');
    loadingItem.className = 'file-item';
    loadingItem.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="file-name">Uploading ${file.name}...</div>
    `;
    fileList.insertBefore(loadingItem, fileList.firstChild);
    
    // Read file as appropriate type
    let content;
    if (isBinaryFile(file.name)) {
      content = await readFileAsArrayBuffer(file);
      // For binary files, we'll use a placeholder
      content = `[Binary file: ${file.size} bytes]`;
    } else {
      content = await readFileAsText(file);
    }
    
    // Process file for context instead of directly saving to project
    const result = await window.electronAPI.processFileForContext(file.name, content);
    
    if (!result.success && !result.staged) {
      throw new Error(result.error || 'Failed to process file');
    }
    
    // Remove loading item
    if (loadingItem.parentNode) {
      loadingItem.parentNode.removeChild(loadingItem);
    }
    
    // Refresh file list only if not in first message mode
    const currentProject = await window.electronAPI.getProjectDirectory();
    if (currentProject) {
      await loadFiles();
    } else {
      // Show staged files message
      const stagedItem = document.createElement('div');
      stagedItem.className = 'file-item staged';
      stagedItem.innerHTML = `
        <div class="file-name">${file.name} (staged)</div>
        <div class="file-status">Will be processed when you send your first message</div>
      `;
      fileList.insertBefore(stagedItem, fileList.firstChild);
    }
    
  } catch (error) {
    console.error('Error uploading file:', error);
    
    // Show error message for user
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.textContent = `Error uploading ${file.name}: ${error.message}`;
    document.body.appendChild(notification);
    
    // Remove after a delay
    setTimeout(() => {
      notification.classList.add('fadeout');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
    
    // Remove loading item if it exists
    const loadingItems = document.querySelectorAll('.file-item .loading-spinner');
    loadingItems.forEach(item => {
      const parent = item.closest('.file-item');
      if (parent) parent.remove();
    });
    
    await loadFiles();
  }
}

// Read file as text
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Read file as array buffer (for binary files)
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Check if file should be treated as binary
function isBinaryFile(fileName) {
  const binaryExtensions = ['.ttf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 
                          '.pdf', '.mp3', '.mp4', '.wav', '.zip', '.exe', '.dll'];
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  return binaryExtensions.includes(ext);
}

// Determine if file should have description generated
function shouldGenerateDescription(fileName) {
  return !isBinaryFile(fileName);
}

// Create a hierarchical file tree from file list
function createFileTree(files) {
  const tree = {
    name: 'root',
    type: 'directory',
    children: {},
    path: ''
  };
  
  files.forEach(file => {
    const pathParts = file.relativePath.split('/');
    let currentLevel = tree.children;
    
    // Handle directories in the path
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      
      if (!currentLevel[part]) {
        currentLevel[part] = {
          name: part,
          type: 'directory',
          children: {},
          path: pathParts.slice(0, i + 1).join('/')
        };
      }
      
      currentLevel = currentLevel[part].children;
    }
    
    // Add the file
    const fileName = pathParts[pathParts.length - 1];
    currentLevel[fileName] = {
      name: fileName,
      type: 'file',
      path: file.path,
      relativePath: file.relativePath
    };
  });
  
  return tree;
}

// Load and display files as hierarchical tree
async function loadFiles() {
  try {
    // Get the file list element
    const fileList = document.getElementById('fileList');
    if (!fileList) return;
    
    // Check if we have an active project
    const projectDir = await window.electronAPI.getProjectDirectory();
    if (!projectDir) {
      // Display message about first message
      fileList.innerHTML = '<p class="text-muted text-center my-4">Files will be available after you send your first message.</p>';
      return;
    }
    
    // Now we can list files
    const result = await window.electronAPI.listFiles();
    
    fileList.innerHTML = '';
    
    if (!result.success) {
      fileList.innerHTML = `<p class="text-muted text-center my-4">Error: ${result.error || 'Could not list files'}</p>`;
      return;
    }
    
    if (result.files.length === 0) {
      fileList.innerHTML = '<p class="text-muted text-center my-4">No files uploaded yet.</p>';
      return;
    }
    
    // Create hierarchical file tree
    const fileTree = createFileTree(result.files);
    
    // Create and append file tree elements
    const fragment = document.createDocumentFragment();
    renderFileTree(fileTree, fragment);
    fileList.appendChild(fragment);
    
    // Add event listeners for file actions
    setupFileTreeInteractions();
  } catch (error) {
    console.error('Error loading files:', error);
    
    // Get the file list element
    const fileList = document.getElementById('fileList');
    if (fileList) {
      fileList.innerHTML = `<p class="text-muted text-center my-4">Error loading files: ${error.message}</p>`;
    }
  }
}

// Render the file tree recursively
function renderFileTree(node, parentElement) {
  // Skip root node
  if (node.name !== 'root') {
    const element = document.createElement('div');
    element.className = node.type === 'directory' ? 'file-tree-directory' : 'file-tree-file';
    element.dataset.path = node.path;
    element.dataset.type = node.type;
    
    if (node.type === 'directory') {
      element.innerHTML = `
        <div class="file-tree-header" data-path="${node.path}">
          <span class="directory-name">${node.name}</span>
        </div>
        <div class="file-tree-children" style="display: none;"></div>
      `;
    } else {
      element.innerHTML = `
        <div class="file-tree-header" data-path="${node.path}">
          <span class="file-name">${node.name}</span>
          <div class="file-actions">
            ${!isBinaryFile(node.name) ? `<button class="open-file" data-path="${node.path}">Open</button>` : ''}
            <button class="delete-file" data-path="${node.path}">Delete</button>
          </div>
        </div>
      `;
    }
    
    parentElement.appendChild(element);
    
    // If directory, render children
    if (node.type === 'directory') {
      const childrenContainer = element.querySelector('.file-tree-children');
      renderDirectoryChildren(node.children, childrenContainer);
    }
  } else {
    // For root, directly render its children
    renderDirectoryChildren(node.children, parentElement);
  }
}

// Render directory children
function renderDirectoryChildren(children, parentElement) {
  // Sort directories first, then files
  const sortedEntries = Object.entries(children).sort(([nameA, nodeA], [nameB, nodeB]) => {
    if (nodeA.type === nodeB.type) {
      return nameA.localeCompare(nameB);
    }
    return nodeA.type === 'directory' ? -1 : 1;
  });
  
  for (const [name, childNode] of sortedEntries) {
    renderFileTree(childNode, parentElement);
  }
}

// Setup interactions for the file tree
function setupFileTreeInteractions() {
  // Directory expand/collapse
  document.querySelectorAll('.file-tree-directory .file-tree-header').forEach(header => {
    header.addEventListener('click', (e) => {
      // Prevent triggering when clicking action buttons
      if (e.target.closest('.file-actions')) {
        return;
      }
      
      const childrenContainer = header.nextElementSibling;
      if (childrenContainer) {
        const isExpanded = childrenContainer.style.display !== 'none';
        childrenContainer.style.display = isExpanded ? 'none' : 'block';
        header.classList.toggle('expanded', !isExpanded);
      }
    });
  });
  
  // File actions
  document.querySelectorAll('.open-file').forEach(button => {
    button.addEventListener('click', async () => {
      const filePath = button.getAttribute('data-path');
      const fileContent = await window.electronAPI.readFile(filePath);
      
      // Dispatch event to open file in appropriate editor/viewer
      window.dispatchEvent(new CustomEvent('open-file', {
        detail: {
          path: filePath,
          content: fileContent.content
        }
      }));
    });
  });
  
  document.querySelectorAll('.delete-file').forEach(button => {
    button.addEventListener('click', async () => {
      const filePath = button.getAttribute('data-path');
      if (confirm(`Are you sure you want to delete this file?`)) {
        await window.electronAPI.deleteFile(filePath);
        loadFiles();
      }
    });
  });
}

// Export functions
export {
  loadFiles
};