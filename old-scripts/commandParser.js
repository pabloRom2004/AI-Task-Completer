/**
 * Command Parser module
 * Parses and validates AI-generated commands for file operations
 * Enhanced with improved file detection and debugging
 */
const path = require('path');

class CommandParser {
  constructor(fileSystem) {
    this.fileSystem = fileSystem;
  }
  
  /**
   * Parse commands from AI response text
   * @param {string} responseText - AI response text
   * @returns {Array} Array of parsed commands
   */
  parseCommands(responseText) {
    // Look for JSON command blocks in the response
    const commands = [];
    const jsonPattern = /```json\s*(\{[\s\S]*?\})\s*```|(\{[\s\S]*?"command"[\s\S]*?\})/g;
    
    let match;
    while ((match = jsonPattern.exec(responseText)) !== null) {
      const jsonStr = match[1] || match[2];
      
      try {
        const command = JSON.parse(jsonStr);
        
        // Only collect valid commands
        if (this.isValidCommand(command)) {
          commands.push(command);
        }
      } catch (error) {
        console.error('Error parsing command JSON:', error);
      }
    }
    
    return commands;
  }
  
  /**
   * Check if a command has a valid structure
   * @param {Object} command - Command object
   * @returns {boolean} True if command is valid
   */
  isValidCommand(command) {
    if (!command || typeof command !== 'object') {
      return false;
    }
    
    if (!command.command) {
      return false;
    }
    
    // Check for required fields based on command type
    switch (command.command) {
      case 'Create':
        return command.fileName && command.content !== undefined;
      case 'Modify':
        return command.fileName && command.newContent !== undefined;
      case 'Delete':
        return command.fileName !== undefined;
      default:
        return false;
    }
  }
  
  /**
   * Execute file commands from an AI response
   * @param {string} aiResponse - Full AI response text
   * @returns {Promise<Object>} Execution results
   */
  async executeCommandsFromResponse(aiResponse) {
    const commands = this.parseCommands(aiResponse);
    
    if (commands.length === 0) {
      return { success: true, commands: 0, message: 'No commands found' };
    }
    
    const results = [];
    let hasErrors = false;
    
    for (const command of commands) {
      const result = await this.fileSystem.executeCommand(command);
      results.push({
        command: command.command,
        fileName: command.fileName,
        success: result.success,
        error: result.error,
        fileRef: result.fileRef
      });
      
      if (!result.success) {
        hasErrors = true;
      }
    }
    
    return {
      success: !hasErrors,
      commands: commands.length,
      results
    };
  }
  
  /**
   * Process file open requests from AI response
   * @param {string} aiResponse - AI response text
   * @returns {Promise<Object>} Processing results
   */
  async processFileRequests(aiResponse) {
    // DEBUG: Log what we're processing
    console.log('\n=== DEBUG: Processing file requests ===');
    console.log('First 200 chars of response:');
    console.log(aiResponse.substring(0, 200) + (aiResponse.length > 200 ? '...' : ''));
    
    // Look for file open requests with a more flexible pattern
    const openPattern = /open\s+(?:the\s+)?(?:file:?\s+)?["']?([^"'<>\n\r]+\.[a-zA-Z0-9]+)["']?/gi;
    
    const openRequests = [];
    let match;
    
    while ((match = openPattern.exec(aiResponse)) !== null) {
      const fileName = match[1].trim();
      openRequests.push(fileName);
      console.log(`DEBUG: Found file request: ${fileName}`);
    }
    
    // If no standard file requests found, try an aggressive pattern
    if (openRequests.length === 0) {
      console.log('DEBUG: No standard file open requests found, trying aggressive pattern');
      // Look for any text that might be referring to a file
      const aggressivePattern = /(?:check|look at|examine|read|view)\s+["']?([a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+)["']?/gi;
      
      while ((match = aggressivePattern.exec(aiResponse)) !== null) {
        const fileName = match[1].trim();
        openRequests.push(fileName);
        console.log(`DEBUG: Found potential file reference with aggressive pattern: ${fileName}`);
      }
    }
    
    // Process unique file requests
    const uniqueRequests = [...new Set(openRequests)];
    const results = [];
    
    console.log(`DEBUG: Processing ${uniqueRequests.length} unique file requests`);
    
    for (const fileName of uniqueRequests) {
      // Get the registry to find the file
      const registry = await this.fileSystem.getFileRegistry();
      
      console.log(`DEBUG: Looking for ${fileName} in registry with ${registry.files.length} files`);
      
      // Try to find the file by name or path
      const baseName = path.basename(fileName);
      const fileRef = registry.files.find(f => 
        f.name === fileName || 
        path.basename(f.originalPath) === baseName || 
        f.originalPath.endsWith(fileName)
      );
      
      if (fileRef) {
        console.log(`DEBUG: Found file ${fileName} with ID ${fileRef.id}`);
        
        try {
          // Read the file content
          const result = await this.fileSystem.readFile(fileRef.id);
          
          console.log(`DEBUG: Read result: ${result.success ? 'SUCCESS' : 'FAILURE'}`);
          
          if (result.success) {
            console.log(`DEBUG: Content preview: ${result.content.substring(0, 50)}...`);
          }
          
          results.push({
            fileName,
            fileRef,
            success: result.success,
            content: result.content,
            error: result.error
          });
        } catch (error) {
          console.error(`Error reading file ${fileName}:`, error);
          results.push({
            fileName,
            fileRef,
            success: false,
            error: error.message
          });
        }
      } else {
        console.log(`DEBUG: File not found: ${fileName}`);
        console.log(`DEBUG: Available files: ${registry.files.map(f => f.name).join(', ')}`);
        
        results.push({
          fileName,
          success: false,
          error: 'File not found'
        });
      }
    }
    
    console.log(`DEBUG: Processed ${results.length} file requests with ${results.filter(r => r.success).length} successful opens`);
    
    return {
      success: true,
      requests: uniqueRequests.length,
      results
    };
  }
}

module.exports = CommandParser;