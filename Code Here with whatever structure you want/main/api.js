// src/main/api.js
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs').promises;

// Store the API client
let aiClient = null;
// Track conversation history
let conversationHistory = [];

/**
 * Sets the API key for AI services.
 * If no API key is provided, it uses the environment variable "Open-Router-API".
 */
function setApiKey(apiKey) {
  if (!apiKey) {
    apiKey = process.env["Open-Router-API"];
  }
  try {
    aiClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey
    });
    return { success: true };
  } catch (error) {
    console.error('Error setting API key:', error);
    return { success: false, error: error.message };
  }
}

// Initialize with env var if present
if (!aiClient) {
  const envApiKey = process.env["Open-Router-API"];
  if (envApiKey) {
    setApiKey(envApiKey);
  }
}

/**
 * Extract and execute file commands from assistant response
 * Uses the fileSystem module passed as parameter to avoid circular dependencies
 * @param {string} assistantResponse - The assistant's response text
 * @param {Object} fileSystem - The fileSystem module
 * @returns {Promise<string|null>} The file content or null if no command found
 */
async function processFileCommands(assistantResponse, fileSystem) {
  // Look for file commands in the format: `open file: filename.ext`
  const fileCommandRegex = /`?open\s+file:?\s+([^`\n]+)`?/i;
  const match = assistantResponse.match(fileCommandRegex);
  
  if (match && match[1]) {
    const fileName = match[1].trim();
    
    try {
      // First try to find file in the project
      const projectDir = fileSystem.getProjectDirectory();
      if (projectDir) {
        // Check if file exists in project directory
        const filePath = path.join(projectDir, fileName);
        try {
          const content = await fs.readFile(filePath, 'utf8');
          return `Here's the content of ${fileName}:\n\n${content}`;
        } catch (err) {
          // If not found in project directory root, try to search for it
          const fileListResult = await fileSystem.listFiles();
          if (fileListResult.success) {
            const matchingFile = fileListResult.files.find(file => 
              file.name === fileName || file.relativePath === fileName
            );
            
            if (matchingFile) {
              try {
                const content = await fs.readFile(matchingFile.path, 'utf8');
                return `Here's the content of ${matchingFile.relativePath}:\n\n${content}`;
              } catch (err) {
                return `Error: Could not read file ${fileName}: ${err.message}`;
              }
            }
          }
        }
      }
      
      // If no project directory, try to read from absolute path
      try {
        const content = await fs.readFile(fileName, 'utf8');
        return `Here's the content of ${fileName}:\n\n${content}`;
      } catch (err) {
        return `Error: Could not find or read file ${fileName}: ${err.message}`;
      }
    } catch (error) {
      return `Error: Could not process file command: ${error.message}`;
    }
  }
  
  return null;
}

/**
 * Extract JSON from AI response text for title extraction
 * @param {string} text - The response text
 * @returns {Object|null} Parsed JSON object or null if not found/invalid
 */
