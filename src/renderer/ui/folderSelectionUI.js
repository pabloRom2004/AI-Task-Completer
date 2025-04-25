// src/renderer/ui/folderSelectionUI.js

import fileService from '../services/fileService.js';

/**
 * Handles the UI for project folder selection
 */
class FolderSelectionUI {
  constructor() {
    this.modal = document.getElementById('folderSelectionModal');
    this.folderPathElement = document.getElementById('selectedFolderPath');
    this.selectButton = document.getElementById('selectFolderBtn');
    
    // Initialize event listeners
    this._initEventListeners();
  }

  /**
   * Set up event listeners for the folder selection UI
   * @private
   */
  _initEventListeners() {
    // Select folder button click handler
    this.selectButton.addEventListener('click', async () => {
      const folderPath = await fileService.selectFolder();
      if (folderPath) {
        this.folderPathElement.textContent = folderPath;
        this._hideModal();
      }
    });
  }

  /**
   * Show the folder selection modal
   * @returns {Promise<string>} Selected folder path
   */
  showModal() {
    // Display the modal
    this.modal.style.display = 'block';
    
    // Return a promise that resolves when a folder is selected
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const currentFolder = fileService.getProjectFolder();
        if (currentFolder) {
          clearInterval(checkInterval);
          resolve(currentFolder);
        }
      }, 500);
    });
  }

  /**
   * Hide the folder selection modal
   * @private
   */
  _hideModal() {
    this.modal.style.display = 'none';
  }
}

// Export a singleton instance
const folderSelectionUI = new FolderSelectionUI();
export default folderSelectionUI;