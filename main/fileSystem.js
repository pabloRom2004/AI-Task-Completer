const { dialog } = require('electron');
const fs = require('fs');
const path = require('path');

// Store the project folder path
let projectFolderPath = null;
// Track open file handles for proper cleanup
let openFileHandles = {};

/**
 * Recursively get all files in a directory
 * @param {string} dirPath - Directory to scan
 * @param {Array} arrayOfFiles - Accumulator array
 * @returns {Array} Array of file paths
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
        const filePath = path.join(dirPath, file);
        if (fs.statSync(filePath).isDirectory()) {
            arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
        } else {
            arrayOfFiles.push(filePath);
        }
    });

    return arrayOfFiles;
}

/**
 * Clean up all file system resources and release handles
 */
function cleanupFileHandles() {
    console.log('Cleaning up file system resources...');
    
    // Close any open file handles
    Object.keys(openFileHandles).forEach(key => {
        try {
            const fd = openFileHandles[key];
            fs.closeSync(fd);
            console.log(`Closed file handle for: ${key}`);
        } catch (error) {
            console.error(`Error closing file handle: ${error.message}`);
        }
    });
    
    // Reset tracking objects
    openFileHandles = {};
    projectFolderPath = null;
    
    console.log('File system cleanup complete');
}

/**
 * Set up IPC handlers for file system operations
 * @param {Object} ipcMain - Electron's ipcMain object
 */
function setupFileSystemHandlers(ipcMain) {
    // Handler for selecting a folder
    ipcMain.handle('files:selectFolder', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Select Project Folder'
        });

        if (!result.canceled) {
            // Clean up previous folder if any
            if (projectFolderPath) {
                cleanupFileHandles();
            }
            projectFolderPath = result.filePaths[0];
        }

        return result;
    });

    // Handler for getting the current project folder
    ipcMain.handle('files:getProjectFolder', () => {
        return projectFolderPath;
    });

    // Handler for reading file content - use file descriptors for better tracking
    ipcMain.handle('files:readFile', async (event, filePath) => {
        try {
            let fd;
            try {
                // Open file with explicit file descriptor
                fd = fs.openSync(filePath, 'r');
                // Track the file descriptor
                openFileHandles[filePath] = fd;
                
                // Read the file
                const buffer = Buffer.alloc(fs.statSync(filePath).size);
                fs.readSync(fd, buffer, 0, buffer.length, 0);
                
                // Close and remove from tracking
                fs.closeSync(fd);
                delete openFileHandles[filePath];
                
                return buffer.toString('utf8');
            } catch (error) {
                // Make sure to close the file if an error occurs
                if (fd !== undefined) {
                    try {
                        fs.closeSync(fd);
                        delete openFileHandles[filePath];
                    } catch (closeError) {
                        console.error(`Error closing file after read error: ${closeError.message}`);
                    }
                }
                throw error;
            }
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            throw error;
        }
    });

    // Handler for writing to a file - use file descriptors for better tracking
    ipcMain.handle('files:writeFile', async (event, filePath, content) => {
        try {
            let fd;
            try {
                // Ensure the directory exists
                const dirname = path.dirname(filePath);
                if (!fs.existsSync(dirname)) {
                    fs.mkdirSync(dirname, { recursive: true });
                }

                // Open with explicit file descriptor
                fd = fs.openSync(filePath, 'w');
                // Track the file descriptor
                openFileHandles[filePath] = fd;
                
                // Write the file
                fs.writeSync(fd, content);
                
                // Close and remove from tracking
                fs.closeSync(fd);
                delete openFileHandles[filePath];
                
                return filePath;
            } catch (error) {
                // Make sure to close the file if an error occurs
                if (fd !== undefined) {
                    try {
                        fs.closeSync(fd);
                        delete openFileHandles[filePath];
                    } catch (closeError) {
                        console.error(`Error closing file after write error: ${closeError.message}`);
                    }
                }
                throw error;
            }
        } catch (error) {
            console.error(`Error writing file ${filePath}:`, error);
            throw error;
        }
    });

    // Handler for deleting a file
    ipcMain.handle('files:deleteFile', async (event, filePath) => {
        try {
            // Check if it's a directory
            const stats = fs.statSync(filePath);

            if (stats.isDirectory()) {
                fs.rmdirSync(filePath, { recursive: true });
            } else {
                fs.unlinkSync(filePath);
            }

            return true;
        } catch (error) {
            console.error(`Error deleting file ${filePath}:`, error);
            throw error;
        }
    });

    // Handler for listing all files in the project folder
    ipcMain.handle('files:listFiles', async () => {
        if (!projectFolderPath) {
            throw new Error('Project folder not set');
        }

        try {
            const files = getAllFiles(projectFolderPath);
            // Return paths relative to project folder
            return files.map(file => path.relative(projectFolderPath, file));
        } catch (error) {
            console.error('Error listing files:', error);
            throw error;
        }
    });

    // Handler for opening a file with default application
    ipcMain.handle('files:openFile', async (event, filePath) => {
        try {
            // Security check - ensure file is within project folder
            if (!filePath.startsWith(projectFolderPath)) {
                throw new Error('Security violation: Attempted to open file outside project folder');
            }

            // Open the file with the default application
            const { shell } = require('electron');
            await shell.openPath(filePath);
            return true;
        } catch (error) {
            console.error(`Error opening file ${filePath}:`, error);
            throw error;
        }
    });
}

module.exports = {
    setupFileSystemHandlers,
    cleanupFileHandles  // Export the cleanup function
};