function extractJsonFromResponse(text) {
  try {
    // Look for a complete JSON object
    const jsonRegex = /{(?:[^{}]|{[^{}]*})*}/g;
    const matches = text.match(jsonRegex);
    
    if (matches && matches.length > 0) {
      // Try each match until one parses correctly
      for (const match of matches) {
        try {
          return JSON.parse(match);
        } catch (e) {
          console.log(`Failed to parse JSON match: ${match}`);
          // Continue to next match
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting JSON from response:', error);
    return null;
  }
}

/**
 * Sends a message to the AI API with optional streaming support.
 * Added file system parameter to avoid circular dependencies
 */
async function sendMessage(message, model = "deepseek/deepseek-chat-v3-0324:free", updateCallback, streamEnabled = true, fileSystem = null, fileDescriptions = null) {
  if (!aiClient) {
    return "Error: API key not set. Please set API key first.";
  }

  // Avoid duplicate calls for the same message
  const messageHash = hashString(message);
  if (lastMessageHash === messageHash && lastMessageTimestamp > Date.now() - 2000) {
    console.log('Duplicate message detected, ignoring');
    return "Duplicate message detected, request already in progress...";
  }
  
  lastMessageHash = messageHash;
  lastMessageTimestamp = Date.now();

  // Resolve circular dependency by requiring modules here if not provided
  if (!fileSystem) {
    fileSystem = require('./fileSystem');
  }
  
  if (!fileDescriptions) {
    fileDescriptions = require('./fileDescriptions');
  }

  try {
    // Get project directory
    const projectDir = fileSystem.getProjectDirectory();
    const isFirstMessage = !projectDir;
    
    // Base system message
    let systemMessage = "You are a helpful assistant tasked with helping implement and execute complex tasks. Your goal is to provide clear, accurate, and helpful responses to assist with the current project.";
    
    // Add file handling instructions
    const fileHandlingPromptPath = path.join(__dirname, '../../prompts/file-handling.txt');
    try {
      const fileHandlingPrompt = await fs.readFile(fileHandlingPromptPath, 'utf8');
      systemMessage += "\n\n" + fileHandlingPrompt;
    } catch (error) {
      console.warn('Could not read file handling prompt:', error.message);
    }
    
    // Build messages array, starting with system message
    let messages = [
      { role: "system", content: systemMessage }
    ];
    
    // Add conversation history
    messages = messages.concat(conversationHistory);
    
    // Add current message
    messages.push({ role: "user", content: message });
    
    // If first message, don't append file context yet - it will be created with project
    if (!isFirstMessage) {
      // Add file context if files exist
      const fileListResult = await fileSystem.listFiles();
      if (fileListResult.success && fileListResult.files.length > 0) {
        let fileContext = "\n\nAVAILABLE FILES:\n";
        
        for (const file of fileListResult.files) {
          fileContext += `- ${file.relativePath}: ${file.description || "No description available"}\n`;
        }
        
        // Update the system message with file context
        messages[0].content += fileContext;
      }
    }
    
    // Final request body
    const requestBody = {
      model: model,
      messages: messages,
      stream: streamEnabled
    };

    console.log('Sending request to API with body:', JSON.stringify(requestBody, null, 2));

    if (streamEnabled) {
      // Streaming mode
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${aiClient.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}):`, errorText);
        throw new Error(`API request failed with status: ${response.status}. Details: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          
          while (true) {
            const lineEnd = buffer.indexOf('\n');
            if (lineEnd === -1) break;
            const line = buffer.slice(0, lineEnd).trim();
            buffer = buffer.slice(lineEnd + 1);
            if (!line || line.startsWith(':')) continue;
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || '';
                if (content) {
                  fullResponse += content;
                  if (updateCallback) {
                    updateCallback(fullResponse);
                  }
                }
              } catch (e) {
                console.error('Error parsing streaming data:', e);
              }
            }
          }
        }
      } finally {
        reader.cancel();
      }
      
      // Add to conversation history
      conversationHistory.push({ role: "user", content: message });
      conversationHistory.push({ role: "assistant", content: fullResponse });
      
      // After first message, create project if needed
      if (isFirstMessage) {
        try {
          // Try to extract JSON from AI response for title
          let title = '';
          let projectName = '';
          
          const jsonData = extractJsonFromResponse(fullResponse);
          if (jsonData && jsonData.title) {
            title = jsonData.title;
            console.log(`Extracted title from JSON: ${title}`);
            
            projectName = title
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '_')
              .replace(/_+/g, '_')
              .substring(0, 30);
          } else {
            // If no JSON title found, use first line or part of message
            title = message.split('\n')[0].trim().substring(0, 50);
            if (title.length < 10 && fullResponse.length > 0) {
              // Try to get title from response
              title = fullResponse.split('\n')[0].trim().substring(0, 50);
            }
            
            // Create a sanitized project name
            projectName = title
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '_')
              .replace(/_+/g, '_')
              .substring(0, 30);
          }
          
          // Create the project
          await fileSystem.finalizeFirstMessage(projectName, title);
        } catch (error) {
          console.error('Error creating project after first message:', error);
        }
      }
      
      // Check if there are file commands to process
      const fileContent = await processFileCommands(fullResponse, fileSystem);
      if (fileContent) {
        // Add the file content as a user message
        conversationHistory.push({ role: "user", content: fileContent });
        return { 
          response: fullResponse, 
          fileContent: fileContent 
        };
      }
      
      return fullResponse;
    } else {
      // Non-streaming mode (implementation similar to streaming with appropriate adjustments)
      // ...
    }
  } catch (error) {
    console.error('Error calling API:', error);
    return `Error: ${error.message}`;
  }
}

// Simple string hashing function to detect duplicate messages
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

// Track last message to prevent duplicates
let lastMessageHash = null;
let lastMessageTimestamp = 0;

/**
 * Reset conversation history (for new project)
 */
function resetConversation() {
  conversationHistory = [];
}

/**
 * Get current conversation history
 */
function getConversationHistory() {
  return [...conversationHistory];
}

module.exports = {
  setApiKey,
  sendMessage,
  resetConversation,
  getConversationHistory
};