// src/renderer/todoExecution.js
// Helper function to load a local prompt file and replace placeholders
async function loadPrompt(promptPath, replacements = {}) {
    const response = await fetch(promptPath);
    let prompt = await response.text();
    
    for (const key in replacements) {
      const regex = new RegExp(`{${key}}`, 'g');
      prompt = prompt.replace(regex, replacements[key]);
    }
    
    return prompt;
  }
  
  export function setupTodoExecution() {
    // DOM Elements
    const taskExecutionPage = document.getElementById('taskExecutionPage');
    const todoListElement = document.getElementById('todoList');
    const currentTodoElement = document.getElementById('currentTodo');
    const completedTodosElement = document.getElementById('completedTodos');
    const availableFilesElement = document.getElementById('fileList');
    const fileContentElement = document.getElementById('fileContent');
    const chatMessagesElement = document.getElementById('chatMessages');
    const messageInputElement = document.getElementById('todoMessageInput');
    const sendMessageButton = document.getElementById('sendTodoMessage');
    const completeTodoButton = document.getElementById('completeTodo');
    const selectFolderButton = document.getElementById('selectFolder');
    const folderPathElement = document.getElementById('folderPath');
    const refreshFilesButton = document.getElementById('refreshFiles');
    const openInFinderButton = document.getElementById('openInFinder');
    
    // State variables
    let todoList = {};
    let currentTodoIndex = 0;
    let completedTodos = [];
    let globalContext = '';
    let availableFiles = [];
    let fileDescriptions = {};
    let conversationHistory = [];
    let selectedFilePath = null;
    
    /**
     * Initialize the to-do execution UI.
     */
    async function initialize() {
      try {
        window.addEventListener('initialize-task-execution', initializeTaskExecution);
        
        // Set up folder selection
        selectFolderButton.addEventListener('click', selectProjectFolder);
        refreshFilesButton.addEventListener('click', refreshFileList);
        openInFinderButton.addEventListener('click', openSelectedFileInFinder);
        
        // Set up message sending
        sendMessageButton.addEventListener('click', sendUserMessage);
        messageInputElement.addEventListener('keydown', handleMessageKeydown);
        
        // Set up task completion
        completeTodoButton.addEventListener('click', completeTodoItem);
        
        // Disable folder-related buttons initially
        refreshFilesButton.disabled = true;
        openInFinderButton.disabled = true;
      } catch (error) {
        console.error('Error setting up todo execution:', error);
        showErrorMessage('Failed to initialize task execution system');
      }
    }
    
    /**
     * Initialize the task execution when navigating to the page
     */
    async function initializeTaskExecution() {
      try {
        // Reset state
        currentTodoIndex = 0;
        completedTodos = [];
        conversationHistory = [];
        
        // Show loading state
        todoListElement.innerHTML = '<div class="loading-spinner centered"></div>';
        currentTodoElement.innerHTML = '<div class="loading-spinner centered"></div>';
        
        // Load global context
        const globalContextResult = await window.electronAPI.readGlobalContext();
        if (globalContextResult.success) {
          globalContext = globalContextResult.content;
        } else {
          console.warn('Failed to load global context:', globalContextResult.error);
          showNotification('Warning: Could not load global context. Some features may be limited.');
        }
        
        // Load to-do list
        const todoListResult = await window.electronAPI.readTodoList();
        if (todoListResult.success) {
          todoList = todoListResult.todoJson;
          renderTodoList();
        } else {
          console.warn('Failed to load to-do list:', todoListResult.error);
          showErrorMessage('Failed to load to-do list. Please check if it was created properly.');
        }
        
        // If a project folder was already selected, refresh the file list
        if (folderPathElement.textContent !== 'None selected') {
          await refreshFileList();
        }
        
        // Clear chat area
        chatMessagesElement.innerHTML = `
          <div class="welcome-message">
            <h3>Ready to start working on this task!</h3>
            <p>Please select a project folder to begin, then click on a task from the to-do list.</p>
          </div>
        `;
      } catch (error) {
        console.error('Error initializing task execution:', error);
        showErrorMessage('Failed to initialize task execution: ' + error.message);
      }
    }
    
    /**
     * Select a project folder
     */
    async function selectProjectFolder() {
      try {
        const folderPath = await window.electronAPI.selectFolder();
        if (folderPath) {
          folderPathElement.textContent = folderPath;
          refreshFilesButton.disabled = false;
          await refreshFileList();
          
          // Generate file descriptions for all files
          addMessage('Generating file descriptions for all files in the project...', 'system');
          const count = await window.electronAPI.generateAllFileDescriptions();
          addMessage(`Generated descriptions for ${count} files.`, 'system');
          
          // Refresh the file list to show descriptions
          await loadAvailableFiles();
        }
      } catch (error) {
        console.error('Error selecting folder:', error);
        showErrorMessage('Failed to select folder: ' + error.message);
      }
    }
    
    /**
     * Refresh the file list
     */
    async function refreshFileList() {
      try {
        if (folderPathElement.textContent === 'None selected') {
          return;
        }
        
        await loadAvailableFiles();
      } catch (error) {
        console.error('Error refreshing file list:', error);
        showErrorMessage('Failed to refresh file list: ' + error.message);
      }
    }
    
    /**
     * Open the selected file in the native file explorer
     */
    async function openSelectedFileInFinder() {
      if (!selectedFilePath) {
        showNotification('Please select a file first');
        return;
      }
      
      try {
        // This would need implementation in the main process
        // For now, we'll just show a notification
        showNotification('Opening file in explorer: ' + selectedFilePath);
        
        // In a real implementation, we would call something like:
        // await window.electronAPI.openInFileExplorer(selectedFilePath);
      } catch (error) {
        console.error('Error opening file in explorer:', error);
        showErrorMessage('Failed to open file in explorer: ' + error.message);
      }
    }
    
    /**
     * Loads available files and their descriptions.
     */
    async function loadAvailableFiles() {
      try {
        // Show loading state
        availableFilesElement.innerHTML = '<div class="loading-spinner centered"></div>';
        
        // Get file structure
        availableFiles = await window.electronAPI.scanDirectory();
        
        // Get file descriptions
        fileDescriptions = await window.electronAPI.getAllFileDescriptions();
        
        // Render the file browser
        renderAvailableFiles();
      } catch (error) {
        console.error('Error loading files:', error);
        availableFilesElement.innerHTML = `<div class="error-message">Error loading files: ${error.message}</div>`;
      }
    }
    
    /**
     * Renders the to-do list in the UI.
     */
    function renderTodoList() {
      todoListElement.innerHTML = '';
      
      // Extract all tasks from categories
      const allTasks = [];
      for (const [category, tasks] of Object.entries(todoList)) {
        if (Array.isArray(tasks)) {
          tasks.forEach(task => {
            allTasks.push({
              category,
              ...task
            });
          });
        }
      }
      
      // Display each task
      allTasks.forEach((task, index) => {
        const todoItem = document.createElement('div');
        todoItem.className = 'todo-item';
        
        if (index === currentTodoIndex) {
          todoItem.classList.add('current');
        } else if (completedTodos.includes(index)) {
          todoItem.classList.add('completed');
        }
        
        todoItem.innerHTML = `
          <h4>${task.task}</h4>
          <p class="category">${task.category}</p>
        `;
        
        todoItem.addEventListener('click', () => selectTodoItem(index));
        
        todoListElement.appendChild(todoItem);
      });
      
      // Show current todo details
      if (allTasks.length > 0) {
        const currentTask = allTasks[currentTodoIndex];
        currentTodoElement.innerHTML = `
          <h3>${currentTask.task}</h3>
          <p class="summary">${currentTask.summary || 'No summary available'}</p>
          <p class="category">Category: ${currentTask.category}</p>
        `;
      } else {
        currentTodoElement.innerHTML = '<p>No tasks available</p>';
      }
      
      // Show completed tasks
      completedTodosElement.innerHTML = '';
      if (completedTodos.length > 0) {
        const list = document.createElement('ul');
        completedTodos.forEach(index => {
          if (allTasks[index]) {
            const item = document.createElement('li');
            item.textContent = allTasks[index].task;
            list.appendChild(item);
          }
        });
        completedTodosElement.appendChild(list);
      } else {
        completedTodosElement.textContent = 'No completed tasks yet';
      }
    }
    
    /**
     * Renders the available files list.
     */
    function renderAvailableFiles() {
      availableFilesElement.innerHTML = '';
      
      if (!availableFiles || availableFiles.length === 0) {
        availableFilesElement.innerHTML = '<p>No files available. Please select a project folder.</p>';
        return;
      }
      
      function renderFileTree(items, container) {
        items.forEach(item => {
          const itemElement = document.createElement('div');
          itemElement.className = item.type === 'directory' ? 'file-tree-directory' : 'file-tree-file';
          itemElement.classList.add('file-tree-item');
          
          // Create header element
          const headerElement = document.createElement('div');
          headerElement.className = 'file-tree-header';
          headerElement.textContent = item.name;
          
          // Add event listener for selection
          headerElement.addEventListener('click', (e) => {
            // Remove previous selection
            document.querySelectorAll('.file-tree-header.selected').forEach(el => {
              el.classList.remove('selected');
            });
            
            // Add selected class
            headerElement.classList.add('selected');
            
            // Set selected file path
            selectedFilePath = item.path;
            
            // Enable open in finder button
            openInFinderButton.disabled = false;
            
            // If it's a file, handle file opening
            if (item.type === 'file') {
              openFile(item.path);
              
              // Stop event propagation
              e.stopPropagation();
            }
          });
          
          itemElement.appendChild(headerElement);
          
          // Add description for files
          if (item.type === 'file' && fileDescriptions[item.path]) {
            const descElement = document.createElement('div');
            descElement.className = 'file-description';
            
            // Limit description length for UI
            const desc = fileDescriptions[item.path];
            const shortDesc = desc.length > 150 ? desc.substring(0, 150) + '...' : desc;
            
            descElement.textContent = shortDesc;
            
            // Add tooltip for full description
            descElement.title = desc;
            
            itemElement.appendChild(descElement);
          }
          
          // Handle directories
          if (item.type === 'directory' && item.children) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'file-tree-children';
            childrenContainer.style.display = 'none';
            
            // Toggle children on header click
            headerElement.addEventListener('click', (e) => {
              childrenContainer.style.display = childrenContainer.style.display === 'none' ? 'block' : 'none';
              headerElement.classList.toggle('expanded');
              e.stopPropagation();
            });
            
            renderFileTree(item.children, childrenContainer);
            itemElement.appendChild(childrenContainer);
          }
          
          container.appendChild(itemElement);
        });
      }
      
      renderFileTree(availableFiles, availableFilesElement);
    }
    
    /**
     * Opens a file and displays its content.
     */
    async function openFile(filePath) {
      try {
        const result = await window.electronAPI.readFile(filePath);
        if (result.success) {
          // Display file content
          const fileDisplay = document.createElement('textarea');
          fileDisplay.value = result.content;
          fileDisplay.readonly = true;
          fileDisplay.className = 'file-content-display';
          
          // Replace any existing file display
          const existingDisplay = document.querySelector('.file-content-display');
          if (existingDisplay) {
            existingDisplay.remove();
          }
          
          // Add to chat as a system message
          const fileMessage = document.createElement('div');
          fileMessage.className = 'chat-message system-message';
          fileMessage.innerHTML = `
            <div class="file-header">
              <span>File: ${filePath}</span>
              <button class="close-file-btn">×</button>
            </div>
          `;
          fileMessage.appendChild(fileDisplay);
          chatMessagesElement.appendChild(fileMessage);
          
          // Add close button functionality
          fileMessage.querySelector('.close-file-btn').addEventListener('click', () => {
            fileMessage.remove();
          });
          
          // Scroll to the file
          chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
        } else {
          showErrorMessage(`Error opening file: ${result.error}`);
        }
      } catch (error) {
        console.error('Error opening file:', error);
        showErrorMessage('Failed to open file: ' + error.message);
      }
    }
    
    /**
     * Selects a to-do item to work on.
     */
    function selectTodoItem(index) {
      currentTodoIndex = index;
      renderTodoList();
      
      // Clear chat history
      conversationHistory = [];
      chatMessagesElement.innerHTML = '';
      
      // Start the AI assistance
      initiateToDoAssistance();
    }
    
    /**
     * Starts AI assistance for the current to-do item.
     */
    async function initiateToDoAssistance() {
      try {
        // Extract all tasks
        const allTasks = [];
        for (const [category, tasks] of Object.entries(todoList)) {
          if (Array.isArray(tasks)) {
            tasks.forEach(task => {
              allTasks.push({
                category,
                ...task
              });
            });
          }
        }
        
        const currentTask = allTasks[currentTodoIndex];
        const completedTaskItems = completedTodos.map(index => allTasks[index]);
        
        // Show thinking message
        addMessage('Analyzing task and preparing assistance...', 'ai');
        
        // Prepare the prompt
        const promptTemplate = await loadPrompt('prompts/task-breakdown/todo-execution.txt', {
          globalContext: globalContext,
          currentItem: JSON.stringify(currentTask, null, 2),
          todoListProgress: JSON.stringify(
            { current: currentTask, completed: completedTaskItems },
            null, 
            2
          ),
          availableFiles: JSON.stringify(fileDescriptions, null, 2),
          conversationHistory: ''
        });
        
        // Send to AI
        const response = await window.electronAPI.sendMessage(
          promptTemplate,
          'deepseek/deepseek-chat-v3-0324:free',
          null,
          false
        );
        
        // Process commands in the response
        const commandResults = await window.electronAPI.processAIResponse(response);
        
        // Update file list if any commands were executed
        if (commandResults.some(r => r.result.success)) {
          await loadAvailableFiles();
        }
        
        // Update the chat with AI's response
        chatMessagesElement.innerHTML = ''; // Clear thinking message
        addMessage(response, 'ai');
        
        // Add to conversation history
        conversationHistory.push({
          role: 'assistant',
          content: response
        });
        
      } catch (error) {
        console.error('Error initiating to-do assistance:', error);
        chatMessagesElement.innerHTML = '';
        addMessage(`Error: ${error.message}`, 'error');
      }
    }
    
    /**
     * Adds a message to the chat.
     */
    function addMessage(text, sender) {
      const messageElement = document.createElement('div');
      messageElement.className = `chat-message ${sender}-message`;
      
      const messageContent = document.createElement('div');
      messageContent.className = 'message-content';
      messageContent.textContent = text;
      
      messageElement.appendChild(messageContent);
      chatMessagesElement.appendChild(messageElement);
      
      // Scroll to bottom
      chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
    }
    
    /**
     * Handle keydown events in the message input
     */
    function handleMessageKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendUserMessage();
      }
    }
    
    /**
     * Sends a user message to the AI.
     */
    async function sendUserMessage() {
      const message = messageInputElement.value.trim();
      if (!message) return;
      
      try {
        // Add user message to UI
        addMessage(message, 'user');
        
        // Add to conversation history
        conversationHistory.push({
          role: 'user',
          content: message
        });
        
        // Clear input
        messageInputElement.value = '';
        
        // Add thinking message
        addMessage('AI is thinking...', 'ai');
        
        // Extract all tasks
        const allTasks = [];
        for (const [category, tasks] of Object.entries(todoList)) {
          if (Array.isArray(tasks)) {
            tasks.forEach(task => {
              allTasks.push({
                category,
                ...task
              });
            });
          }
        }
        
        const currentTask = allTasks[currentTodoIndex];
        const completedTaskItems = completedTodos.map(index => allTasks[index]);
        
        // Prepare the conversation history
        const historyText = conversationHistory
          .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
          .join('\n\n');
        
        // Prepare the prompt
        const promptTemplate = await loadPrompt('prompts/task-breakdown/todo-execution.txt', {
          globalContext: globalContext,
          currentItem: JSON.stringify(currentTask, null, 2),
          todoListProgress: JSON.stringify(
            { current: currentTask, completed: completedTaskItems },
            null, 
            2
          ),
          availableFiles: JSON.stringify(fileDescriptions, null, 2),
          conversationHistory: historyText
        });
        
        // Send to AI
        const response = await window.electronAPI.sendMessage(
          promptTemplate,
          'deepseek/deepseek-chat-v3-0324:free',
          null,
          false
        );
        
        // Process commands in the response
        const commandResults = await window.electronAPI.processAIResponse(response);
        
        // Update file list if any commands were executed
        if (commandResults.some(r => r.result.success)) {
          await loadAvailableFiles();
        }
        
        // Update the chat with AI's response
        chatMessagesElement.removeChild(chatMessagesElement.lastChild); // Remove thinking message
        addMessage(response, 'ai');
        
        // Add to conversation history
        conversationHistory.push({
          role: 'assistant',
          content: response
        });
        
      } catch (error) {
        console.error('Error sending message:', error);
        
        // Remove thinking message
        chatMessagesElement.removeChild(chatMessagesElement.lastChild);
        
        addMessage(`Error: ${error.message}`, 'error');
      }
    }
    
    /**
     * Completes the current to-do item.
     */
    async function completeTodoItem() {
      try {
        // Extract all tasks
        const allTasks = [];
        for (const [category, tasks] of Object.entries(todoList)) {
          if (Array.isArray(tasks)) {
            tasks.forEach(task => {
              allTasks.push({
                category,
                ...task
              });
            });
          }
        }
        
        const currentTask = allTasks[currentTodoIndex];
        
        // Add system message
        addMessage('Performing sanity check...', 'system');
        
        // Prepare conversation history
        const historyText = conversationHistory
          .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
          .join('\n\n');
        
        // Prepare the prompt
        const promptTemplate = await loadPrompt('prompts/sanity-checks/sanity-check.txt', {
          globalContext: globalContext,
          todoList: JSON.stringify(todoList, null, 2),
          completedItem: JSON.stringify(currentTask, null, 2),
          conversationHistory: historyText
        });
        
        // Send to AI
        const response = await window.electronAPI.sendMessage(
          promptTemplate,
          'deepseek/deepseek-chat-v3-0324:free',
          null,
          false
        );
        
        // Parse the response
        let sanityResult;
        try {
          sanityResult = JSON.parse(response);
        } catch (e) {
          console.error('Failed to parse sanity check result:', e);
          addMessage('Error: Could not parse sanity check result. Please try again.', 'error');
          return;
        }
        
        // Display result
        addMessage(`Sanity check completed: ${sanityResult.explanation}`, 'system');
        
        // Update global context if needed
        if (sanityResult.updateGlobalContext && sanityResult.suggestedGlobalContextUpdates) {
          globalContext = sanityResult.suggestedGlobalContextUpdates;
          await window.electronAPI.saveGlobalContext(globalContext);
          addMessage('Global context has been updated.', 'system');
        }
        
        // Update to-do list if needed
        if (sanityResult.updateTodoList && sanityResult.suggestedTodoListUpdates) {
          todoList = JSON.parse(sanityResult.suggestedTodoListUpdates);
          await window.electronAPI.saveTodoList(todoList);
          addMessage('To-do list has been updated.', 'system');
        }
        
        // Mark as completed if successful
        if (sanityResult.taskSuccessful) {
          if (!completedTodos.includes(currentTodoIndex)) {
            completedTodos.push(currentTodoIndex);
          }
          
          // Move to next to-do if available
          if (currentTodoIndex < allTasks.length - 1) {
            currentTodoIndex++;
            
            // Clear conversation history
            conversationHistory = [];
            
            // Re-render the UI
            renderTodoList();
            
            // Start the next to-do
            setTimeout(initiateToDoAssistance, 1000);
          } else {
            addMessage('Congratulations! All tasks have been completed.', 'system');
          }
        }
      } catch (error) {
        console.error('Error completing to-do item:', error);
        addMessage(`Error: ${error.message}`, 'error');
      }
    }
    
    /**
     * Show a notification message
     */
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
    
    /**
     * Show an error message
     */
    function showErrorMessage(message) {
      addMessage(message, 'error');
    }
    
    // Initialize the component
    initialize();
    
    // Return public API
    return {
      initialize,
      selectTodoItem
    };
  }