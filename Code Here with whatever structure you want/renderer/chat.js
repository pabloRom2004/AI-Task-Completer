/**
 * Sets up chat functionality in the UI
 */
export function setupChat() {
  // DOM Elements
  const messageInputElement = document.getElementById('messageInput');
  const responseElement = document.getElementById('response');
  const apiKeyInputElement = document.getElementById('apiKey');
  const sendButton = document.getElementById('sendMessage');
  const setApiKeyButton = document.getElementById('setApiKey');
  
  // Skip setup if we're not on the chat page
  if (!messageInputElement) return;
  
  // Add streaming toggle
  const streamingToggleDiv = document.createElement('div');
  streamingToggleDiv.className = 'input-group';
  streamingToggleDiv.innerHTML = `
    <label for="streamingToggle" class="toggle-label">
      <input type="checkbox" id="streamingToggle" checked>
      <span>Enable streaming responses</span>
    </label>
  `;
  
  // Add the toggle before the response area
  const responseContainer = document.querySelector('.response-container');
  if (responseContainer) {
    responseContainer.parentNode.insertBefore(streamingToggleDiv, responseContainer);
  }
  
  const streamingToggle = document.getElementById('streamingToggle');
  
  // Set API key when provided
  setApiKeyButton.addEventListener('click', async () => {
    const apiKey = apiKeyInputElement.value.trim();
    if (apiKey) {
      try {
        const result = await window.electronAPI.setApiKey(apiKey);
        if (result.success) {
          showNotification('API key set successfully');
        } else {
          showError(`Error setting API key: ${result.error}`);
        }
      } catch (error) {
        console.error('Error setting API key:', error);
        showError('Failed to set API key: ' + error.message);
      }
    } else {
      showError('Please enter an API key');
    }
  });
  
  // Register for streaming updates from the main process
  window.electronAPI.onMessageUpdate((partialResponse) => {
    // Update the UI with each streamed chunk
    if (responseElement) {
      responseElement.textContent = partialResponse;
      
      // Auto-scroll to the bottom of the response area
      responseElement.scrollTop = responseElement.scrollHeight;
    }
  });
  
  // Send message button
  sendButton.addEventListener('click', sendMessage);
  
  // Allow pressing Enter in the input field to send the message
  messageInputElement.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  
  // Send message function
  async function sendMessage() {
    const message = messageInputElement.value.trim();
    if (!message) {
      showError('Please enter a message');
      return;
    }
    
    try {
      // Update UI state
      sendButton.disabled = true;
      sendButton.classList.add('loading');
      messageInputElement.disabled = true;
      if (streamingToggle) streamingToggle.disabled = true;
      
      // Clear previous response and show loading state
      responseElement.textContent = 'Waiting for response...';
      
      // Check if streaming is enabled
      const streamEnabled = streamingToggle ? streamingToggle.checked : true;
      
      // Send the message
      const response = await window.electronAPI.sendMessage(
        message, 
        'deepseek/deepseek-chat-v3-0324:free',
        streamEnabled
      );
      
      // Re-enable UI
      sendButton.disabled = false;
      sendButton.classList.remove('loading');
      messageInputElement.disabled = false;
      if (streamingToggle) streamingToggle.disabled = false;
      
      // Handle response which may be an object with fileContent
      let finalResponse = response;
      
      if (typeof response === 'object' && response.response) {
        finalResponse = response.response;
        
        // If there's file content, we need to display it as a "user" message after the assistant's response
        if (response.fileContent) {
          setTimeout(() => {
            // Append a new user message with file content
            const fileContentElement = document.createElement('div');
            fileContentElement.className = 'user-message file-content';
            fileContentElement.textContent = response.fileContent;
            responseElement.parentNode.appendChild(fileContentElement);
            
            // Scroll to the newly added content
            fileContentElement.scrollIntoView({ behavior: 'smooth' });
          }, 1000); // Add a slight delay for better UX
        }
      }
      
      // If streaming was disabled, manually update the UI with assistant response
      if (!streamEnabled) {
        responseElement.textContent = finalResponse;
      }
      
      // Handle errors
      if (finalResponse.startsWith('Error:')) {
        showError(finalResponse);
      }
      
      // Clear the input for next message
      messageInputElement.value = '';
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Reset UI state
      sendButton.disabled = false;
      sendButton.classList.remove('loading');
      messageInputElement.disabled = false;
      if (streamingToggle) streamingToggle.disabled = false;
      
      // Show error message
      responseElement.textContent = `Error: ${error.message}`;
      showError(`Failed to send message: ${error.message}`);
    }
  }
  
  // Show notification
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after a delay
    setTimeout(() => {
      notification.classList.add('fadeout');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }
  
  // Show error
  function showError(message) {
    console.error(message);
    showNotification(message);
  }
}