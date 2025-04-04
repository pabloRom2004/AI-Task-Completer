// src/renderer/settings.js

/**
 * Sets up settings functionality in the UI
 */
export function setupSettings() {
    console.log('Setting up settings functionality');
    
    // Initialize settings
    loadSettings();
    
    // Function to ensure settings buttons have event listeners
    function setupSettingsButtons() {
      // Get ALL buttons with ID 'settingsButton' (handling the duplicate ID issue)
      const settingsButtons = document.querySelectorAll('#settingsButton');
      const settingsModal = document.getElementById('settingsModal');
      
      console.log('Settings buttons found:', settingsButtons.length);
      console.log('Settings modal found:', !!settingsModal);
      
      if (settingsButtons.length > 0 && settingsModal) {
        settingsButtons.forEach(button => {
          // Use a direct onclick property to override any existing handlers
          button.onclick = function() {
            console.log('Settings button clicked');
            settingsModal.style.display = 'block';
            // Add class to body to prevent scrolling when modal is open
            document.body.classList.add('modal-open');
            
            // Add animation class
            const modalContent = settingsModal.querySelector('.modal-content');
            if (modalContent) {
              modalContent.classList.add('fade-in');
              // Remove animation class after animation completes
              setTimeout(() => {
                modalContent.classList.remove('fade-in');
              }, 500);
            }
          };
        });
      }
      
      // Setup the close buttons (top X and bottom Close)
      const closeSettingsButton = document.getElementById('closeSettings');
      const closeModalBottom = document.getElementById('closeModalBottom');
      
      function closeModal() {
        console.log('Close modal button clicked');
        // Add fade out animation
        const modalContent = settingsModal.querySelector('.modal-content');
        if (modalContent) {
          modalContent.classList.add('fade-out');
          // Wait for animation to complete before hiding modal
          setTimeout(() => {
            settingsModal.style.display = 'none';
            modalContent.classList.remove('fade-out');
            // Remove class from body
            document.body.classList.remove('modal-open');
          }, 500);
        } else {
          settingsModal.style.display = 'none';
          document.body.classList.remove('modal-open');
        }
      }
      
      if (closeSettingsButton && settingsModal) {
        closeSettingsButton.onclick = closeModal;
      }
      
      if (closeModalBottom && settingsModal) {
        closeModalBottom.onclick = closeModal;
      }
      
      // Setup clicking outside the modal to close it
      window.onclick = function(event) {
        if (event.target === settingsModal) {
          closeModal();
        }
      };
      
      // Setup save button
      const saveSettingsButton = document.getElementById('saveSettings');
      if (saveSettingsButton) {
        saveSettingsButton.onclick = async function() {
          const apiKeyInput = document.getElementById('settingsApiKey');
          const modelInput = document.getElementById('modelInput');
          
          // Get values
          const apiKey = apiKeyInput?.value.trim() || '';
          const model = modelInput?.value.trim() || '';
          
          // Validate
          if (!apiKey) {
            showNotification('API key is required', 'error');
            // Add error shake animation
            apiKeyInput.classList.add('error-shake');
            setTimeout(() => apiKeyInput.classList.remove('error-shake'), 500);
            return;
          }
          
          if (!model) {
            showNotification('Model identifier is required', 'error');
            // Add error shake animation
            modelInput.classList.add('error-shake');
            setTimeout(() => modelInput.classList.remove('error-shake'), 500);
            return;
          }
          
          try {
            // Show loading state on button
            saveSettingsButton.classList.add('loading');
            saveSettingsButton.disabled = true;
            
            // Save to Electron store
            await window.electronAPI.saveSettings({
              apiKey,
              model
            });
            
            // Set API key
            const result = await window.electronAPI.setApiKey(apiKey);
            if (!result.success) {
              throw new Error(result.error || 'Failed to set API key');
            }
            
            // Remove loading state
            saveSettingsButton.classList.remove('loading');
            saveSettingsButton.disabled = false;
            
            showNotification('Settings saved successfully');
            
            // Close modal with animation
            closeModal();
          } catch (error) {
            console.error('Error saving settings:', error);
            
            // Remove loading state
            saveSettingsButton.classList.remove('loading');
            saveSettingsButton.disabled = false;
            
            showNotification(`Failed to save settings: ${error.message}`, 'error');
          }
        };
      }
    }
    
    // Initial setup
    setupSettingsButtons();
    
    // Setup again after a small delay to ensure DOM is fully ready
    setTimeout(setupSettingsButtons, 300);
    
    // Load saved settings
    async function loadSettings() {
      try {
        const settings = await window.electronAPI.getSettings();
        
        if (settings) {
          // Wait for DOM to be ready
          setTimeout(() => {
            const apiKeyInput = document.getElementById('settingsApiKey');
            const modelInput = document.getElementById('modelInput');
            
            if (apiKeyInput && settings.apiKey) {
              apiKeyInput.value = settings.apiKey;
            }
            
            if (modelInput && settings.model) {
              modelInput.value = settings.model;
            }
            
            // Set API key
            if (settings.apiKey) {
              window.electronAPI.setApiKey(settings.apiKey);
            }
          }, 300);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    }
    
    /**
     * Show a notification message
     */
    function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.textContent = message;
      
      document.body.appendChild(notification);
      
      // Remove after a delay
      setTimeout(() => {
        notification.classList.add('fadeout');
        setTimeout(() => notification.remove(), 500);
      }, 3000);
    }
  }
  
  /**
   * Get the current model
   */
  export function getCurrentModel() {
    const modelInput = document.getElementById('modelInput');
    return modelInput && modelInput.value ? 
      modelInput.value : 
      'deepseek/deepseek-chat-v3-0324:free'; // Default model
  }