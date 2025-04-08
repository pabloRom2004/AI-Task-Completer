/**
 * File manager UI component
 * Handles displaying and interacting with the files sidebar
 */

export function initFileManager() {
    // DOM elements
    const fileSidebar = document.getElementById('fileSidebar');
    const toggleFileSidebar = document.getElementById('toggleFileSidebar');
    const closeFileSidebar = document.getElementById('closeFileSidebar');
    const fileGrid = document.getElementById('fileGrid');
    const browseFiles = document.getElementById('browseFiles');
    const browseFolders = document.getElementById('browseFolders');
    const fileInput = document.getElementById('fileInput');
    const folderInput = document.getElementById('folderInput');
    const dragDropOverlay = document.getElementById('dragDropOverlay');
    const initialTaskDescription = document.getElementById('initialTaskDescription');

    // Add project title element to the sidebar
    const projectTitleElement = document.createElement('div');
    projectTitleElement.id = 'sidebarProjectTitle';
    projectTitleElement.className = 'sidebar-project-title';
    projectTitleElement.textContent = 'Pending Project';

    // Insert at the top of the sidebar (adjust the selector as needed for your HTML structure)
    if (fileSidebar.firstChild) {
        fileSidebar.insertBefore(projectTitleElement, fileSidebar.firstChild);
    } else {
        fileSidebar.appendChild(projectTitleElement);
    }

    // State variables
    let files = [];
    let selectedFileId = null;
    let currentProjectId = null;
    const TEXT_FILE_SIZE_THRESHOLD = 10 * 1024; // 10KB threshold for copy-paste detection

    // File type color mapping (same as CSS variables but accessible in JS)
    const fileTypeColors = {
        js: '#f7df1e',      // JavaScript
        html: '#e8a077',    // HTML
        css: '#85b3ed',     // CSS
        json: '#92c2db',    // JSON
        txt: '#b0b0b0',     // Text
        md: '#c2a4d6',      // Markdown
        cs: '#c594c5',      // C#
        py: '#8ac6f2',      // Python
        java: '#e0b683',    // Java
        cpp: '#f2a9c2',     // C++
        ts: '#9dc8cd',      // TypeScript
        pdf: '#f2a4a4',     // PDF
        img: '#a8d5ba',     // Images
        svg: '#ffd1a1',     // SVG
        doc: '#92b5db',     // Word
        xls: '#a8d5ba',     // Excel
        ppt: '#f2a4a4',     // PowerPoint
        bin: '#b0b0b0',     // Binary files
        default: '#cccccc', // Default
        folder: '#ffd54f'   // Folder
    };

    // Image file extensions
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];

    // Document file extensions
    const docExtensions = ['doc', 'docx', 'pdf', 'txt', 'rtf', 'odt'];

    // Initialize
    setupEventListeners();
    loadFiles();

    /**
     * Load files from registry
     */
    async function loadFiles() {
        try {
            // Show loading state
            fileGrid.innerHTML = '<div class="empty-message">Loading files...</div>';

            // Get file registry from backend
            const registry = await window.electronAPI.files.getRegistry();

            if (registry && registry.files) {
                files = registry.files;
                renderFileGrid(files);
            } else {
                fileGrid.innerHTML = '<div class="empty-message">No files yet</div>';
            }
        } catch (error) {
            console.error('Error loading files:', error);
            fileGrid.innerHTML = '<div class="empty-message">Error loading files</div>';
            showNotification('Failed to load files', 'error');
        }
    }

    /**
     * Set up event listeners for the file manager
     */
    function setupEventListeners() {
        // Toggle sidebar visibility
        toggleFileSidebar.addEventListener('click', () => {
            fileSidebar.classList.toggle('open');
        });

        // Close sidebar
        closeFileSidebar.addEventListener('click', () => {
            fileSidebar.classList.remove('open');
        });

        // Browse files button
        browseFiles.addEventListener('click', async () => {
            try {
                // Use Electron dialog API
                const result = await window.electronAPI.dialog.openFile({
                    title: 'Select Files',
                    filters: [
                        { name: 'All Files', extensions: ['*'] }
                    ],
                    properties: ['openFile', 'multiSelections']
                });

                if (result.success && result.filePaths.length > 0) {
                    handleFileSelection(result.filePaths, false);
                }
            } catch (error) {
                console.error('Error opening file dialog:', error);
                showNotification('Failed to open file selection dialog', 'error');
            }
        });

        // Browse folders button
        browseFolders.addEventListener('click', async () => {
            try {
                // Use Electron dialog API
                const result = await window.electronAPI.dialog.openDirectory({
                    title: 'Select Folder',
                    properties: ['openDirectory']
                });

                if (result.success && result.filePaths.length > 0) {
                    handleFolderSelection(result.filePaths[0]);
                }
            } catch (error) {
                console.error('Error opening directory dialog:', error);
                showNotification('Failed to open folder selection dialog', 'error');
            }
        });

        // File input change (fallback for direct file input)
        fileInput.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                // This is just UI temporary support, actual files
                // would be processed differently in a proper Electron app
                const fileNames = Array.from(event.target.files).map(file => file.name);
                showNotification(`Selected ${fileNames.length} files`, 'info');

                // Reset file input
                fileInput.value = '';
            }
        });

        // Folder input change (fallback for direct folder input)
        folderInput.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                // This is just UI temporary support, actual folders
                // would be processed differently in a proper Electron app
                showNotification(`Selected folder with ${event.target.files.length} files`, 'info');

                // Reset folder input
                folderInput.value = '';
            }
        });

        // Drag and drop events for the entire document
        document.addEventListener('dragover', (event) => {
            event.preventDefault();
            dragDropOverlay.classList.add('visible');
        });

        document.addEventListener('dragleave', (event) => {
            if (event.relatedTarget === null || event.relatedTarget === document.documentElement) {
                dragDropOverlay.classList.remove('visible');
            }
        });

        document.addEventListener('drop', (event) => {
            event.preventDefault();
            dragDropOverlay.classList.remove('visible');

            if (event.dataTransfer.files.length > 0) {
                // Check if this is a folder drop
                const hasFolder = Array.from(event.dataTransfer.items).some(item => {
                    const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
                    return entry && entry.isDirectory;
                });

                if (hasFolder) {
                    // Show error for folder drop
                    showPopupNotification("Please use 'Add Folder' button for folders");
                } else {
                    // Process files - in a real implementation we'd get the file paths
                    // For now, just show a notification
                    showNotification(`Dropped ${event.dataTransfer.files.length} files`, 'info');
                    fileSidebar.classList.add('open');
                }
            }
        });

        // Paste event for text content
        document.addEventListener('paste', (event) => {
            const text = event.clipboardData.getData('text/plain');

            if (text && text.length > TEXT_FILE_SIZE_THRESHOLD) {
                handleLargeTextPaste(text);

                // Clear the input if paste was detected in the task description
                if (document.activeElement === initialTaskDescription) {
                    initialTaskDescription.value = '';
                }
            }
        });
    }

    /**
     * Handle file selection from dialog
     * @param {Array} filePaths - Array of file paths
     * @param {boolean} isFolder - Whether this is a folder selection
     */
    async function handleFileSelection(filePaths, isFolder) {
        try {
            const processedFiles = [];

            for (const filePath of filePaths) {
                // Process each file
                const result = await window.electronAPI.files.processFile(filePath);

                if (result.success) {
                    processedFiles.push(result.fileRef);
                } else {
                    showNotification(`Error processing file: ${path.basename(filePath)}`, 'error');
                }
            }

            if (processedFiles.length > 0) {
                // Refresh file list
                await loadFiles();

                // Show notification
                showNotification(`Added ${processedFiles.length} file(s)`, 'success');

                // Open sidebar
                fileSidebar.classList.add('open');
            }
        } catch (error) {
            console.error('Error handling file selection:', error);
            showNotification('Failed to process selected files', 'error');
        }
    }

    /**
     * Handle folder selection from dialog
     * @param {string} folderPath - Folder path
     */
    async function handleFolderSelection(folderPath) {
        try {
            // Scan directory
            const result = await window.electronAPI.files.scanDirectory(folderPath);

            if (result.success) {
                // Refresh file list
                await loadFiles();

                // Show notification
                const fileCount = result.processedFiles.length;
                showNotification(`Added folder with ${fileCount} file(s)`, 'success');

                // Open sidebar
                fileSidebar.classList.add('open');
            } else {
                showNotification(`Error scanning folder: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error handling folder selection:', error);
            showNotification('Failed to process selected folder', 'error');
        }
    }

    /**
     * Handle large text paste to create a context file
     * @param {string} text - Pasted text content
     */
    async function handleLargeTextPaste(text) {
        try {
            // Save text as a file
            const result = await window.electronAPI.files.saveTextPaste(text);

            if (result.success) {
                // Refresh file list
                await loadFiles();

                // Show popup notification for pasted content
                showPopupNotification("Pasted content has been saved as a file");

                // Open sidebar if it's closed
                fileSidebar.classList.add('open');
            } else {
                showNotification(`Error saving pasted text: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error handling large text paste:', error);
            showNotification('Failed to save pasted text', 'error');
        }
    }

    /**
     * Show a popup notification in the center of the screen
     * @param {string} message - Message to display
     */
    function showPopupNotification(message) {
        // Remove any existing popup
        const existingPopup = document.querySelector('.popup-notification');
        if (existingPopup) {
            existingPopup.remove();
        }

        // Create popup element
        const popup = document.createElement('div');
        popup.className = 'popup-notification';
        popup.textContent = message;

        // Add to document
        document.body.appendChild(popup);

        // Trigger reflow to ensure transition works
        popup.offsetHeight;

        // Show popup
        popup.classList.add('visible');

        // Auto-remove after 2 seconds
        setTimeout(() => {
            popup.classList.remove('visible');
            setTimeout(() => popup.remove(), 300);
        }, 2000);
    }

    /**
     * Render the file grid
     * @param {Array} fileList - List of file objects
     */
    function renderFileGrid(fileList) {
        fileGrid.innerHTML = '';

        if (fileList.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'No files yet';
            fileGrid.appendChild(emptyMessage);
            return;
        }

        // Filter for top-level files and folders
        const topLevelItems = fileList.filter(file => !file.parentId);

        topLevelItems.forEach(file => {
            renderFileItem(file, fileGrid, fileList);
        });
    }

    /**
       * Render a file item in the grid
       * @param {Object} file - File object
       * @param {HTMLElement} container - Container to append file item to
       * @param {Array} allFiles - All files for handling children
       */
    function renderFileItem(file, container, allFiles) {
        const fileItem = document.createElement('div');
        fileItem.className = `file-item ${file.isDirectory ? 'folder-item' : ''}`;
        fileItem.dataset.id = file.id;
        fileItem.dataset.path = file.originalPath;
        fileItem.dataset.type = file.type;

        if (file.id === selectedFileId) {
            fileItem.classList.add('selected');
        }

        // Create icon background div for glow
        const iconBackground = document.createElement('div');
        iconBackground.className = 'file-icon-background';

        // Get color for this file type
        const fileColor = file.isDirectory ?
            fileTypeColors.folder :
            (fileTypeColors[file.type] || fileTypeColors.default);

        // Add glow background
        iconBackground.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="80" height="80">
        <defs>
          <radialGradient id="glowGradient${file.id}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stop-color="${fileColor}" stop-opacity="0.8"/>
            <stop offset="40%" stop-color="${fileColor}" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="${fileColor}" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="40" fill="url(#glowGradient${file.id})" filter="blur(8px)"/>
      </svg>
    `;

        // Create file icon
        const fileIcon = document.createElement('div');
        fileIcon.className = `file-icon file-${file.type}`;

        if (file.isDirectory) {
            // Folder icon - using SVG with folder icon
            fileIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 20" width="75" height="63" style="filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2));">
          <defs>
            <linearGradient id="folderGrad${file.id}" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="${adjustColor(fileColor, -30)}"/>
              <stop offset="100%" stop-color="${fileColor}"/>
            </linearGradient>
          </defs>
          <!-- Folder shape -->
          <path d="M10,2 L4,2 C2.9,2 2,2.9 2,4 L2,16 C2,17.1 2.9,18 4,18 L20,18 C21.1,18 22,17.1 22,16 L22,6 C22,4.9 21.1,4 20,4 L12,4 L10,2 Z" fill="url(#folderGrad${file.id})"/>
        </svg>
      `;
        } else {
            // File icon - using custom file icon with color tint
            fileIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" width="50" height="58" style="filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.2));">
          <defs>
            <linearGradient id="fileGrad${file.id}" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="${adjustColor(fileColor, -30)}"/>
              <stop offset="100%" stop-color="${fileColor}"/>
            </linearGradient>
          </defs>
          <!-- Main file shape with color tint -->
          <path d="M3,0 H16 L21,5 V25 a3,3 0 0 1 -3,3 H3 a3,3 0 0 1 -3,-3 V3 a3,3 0 0 1 3,-3 Z" fill="url(#fileGrad${file.id})"/>
          <!-- Folded corner -->
          <path d="M16,0 L21,5 H18 a2,2 0 0 1 -2,-2 V0 Z" fill="${adjustColor(fileColor, -50)}"/>
        </svg>
        <span class="file-type">${file.type}</span>
      `;
        }

        // File name
        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = file.name;

        // Add elements to file item
        fileItem.appendChild(iconBackground);
        fileItem.appendChild(fileIcon);
        fileItem.appendChild(fileName);

        // Modify the renderFileItem function in src/files/ui.js
        // Add this inside the renderFileItem function, after creating the file name element

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.className = 'file-close-button';
        closeButton.innerHTML = '&times;';
        closeButton.title = 'Remove file';
        closeButton.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent file selection when clicking close

            try {
                // Remove file from registry
                if (file.id) {
                    // For files in the temp directory, completely remove them
                    if (file.originalPath.includes('temp') && !currentProjectId) {
                        try {
                            // Attempt to delete the file if it's in our temp storage
                            await window.electronAPI.files.deleteFile(file.id);
                        } catch (err) {
                            console.warn('Could not delete file:', err);
                        }
                    }

                    // Remove from the UI
                    const fileElement = document.querySelector(`.file-item[data-id="${file.id}"]`);
                    if (fileElement) {
                        fileElement.classList.add('removing');
                        setTimeout(() => {
                            fileElement.remove();

                            // Check if we need to show "No files" message
                            if (fileGrid.querySelectorAll('.file-item').length === 0) {
                                const emptyMessage = document.createElement('div');
                                emptyMessage.className = 'empty-message';
                                emptyMessage.textContent = 'No files yet';
                                fileGrid.appendChild(emptyMessage);
                            }
                        }, 300);
                    }
                }
            } catch (error) {
                console.error('Error removing file:', error);
                showNotification(`Failed to remove file: ${error.message}`, 'error');
            }
        });

        // Add the elements to file item (update the existing code)
        fileItem.appendChild(iconBackground);
        fileItem.appendChild(fileIcon);
        fileItem.appendChild(fileName);
        fileItem.appendChild(closeButton); // Add the close button

        // Event listeners
        fileItem.addEventListener('click', (e) => {
            // For folders, toggle expansion
            if (file.isDirectory) {
                toggleFolderExpansion(file.id);
            } else {
                // For files, just select
                selectFile(file.id);
            }
            e.stopPropagation();
        });

        fileItem.addEventListener('dblclick', (e) => {
            if (!file.isDirectory) {
                openFile(file);
            }
            e.stopPropagation();
        });

        container.appendChild(fileItem);

        // If it's a directory, check for children
        if (file.isDirectory) {
            // Find children
            const children = allFiles.filter(f => f.parentId === file.id);

            if (children.length > 0) {
                // Create folder contents container
                const folderContents = document.createElement('div');
                folderContents.className = 'folder-contents';
                folderContents.id = `folder-contents-${file.id}`;

                // Create nested container for horizontal layout
                const nestedContainer = document.createElement('div');
                nestedContainer.className = 'file-grid';

                // Add child files and folders
                children.forEach(childFile => {
                    renderFileItem(childFile, nestedContainer, allFiles);
                });

                folderContents.appendChild(nestedContainer);
                container.appendChild(folderContents);
            }
        }
    }

    /**
     * Adjust a color by a percentage
     * @param {string} color - HEX color string
     * @param {number} percent - Percentage to adjust (-100 to 100)
     * @returns {string} Adjusted HEX color
     */
    function adjustColor(color, percent) {
        let R = parseInt(color.substring(1, 3), 16);
        let G = parseInt(color.substring(3, 5), 16);
        let B = parseInt(color.substring(5, 7), 16);

        R = parseInt(R * (100 + percent) / 100);
        G = parseInt(G * (100 + percent) / 100);
        B = parseInt(B * (100 + percent) / 100);

        R = (R < 255) ? R : 255;
        G = (G < 255) ? G : 255;
        B = (B < 255) ? B : 255;

        R = (R > 0) ? R : 0;
        G = (G > 0) ? G : 0;
        B = (B > 0) ? B : 0;

        const RR = ((R.toString(16).length == 1) ? "0" + R.toString(16) : R.toString(16));
        const GG = ((G.toString(16).length == 1) ? "0" + G.toString(16) : G.toString(16));
        const BB = ((B.toString(16).length == 1) ? "0" + B.toString(16) : B.toString(16));

        return "#" + RR + GG + BB;
    }

    /**
     * Select a file
     * @param {string} fileId - ID of the file to select
     */
    function selectFile(fileId) {
        // Update selected file
        selectedFileId = fileId;

        // Update UI to reflect selection
        document.querySelectorAll('.file-item').forEach(item => {
            if (item.dataset.id === fileId) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * Open a file using the system's default application
     * @param {Object} file - File object
     */
    async function openFile(file) {
        if (!file.originalPath) return;

        try {
            const result = await window.electronAPI.shell.openPath(file.originalPath);

            if (!result.success) {
                showNotification(`Error opening file: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error opening file:', error);
            showNotification(`Error opening file: ${error.message}`, 'error');
        }
    }

    /**
     * Toggle folder expansion
     * @param {string} folderId - ID of the folder to toggle
     */
    function toggleFolderExpansion(folderId) {
        const folderContents = document.getElementById(`folder-contents-${folderId}`);

        if (folderContents) {
            // Toggle expanded class
            if (folderContents.classList.contains('expanded')) {
                folderContents.classList.remove('expanded');
            } else {
                folderContents.classList.add('expanded');

                // Select the folder when expanding
                selectFile(folderId);
            }
        }
    }

    /**
     * Show a notification message
     * @param {string} message - Message to display
     * @param {string} type - Message type (success, error, info)
     */
    function showNotification(message, type = 'info') {
        // Get or create notification container
        let notificationContainer = document.querySelector('.notification-container');

        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.className = 'notification-container';
            document.body.appendChild(notificationContainer);
        }

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
        notificationContainer.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('fadeout');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Update project title in the sidebar
     * @param {string} projectId - Current project ID
     * @param {string} title - Project title
     */
    async function updateProjectTitle(projectId, title) {
        if (projectId) {
            try {
                // If we have a project ID but no title, fetch project details
                if (!title) {
                    const project = await window.electronAPI.projects.getProject(projectId);
                    if (project && project.title) {
                        title = project.title;
                    } else {
                        title = 'Untitled Project';
                    }
                }

                projectTitleElement.textContent = title;
                currentProjectId = projectId;
            } catch (error) {
                console.error('Error updating project title:', error);
                projectTitleElement.textContent = 'Project';
            }
        } else {
            projectTitleElement.textContent = 'Pending Project';
            currentProjectId = null;
        }
    }

    // Add CSS for project title
    const style = document.createElement('style');
    style.textContent = `
    .sidebar-project-title {
      padding: 15px;
      font-size: 18px;
      font-weight: bold;
      color: #333;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;
    document.head.appendChild(style);

    // Return public methods
    return {
        openSidebar() {
            fileSidebar.classList.add('open');
        },

        closeSidebar() {
            fileSidebar.classList.remove('open');
        },

        refreshFiles() {
            loadFiles();
        },

        setCurrentProject(projectId, title) {
            updateProjectTitle(projectId, title);
        },

        processAiCommands(aiResponse) {
            return window.electronAPI.files.processCommands(aiResponse);
        },

        processFileRequests(aiResponse) {
            return window.electronAPI.files.processFileRequests(aiResponse);
        }
    };
}