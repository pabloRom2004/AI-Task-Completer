/**
 * AI Client module for API communication
 * Handles interactions with AI models via DeepSeek with progressive file access
 * Enhanced with toggle-able logging capability
 */
const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

class AIClient {
    constructor(config = {}) {
        // Configuration options
        this.apiKey = config.apiKey || '';
        this.model = config.model || 'deepseek-chat'; // Default DeepSeek model

        // Simple logging toggle - set to false to disable
        this.loggingEnabled = true;
        this.logDirectory = config.logDirectory || 'logs';
        this.sessionLogFile = null;

        // Initialize OpenAI client with DeepSeek base URL
        this.openai = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: this.apiKey,
        });

        // Conversation history and prompt cache
        this.conversationHistory = [];
        this.promptCache = new Map();

        // References to other components (to be set by caller)
        this.fileSystem = null;
        this.commandParser = null;

        // Initialize logging if enabled
        if (this.loggingEnabled) {
            this.initializeLogging();
        }
    }

    /**
     * Initialize logging system
     */
    async initializeLogging() {
        try {
            // Create log directory if it doesn't exist
            await fs.mkdir(this.logDirectory, { recursive: true });

            // Format date for filename: YYYY-MM-DD_HH-MM-SS
            const dateStr = new Date().toISOString()
                .replace(/:/g, '-')
                .replace(/\..+/, '')
                .replace('T', '_');

            // Create log filename
            this.sessionLogFile = path.join(this.logDirectory, `session_${dateStr}.txt`);

            // Write initial session header
            await fs.writeFile(
                this.sessionLogFile,
                `=== AI CLIENT SESSION LOG ===\n` +
                `Date: ${new Date().toLocaleString()}\n` +
                `Model: ${this.model}\n` +
                `===========================\n\n`,
                'utf-8'
            );

            console.log(`Logging initialized. Log file: ${this.sessionLogFile}`);
        } catch (error) {
            console.error('Error initializing logging:', error);
            this.loggingEnabled = false;
        }
    }

    /**
     * Log message to the session log file if logging is enabled
     * @param {string} content - Content to log 
     */
    async log(content) {
        if (!this.loggingEnabled || !this.sessionLogFile) return;

        try {
            await fs.appendFile(this.sessionLogFile, content + '\n', 'utf-8');
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    /**
     * Set file system and command parser references
     * @param {Object} fileSystem - FileSystem instance
     * @param {Object} commandParser - CommandParser instance
     */
    setComponents(fileSystem, commandParser) {
        this.fileSystem = fileSystem;
        this.commandParser = commandParser;
    }

    /**
     * Set API key for DeepSeek
     * @param {string} apiKey - The API key
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;

        // Recreate the OpenAI client with the new API key
        this.openai = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: this.apiKey,
        });
    }

    /**
     * Set model to use for completions
     * @param {string} model - The model identifier
     */
    setModel(model) {
        this.model = model;
        this.log(`[${new Date().toISOString()}] Model changed to: ${model}`);
    }

    /**
     * Reset conversation history
     */
    resetConversation() {
        this.conversationHistory = [];
        this.log(`[${new Date().toISOString()}] Conversation history reset`);
    }

    /**
     * Get the current conversation history
     * @returns {Array} The conversation history
     */
    getConversationHistory() {
        return this.conversationHistory;
    }

    /**
     * Load a prompt from file
     * @param {string} promptName - The name of the prompt file to load
     * @returns {Promise<string>} The prompt content
     */
    async loadPrompt(promptName) {
        // Check if prompt is already cached
        if (this.promptCache.has(promptName)) {
            return this.promptCache.get(promptName);
        }

        try {
            // Determine path based on prompt name
            let promptPath;
            if (promptName === 'file-description') {
                promptPath = path.join('prompts', 'file-descriptions', 'file-description.txt');
            } else if (promptName === 'file-handling') {
                promptPath = path.join('prompts', 'file-handling.txt');
            } else if (promptName === 'create-context') {
                promptPath = path.join('prompts', 'global-context', 'create-context.txt');
            } else if (promptName === 'task-breakdown') {
                promptPath = path.join('prompts', 'task-breakdown', 'task-breakdown.txt');
            } else if (promptName === 'todo-execution') {
                promptPath = path.join('prompts', 'task-breakdown', 'todo-execution.txt');
            } else if (promptName === 'sanity-check') {
                promptPath = path.join('prompts', 'sanity-checks', 'sanity-check.txt');
            } else if (promptName === 'task-clarification') {
                promptPath = path.join('prompts', 'task-clarification.txt');
            } else if (promptName === 'file-opening') {
                promptPath = path.join('prompts', 'file-opening.txt');
            } else {
                throw new Error(`Unknown prompt: ${promptName}`);
            }

            const promptContent = await fs.readFile(promptPath, 'utf-8');

            // Cache the prompt
            this.promptCache.set(promptName, promptContent);
            return promptContent;
        } catch (error) {
            console.error(`Error loading prompt ${promptName}:`, error);
            throw error;
        }
    }

    /**
     * Format a file description for inclusion in messages to the AI
     * @param {Object} fileRef - File reference object
     * @returns {string} Formatted file description
     */
    formatFileDescription(fileRef) {
        return `File: ${fileRef.name} (${fileRef.type})
Description: ${fileRef.description || 'No description available.'}
Path: ${fileRef.originalPath}
Size: ${fileRef.size} bytes
`;
    }

    /**
     * Prepare file information for inclusion in AI messages
     * @returns {Promise<string>} Formatted file information
     */
    async prepareFileInformation() {
        if (!this.fileSystem) {
            return 'No file system available.';
        }

        const registry = await this.fileSystem.getFileRegistry();

        if (!registry.files || registry.files.length === 0) {
            return 'No files available.';
        }

        // Load external file opening prompt
        let fileOpeningPrompt;
        try {
            fileOpeningPrompt = await this.loadPrompt('file-opening');
        } catch (error) {
            console.error("Error loading file-opening prompt, using default:", error);
            // Fallback to simple instructions if prompt file doesn't exist
            fileOpeningPrompt = 'To request files or submit your final answer, include a JSON object at the end of your response.\n\n' +
                'For requesting files, use:\n' +
                '{\n  "output": "Files",\n  "files": ["filename1.ext", "filename2.ext", ...]\n}\n\n' +
                'For submitting your final answer, use:\n' +
                '{\n  "output": "Answer",\n  "content": "YOUR FINAL ANSWER HERE"\n}';
        }

        // List available files
        let fileInfo = 'Available Files:\n\n';

        for (const file of registry.files) {
            fileInfo += this.formatFileDescription(file) + '\n';
        }

        // Add the file opening instructions
        fileInfo += '\n----- HOW TO ACCESS FILES -----\n';
        fileInfo += fileOpeningPrompt;

        return fileInfo;
    }

    /**
     * Extract JSON requests from AI response
     * @param {string} text - Response text
     * @returns {Object} Extracted request object (files or answer)
     */
    extractJsonRequest(text) {
        // Look for JSON object at the end of the text
        const jsonRegex = /{[\s\S]*}(?:\s*)$/;
        const match = text.match(jsonRegex);

        if (!match) {
            console.log(`DEBUG: No JSON object found in response`);
            this.log(`[${new Date().toISOString()}] DEBUG: No JSON object found in response`);
            return null;
        }

        try {
            const jsonStr = match[0];
            const jsonObj = JSON.parse(jsonStr);

            // Validate the JSON structure
            if (!jsonObj.output) {
                console.log(`DEBUG: Invalid JSON format - missing 'output' field`);
                this.log(`[${new Date().toISOString()}] DEBUG: Invalid JSON format - missing 'output' field`);
                return null;
            }

            if (jsonObj.output === "Files") {
                if (!Array.isArray(jsonObj.files) || jsonObj.files.length === 0) {
                    console.log(`DEBUG: Invalid 'Files' format - missing or empty 'files' array`);
                    this.log(`[${new Date().toISOString()}] DEBUG: Invalid 'Files' format - missing or empty 'files' array`);
                    return null;
                }

                return {
                    type: "files",
                    files: jsonObj.files
                };
            } else if (jsonObj.output === "Answer") {
                if (typeof jsonObj.content !== "string" || jsonObj.content.trim() === "") {
                    console.log(`DEBUG: Invalid 'Answer' format - missing or empty 'content' field`);
                    this.log(`[${new Date().toISOString()}] DEBUG: Invalid 'Answer' format - missing or empty 'content' field`);
                    return null;
                }

                return {
                    type: "answer",
                    content: jsonObj.content
                };
            } else {
                console.log(`DEBUG: Unknown output type: ${jsonObj.output}`);
                this.log(`[${new Date().toISOString()}] DEBUG: Unknown output type: ${jsonObj.output}`);
                return null;
            }
        } catch (error) {
            console.log(`DEBUG: Error parsing JSON: ${error.message}`);
            this.log(`[${new Date().toISOString()}] DEBUG: Error parsing JSON: ${error.message}`);

            // Fallback to the old method for backward compatibility
            const fileRequests = this.extractFileOpenRequests(text);
            if (fileRequests.length > 0) {
                return {
                    type: "files",
                    files: fileRequests
                };
            }

            return null;
        }
    }

    /**
     * Legacy method to extract file open requests from AI response (for backward compatibility)
     * @param {string} text - Response text
     * @returns {Array<string>} Array of requested file names
     */
    extractFileOpenRequests(text) {
        const openPattern = /open\s+(?:the\s+)?(?:file:?\s+)?["']?([^"'<>\n\r]+\.[a-zA-Z0-9]+)["']?/gi;
        const openRequests = [];
        let match;

        while ((match = openPattern.exec(text)) !== null) {
            const fileName = match[1].trim();
            openRequests.push(fileName);
            console.log(`DEBUG extractFileOpenRequests: Found request for file: ${fileName}`);
            this.log(`[${new Date().toISOString()}] DEBUG extractFileOpenRequests: Found request for file: ${fileName}`);
        }

        // If no standard requests found, try more aggressive pattern
        if (openRequests.length === 0) {
            const aggressivePattern = /(?:check|look at|examine|read)\s+["']?([a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+)["']?/gi;

            while ((match = aggressivePattern.exec(text)) !== null) {
                const fileName = match[1].trim();
                openRequests.push(fileName);
                console.log(`DEBUG extractFileOpenRequests: Found file with aggressive pattern: ${fileName}`);
                this.log(`[${new Date().toISOString()}] DEBUG extractFileOpenRequests: Found file with aggressive pattern: ${fileName}`);
            }
        }

        return [...new Set(openRequests)]; // Remove duplicates
    }

    /**
     * Extract answer from AI response
     * @param {string} text - Response text
     * @returns {string|null} Extracted answer or null if not found
     */
    extractAnswer(text) {
        const answerPattern = /<answer>(.*?)<\/answer>/is;
        const match = text.match(answerPattern);

        if (match && match[1]) {
            return match[1].trim();
        }

        return null;
    }

    /**
     * Create a synthetic file request string for the CommandParser
     * @param {Array<string>} files - Array of file names
     * @returns {string} Synthetic request string
     */
    createFileRequestString(files) {
        return files.map(file => `Open file: ${file}`).join('\n');
    }

    /**
     * Process a single message exchange with the AI
     * @param {string} userMessage - User message
     * @param {Function} updateCallback - Callback for streaming updates
     * @param {boolean} streamEnabled - Whether to use streaming
     * @returns {Promise<Object>} Processing result including response and opened files
     */
    async processMessage(userMessage, updateCallback = null, streamEnabled = true) {
        if (!this.apiKey || !this.openai) {
            throw new Error('API key not set or invalid. Please check your settings.');
        }

        // Add this before each API call (both streaming and non-streaming)
        await new Promise(resolve => setTimeout(resolve, 100)); // 200ms delay

        // Log the incoming user message
        this.log(`\n[${new Date().toISOString()}] USER MESSAGE:\n${userMessage}\n`);

        // Prepare file information
        const fileInfo = await this.prepareFileInformation();

        // Add user message to conversation history
        // For the first message, include file info with the user message
        if (this.conversationHistory.length === 0) {
            this.conversationHistory.push({
                role: 'user',
                content: `${userMessage}\n\n${fileInfo}`
            });
        } else {
            this.conversationHistory.push({
                role: 'user',
                content: userMessage
            });
        }

        // Log the messages being sent to the model
        console.log("\n=== MESSAGES SENT TO MODEL ===");
        if (this.loggingEnabled) {
            this.log(`\n[${new Date().toISOString()}] MESSAGES SENT TO MODEL:\n`);

            for (const msg of this.conversationHistory) {
                this.log(`\n[${msg.role.toUpperCase()}]:\n${msg.content}`);
            }

            this.log("\n=== END OF MESSAGES ===\n");
        }

        for (const msg of this.conversationHistory) {
            console.log(`\n[${msg.role.toUpperCase()}]:`);
            // Truncate long messages for console
            if (msg.content.length > 500000) {
                console.log(msg.content.substring(0, 500000) + "...");
            } else {
                console.log(msg.content);
            }
        }

        console.log("\n=== END OF MESSAGES ===\n");

        // Send to AI and get response
        let aiResponse;
        let finalAnswer = null;
        try {
            if (streamEnabled && updateCallback) {
                // Use streaming for real-time updates
                let responseText = '';

                this.log(`[${new Date().toISOString()}] Making streaming API call to model: ${this.model}`);

                const stream = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: this.conversationHistory,
                    stream: true,
                });

                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || '';
                    responseText += content;
                    updateCallback(content);
                }

                aiResponse = responseText;
            } else {
                // Use non-streaming mode
                this.log(`[${new Date().toISOString()}] Making non-streaming API call to model: ${this.model}`);

                const response = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: this.conversationHistory,
                });

                aiResponse = response.choices[0].message.content;
            }

            // Log AI response
            this.log(`\n[${new Date().toISOString()}] AI RESPONSE:\n${aiResponse}\n`);

            // Add AI response to conversation history
            this.conversationHistory.push({
                role: 'assistant',
                content: aiResponse
            });

            // Extract JSON request from response
            const jsonRequest = this.extractJsonRequest(aiResponse);

            // Initialize variables for files and answer
            let openedFiles = [];

            if (jsonRequest) {
                console.log(`DEBUG: Found JSON request of type: ${jsonRequest.type}`);
                this.log(`[${new Date().toISOString()}] Found JSON request of type: ${jsonRequest.type}`);

                if (jsonRequest.type === "files") {
                    const fileRequests = jsonRequest.files;
                    console.log(`DEBUG: Extracted ${fileRequests.length} file requests from JSON`);
                    this.log(`[${new Date().toISOString()}] Extracted ${fileRequests.length} file requests from JSON`);

                    if (fileRequests.length > 0 && this.commandParser) {
                        // Create a synthetic string that the CommandParser can understand
                        const fileRequestString = this.createFileRequestString(fileRequests);

                        // Process file open requests and get content
                        const openResults = await this.commandParser.processFileRequests(fileRequestString);

                        console.log(`DEBUG: File request processing results:`,
                            openResults.success ?
                                `Success: ${openResults.requests} requests, ${openResults.results.length} results` :
                                "Failed");
                        this.log(`[${new Date().toISOString()}] File request processing results: ${openResults.success ?
                                `Success: ${openResults.requests} requests, ${openResults.results.length} results` :
                                "Failed"}`);

                        if (openResults.success && openResults.results.length > 0) {
                            // Prepare file content message with more clear formatting
                            let fileContents = 'Here are the contents of the requested files:\n\n';

                            for (const result of openResults.results) {
                                if (result.success) {
                                    // Format with clear delimiters
                                    fileContents += `===== BEGIN FILE: ${result.fileName} =====\n\n`;
                                    fileContents += `\`\`\`${result.fileRef.type}\n${result.content}\n\`\`\`\n\n`;
                                    fileContents += `===== END FILE: ${result.fileName} =====\n\n`;

                                    openedFiles.push({
                                        name: result.fileName,
                                        content: result.content,
                                        type: result.fileRef.type
                                    });

                                    console.log(`DEBUG: Successfully opened file: ${result.fileName}`);
                                    this.log(`[${new Date().toISOString()}] Successfully opened file: ${result.fileName}`);
                                } else {
                                    fileContents += `Error opening file ${result.fileName}: ${result.error}\n\n`;
                                    console.log(`DEBUG: Error opening file ${result.fileName}: ${result.error}`);
                                    this.log(`[${new Date().toISOString()}] Error opening file ${result.fileName}: ${result.error}`);
                                }
                            }

                            // Create a clear continuation message
                            const continueMessage = 'Continue with your analysis based on these file contents. Remember to format your response in the end in two ways: To request files: {"output": "Files", "files": ["filename.ext"]} and to submit your answer: {"output": "Answer", "content": "YOUR ANSWER HERE"}';

                            // Add it to the conversation
                            this.conversationHistory.push({
                                role: 'user',
                                content: `${continueMessage}\n\n${fileContents}`
                            });

                            // Log this follow-up message
                            console.log("\n=== FOLLOW-UP MESSAGE AFTER OPENING FILES ===");
                            console.log(`[USER]: ${continueMessage}`);
                            console.log(`[USER]: ${fileContents.substring(0, 1000000)}...`);
                            console.log("=== END OF FOLLOW-UP MESSAGE ===\n");

                            this.log(`\n[${new Date().toISOString()}] FOLLOW-UP MESSAGE: ${continueMessage}\n`);
                            this.log(`\n[${new Date().toISOString()}] FILE CONTENTS (truncated): ${fileContents.substring(0, 1000000)}...\n`);

                            // Send to AI and get continuation response
                            let continuationResponse;

                            if (streamEnabled && updateCallback) {
                                let responseText = '';

                                this.log(`[${new Date().toISOString()}] Making follow-up streaming API call`);

                                const stream = await this.openai.chat.completions.create({
                                    model: this.model,
                                    messages: this.conversationHistory,
                                    stream: true,
                                });

                                for await (const chunk of stream) {
                                    const content = chunk.choices[0]?.delta?.content || '';
                                    responseText += content;
                                    updateCallback(content);
                                }

                                continuationResponse = responseText;
                            } else {
                                this.log(`[${new Date().toISOString()}] Making follow-up non-streaming API call`);

                                const response = await this.openai.chat.completions.create({
                                    model: this.model,
                                    messages: this.conversationHistory,
                                });

                                continuationResponse = response.choices[0].message.content;
                            }

                            // Log the continuation response
                            this.log(`\n[${new Date().toISOString()}] CONTINUATION RESPONSE:\n${continuationResponse}\n`);

                            // Add continuation response to the history
                            this.conversationHistory.push({
                                role: 'assistant',
                                content: continuationResponse
                            });

                            // Initialize or update recursion tracking
                            this.recursionDepth = (this.recursionDepth || 0) + 1;
                            const recursionLimit = 10; // Reasonable limit to prevent infinite loops

                            this.log(`[${new Date().toISOString()}] Recursion depth: ${this.recursionDepth}/${recursionLimit}`);

                            // Check for JSON request in the continuation response
                            const nextJsonRequest = this.extractJsonRequest(continuationResponse);

                            if (nextJsonRequest && nextJsonRequest.type === "files" && this.recursionDepth < recursionLimit) {
                                console.log(`DEBUG: Found more file requests in continuation (recursion: ${this.recursionDepth}/${recursionLimit})`);
                                this.log(`[${new Date().toISOString()}] Found more file requests in continuation (recursion: ${this.recursionDepth}/${recursionLimit})`);

                                // Recursively process more file requests (up to a reasonable limit)
                                const recursiveResult = await this.processMessage(
                                    "Continue exploring the files as needed.",
                                    updateCallback,
                                    streamEnabled
                                );

                                // Combine results
                                openedFiles = [...openedFiles, ...(recursiveResult.openedFiles || [])];

                                // Check if we got a final answer from the recursive call
                                if (recursiveResult.finalAnswer) {
                                    finalAnswer = recursiveResult.finalAnswer;
                                }

                                aiResponse = continuationResponse + "\n\n" + recursiveResult.response;
                            } else if (nextJsonRequest && nextJsonRequest.type === "answer") {
                                // We got a final answer
                                finalAnswer = nextJsonRequest.content;
                                this.log(`[${new Date().toISOString()}] Got final answer from continuation response`);
                                aiResponse = continuationResponse;
                            } else {
                                if (this.recursionDepth >= recursionLimit) {
                                    console.log(`DEBUG: Reached recursion limit (${recursionLimit})`);
                                    this.log(`[${new Date().toISOString()}] Reached recursion limit (${recursionLimit})`);
                                }
                                // Use the continuation response as the final response
                                aiResponse = continuationResponse;
                            }

                            // Decrement recursion depth when this branch is complete
                            this.recursionDepth--;
                            this.log(`[${new Date().toISOString()}] Decremented recursion depth to: ${this.recursionDepth}`);
                        }
                    }
                } else if (jsonRequest.type === "answer") {
                    // We got a final answer
                    finalAnswer = jsonRequest.content;
                    this.log(`[${new Date().toISOString()}] Got final answer from initial response`);
                }
            }

            // Log the final result
            this.log(`[${new Date().toISOString()}] PROCESSING COMPLETE:
- Files opened: ${openedFiles.length}
- Final answer: ${finalAnswer ? 'Yes' : 'No'}
`);

            return {
                success: true,
                response: aiResponse,
                openedFiles,
                finalAnswer: finalAnswer
            };
        } catch (error) {
            console.error('Error in AI communication:', error);
            this.log(`[${new Date().toISOString()}] ERROR in AI communication: ${error.message}`);
            return {
                success: false,
                error: error.message || 'Unknown error in AI communication'
            };
        }
    }

    /**
     * Generate a file description using AI, with access to other files
     * @param {Object} fileRef - File reference object
     * @param {string} content - File content
     * @returns {Promise<string>} Generated description
     */
    async generateFileDescription(fileRef, content) {
        try {
            this.log(`\n[${new Date().toISOString()}] GENERATING FILE DESCRIPTION for ${fileRef.name}`);

            // Reset conversation for this file description generation
            this.resetConversation();

            // Load the file description prompt
            const promptTemplate = await this.loadPrompt('file-description');

            // Get information about all other files
            const fileInfo = await this.prepareFileInformation();

            // Create system message with both prompt and file info
            const systemMessage = `${promptTemplate}\n\nHere are all available files in the project:\n${fileInfo}\n\nNow, please generate a description for the following file:\n\nFile: ${fileRef.name}\nContent:\n\n${content}`;

            // Add system message to conversation
            this.conversationHistory.push({
                role: 'system',
                content: systemMessage
            });

            // Process this as a regular message to allow file access
            const result = await this.processMessage(
                `Please generate a concise yet comprehensive description for the file "${fileRef.name}" that focuses on how it would be used or interacted with.`,
                null,
                false
            );

            if (result.success) {
                this.log(`[${new Date().toISOString()}] Successfully generated description for ${fileRef.name}`);
                return result.response;
            } else {
                throw new Error(result.error || 'Failed to generate file description');
            }
        } catch (error) {
            console.error('Error generating file description:', error);
            this.log(`[${new Date().toISOString()}] ERROR generating file description for ${fileRef.name}: ${error.message}`);
            return `${fileRef.name}: A ${fileRef.type} file.`;
        }
    }

    /**
     * Process a conversation with continued file access
     * @param {string} initialMessage - Initial user message
     * @param {Object} options - Processing options
     * @returns {Promise<Object>} Processing result
     */
    async processConversationWithFileAccess(initialMessage, options = {}) {
        const {
            maxTurns = 5,
            updateCallback = null,
            streamEnabled = true,
            autoFollowUp = true
        } = options;

        this.log(`\n[${new Date().toISOString()}] STARTING CONVERSATION WITH FILE ACCESS
Initial message: ${initialMessage}
Max turns: ${maxTurns}
Streaming: ${streamEnabled}
Auto follow-up: ${autoFollowUp}
`);

        // Reset conversation
        this.resetConversation();

        let turns = 0;
        let currentMessage = initialMessage;
        let allResults = [];
        let complete = false;
        let finalAnswer = null;

        while (turns < maxTurns && !complete) {
            this.log(`[${new Date().toISOString()}] Processing turn ${turns + 1}/${maxTurns}`);

            // Process the current message
            const result = await this.processMessage(
                currentMessage,
                updateCallback,
                streamEnabled
            );

            allResults.push(result);
            turns++;

            // Check if we got a final answer
            if (result.success && result.finalAnswer) {
                finalAnswer = result.finalAnswer;
                complete = true;
                console.log(`DEBUG: Got final answer: ${finalAnswer}`);
                this.log(`[${new Date().toISOString()}] Got final answer in turn ${turns}`);
            }
            // Check if we opened any files
            else if (result.success && result.openedFiles && result.openedFiles.length > 0) {
                console.log(`DEBUG: Opened ${result.openedFiles.length} files in turn ${turns}`);
                this.log(`[${new Date().toISOString()}] Opened ${result.openedFiles.length} files in turn ${turns}`);

                // If we opened files, automatically follow up if enabled
                if (autoFollowUp) {
                    currentMessage = "Continue with your analysis based on these file contents.";
                    this.log(`[${new Date().toISOString()}] Auto-following up with: "${currentMessage}"`);
                } else {
                    // Otherwise, task is incomplete but await user input
                    complete = false;
                    this.log(`[${new Date().toISOString()}] Auto-follow up disabled, waiting for user input`);
                    break;
                }
            } else {
                // No files opened, consider task complete
                complete = true;
                this.log(`[${new Date().toISOString()}] No files opened and no final answer, marking as complete`);
            }
        }

        this.log(`\n[${new Date().toISOString()}] CONVERSATION SUMMARY
Turns completed: ${turns}
Task complete: ${complete}
Files opened: ${allResults.reduce((count, result) => count + (result.openedFiles?.length || 0), 0)}
Final answer: ${finalAnswer ? 'Provided' : 'None'}
`);

        return {
            success: true,
            turns,
            complete,
            results: allResults,
            conversationHistory: this.conversationHistory,
            finalAnswer
        };
    }

    /**
     * Create a console-based demo interface for testing the AI client
     * @param {string} initialMessage - Initial message to send
     */
    async consoleDemo(initialMessage) {
        console.log("API Client Console Demo");
        console.log("======================");
        console.log("Initial message:", initialMessage);

        this.log(`\n[${new Date().toISOString()}] STARTING CONSOLE DEMO
Initial message: ${initialMessage}
`);

        const updateCallback = (chunk) => {
            process.stdout.write(chunk);
        };

        const result = await this.processConversationWithFileAccess(
            initialMessage,
            {
                updateCallback,
                streamEnabled: true,
                autoFollowUp: true
            }
        );

        console.log("\n\n=== Complete Conversation ===");
        this.log(`\n[${new Date().toISOString()}] CONSOLE DEMO COMPLETE CONVERSATION:`);

        for (const msg of this.conversationHistory) {
            console.log(`\n[${msg.role.toUpperCase()}]:`);
            console.log(msg.content);
            this.log(`\n[${msg.role.toUpperCase()}]:\n${msg.content}`);
        }

        console.log("\n\n=== Files Opened ===");
        let fileCount = 0;
        this.log(`\n[${new Date().toISOString()}] FILES OPENED DURING DEMO:`);

        for (const res of result.results) {
            if (res.openedFiles && res.openedFiles.length > 0) {
                for (const file of res.openedFiles) {
                    console.log(`- ${file.name} (${file.type})`);
                    this.log(`- ${file.name} (${file.type})`);
                    fileCount++;
                }
            }
        }

        if (fileCount === 0) {
            console.log("No files were opened during this conversation.");
            this.log("No files were opened during this conversation.");
        }

        console.log("\n=== Summary ===");
        console.log(`Turns: ${result.turns}`);
        console.log(`Task complete: ${result.complete ? 'Yes' : 'No'}`);
        console.log(`Files opened: ${fileCount}`);
        console.log(`Final answer: ${result.finalAnswer || 'None provided'}`);

        this.log(`\n[${new Date().toISOString()}] CONSOLE DEMO SUMMARY:
Turns: ${result.turns}
Task complete: ${result.complete ? 'Yes' : 'No'}
Files opened: ${fileCount}
Final answer: ${result.finalAnswer ? 'Provided' : 'None'}
`);
    }
}

module.exports = AIClient;