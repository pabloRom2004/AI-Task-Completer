/**
 * Task Handler module
 * Coordinates the task execution workflow between components
 */
const fs = require('fs').promises;
const path = require('path');
const AIClient = require('./api.js');
const FileSystem = require('./fileSystem.js');
const CommandParser = require('./commandParser.js');

class TaskHandler {
  constructor(config = {}) {
    // Initialize components
    this.fileSystem = new FileSystem();
    this.commandParser = new CommandParser(this.fileSystem);
    this.aiClient = new AIClient({
      apiKey: config.apiKey || '',
      model: config.model || 'deepseek/deepseek-chat-v3-0324:free'
    });
    
    // Connect components
    this.aiClient.setComponents(this.fileSystem, this.commandParser);
    
    // Task state
    this.currentProject = null;
    this.projectPath = null;
  }
  
  /**
   * Set the current project
   * @param {string} projectId - Project ID
   */
  async setProject(projectId) {
    try {
      const result = await this.fileSystem.setCurrentProject(projectId);
      
      if (result.success) {
        this.currentProject = projectId;
        this.projectPath = this.fileSystem.getCurrentProjectPath();
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error setting project:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Create a new project
   * @param {string} projectName - Project name
   * @param {string} title - Project title
   */
  async createProject(projectName, title) {
    try {
      // TODO: Implement project creation logic
      // This would typically be handled by a projectManager module
      
      // For now, just set the current project
      await this.setProject(projectName);
      
      return { success: true, projectId: projectName };
    } catch (error) {
      console.error('Error creating project:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Generate descriptions for all files in the current project
   * @returns {Promise<Object>} Generation results
   */
  async generateFileDescriptions() {
    try {
      if (!this.currentProject) {
        return { success: false, error: 'No current project' };
      }
      
      // Get file registry
      const registry = await this.fileSystem.getFileRegistry();
      
      if (!registry.files || registry.files.length === 0) {
        return { success: true, message: 'No files to process' };
      }
      
      console.log(`Generating descriptions for ${registry.files.length} files...`);
      
      // Process each file
      const results = [];
      
      for (const fileRef of registry.files) {
        console.log(`Processing file: ${fileRef.name}`);
        
        // Skip binary files
        if (this.fileSystem.isLikelyBinaryFile(fileRef.originalPath)) {
          console.log(`Skipping binary file: ${fileRef.name}`);
          continue;
        }
        
        try {
          // Read file content
          const fileResult = await this.fileSystem.readFile(fileRef.id);
          
          if (fileResult.success) {
            // Generate description using AI
            console.log(`Generating description for: ${fileRef.name}`);
            console.log(`Input to model: ${fileRef.name} (first 50 chars of content): ${fileResult.content.substring(0, 50)}...`);
            
            const description = await this.aiClient.generateFileDescription(
              fileRef,
              fileResult.content
            );
            
            console.log(`Output from model (description): ${description.substring(0, 100)}...`);
            
            // Update file description in registry
            await this.fileSystem.updateFileDescription(fileRef.id, description);
            
            results.push({
              fileName: fileRef.name,
              success: true,
              description: description.substring(0, 100) + '...'
            });
          } else {
            console.log(`Error reading file: ${fileRef.name}: ${fileResult.error}`);
            results.push({
              fileName: fileRef.name,
              success: false,
              error: fileResult.error
            });
          }
        } catch (error) {
          console.error(`Error processing file ${fileRef.name}:`, error);
          results.push({
            fileName: fileRef.name,
            success: false,
            error: error.message
          });
        }
      }
      
      return {
        success: true,
        results,
        processedFiles: results.filter(r => r.success).length,
        failedFiles: results.filter(r => !r.success).length
      };
    } catch (error) {
      console.error('Error generating file descriptions:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Start the task execution workflow
   * @param {string} taskDescription - Initial task description
   * @returns {Promise<Object>} Execution results
   */
  async beginTaskExecution(taskDescription) {
    try {
      if (!this.currentProject) {
        return { success: false, error: 'No current project' };
      }
      
      console.log('Beginning task execution workflow');
      console.log(`Task description: ${taskDescription}`);
      
      // Step 1: Generate file descriptions if not already done
      console.log('Step 1: Ensuring file descriptions are generated');
      const descriptionResult = await this.generateFileDescriptions();
      
      if (!descriptionResult.success) {
        return { success: false, error: descriptionResult.error };
      }
      
      // Step 2: Load task clarification prompt
      console.log('Step 2: Loading task clarification prompt');
      const taskClarificationPrompt = await this.aiClient.loadPrompt('task-clarification');
      
      if (!taskClarificationPrompt) {
        return { success: false, error: 'Failed to load task clarification prompt' };
      }
      
      // Step 3: Generate follow-up questions
      console.log('Step 3: Generating follow-up questions');
      
      // Reset conversation history
      this.aiClient.resetConversation();
      
      // Create system message with task clarification prompt and file information
      const fileInfo = await this.aiClient.prepareFileInformation();
      
      const systemMessage = `${taskClarificationPrompt}\n\n${fileInfo}`;
      
      // Add system message to conversation
      this.aiClient.conversationHistory.push({
        role: 'system',
        content: systemMessage
      });
      
      // Process initial message
      console.log('Sending initial message to AI model...');
      
      const result = await this.aiClient.processMessage(taskDescription);
      
      console.log('Raw model output:');
      console.log('-----------------');
      console.log(result.response);
      console.log('-----------------');
      
      // Log file interactions
      if (result.openedFiles && result.openedFiles.length > 0) {
        console.log('\nFiles opened:');
        for (const file of result.openedFiles) {
          console.log(`- ${file.name}`);
        }
      } else {
        console.log('\nNo files were opened during this interaction.');
      }
      
      // Check for any commands executed
      if (result.executedCommands && result.executedCommands.length > 0) {
        console.log('\nCommands executed:');
        for (const cmd of result.executedCommands) {
          console.log(`- ${cmd.command}: ${cmd.fileName} (${cmd.success ? 'Success' : 'Failed'})`);
        }
      } else {
        console.log('\nNo commands were executed during this interaction.');
      }
      
      // Return the result
      return {
        success: true,
        response: result.response,
        openedFiles: result.openedFiles || [],
        executedCommands: result.executedCommands || []
      };
    } catch (error) {
      console.error('Error in task execution:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Process a user message during task execution
   * @param {string} message - User message
   * @returns {Promise<Object>} Processing result
   */
  async processChatMessage(message) {
    try {
      if (!this.currentProject) {
        return { success: false, error: 'No current project' };
      }
      
      console.log(`Processing chat message: ${message}`);
      
      // Process message with file access
      const result = await this.aiClient.processMessage(message);
      
      console.log('Raw model output:');
      console.log('-----------------');
      console.log(result.response);
      console.log('-----------------');
      
      // Log file interactions
      if (result.openedFiles && result.openedFiles.length > 0) {
        console.log('\nFiles opened:');
        for (const file of result.openedFiles) {
          console.log(`- ${file.name}`);
        }
      }
      
      // Check for any commands executed
      if (result.executedCommands && result.executedCommands.length > 0) {
        console.log('\nCommands executed:');
        for (const cmd of result.executedCommands) {
          console.log(`- ${cmd.command}: ${cmd.fileName} (${cmd.success ? 'Success' : 'Failed'})`);
        }
      }
      
      // Return the result
      return {
        success: true,
        response: result.response,
        openedFiles: result.openedFiles || [],
        executedCommands: result.executedCommands || []
      };
    } catch (error) {
      console.error('Error processing chat message:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Run a demo of the task execution workflow
   * @param {string} projectId - Project ID
   * @param {string} taskDescription - Task description
   */
  async runDemo(projectId, taskDescription) {
    console.log('=== Task Execution Demo ===');
    console.log(`Project: ${projectId}`);
    console.log(`Task: ${taskDescription}`);
    console.log('===========================');
    
    try {
      // Set project
      const projectResult = await this.setProject(projectId);
      
      if (!projectResult.success) {
        console.error(`Failed to set project: ${projectResult.error}`);
        return;
      }
      
      // Begin task execution
      const result = await this.beginTaskExecution(taskDescription);
      
      if (!result.success) {
        console.error(`Task execution failed: ${result.error}`);
        return;
      }
      
      console.log('\n=== Demo Complete ===');
      console.log('The task execution workflow demo has completed successfully.');
      console.log('You can now proceed with implementing the UI components to visualize this process.');
    } catch (error) {
      console.error('Demo execution failed:', error);
    }
  }
}

module.exports = TaskHandler;