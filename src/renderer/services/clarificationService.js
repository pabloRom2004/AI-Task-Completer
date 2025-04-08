/**
 * Service for handling task clarification with the AI model
 */

import { clarificationPromptTemplate } from '../data/clarificationPrompt.js';
import { getSetting } from './settingsService.js';

// In-memory storage for current clarification session
let currentConversation = [];
let currentTask = '';

/**
 * Reset the clarification conversation
 */
export function resetClarification() {
    currentConversation = [];
    currentTask = '';
}

/**
 * Initialize a new clarification process with a task
 * @param {string} task - The user's task description
 */
export function initClarification(task) {
    resetClarification();
    currentTask = task;
}

/**
 * Generate the full prompt for the AI model
 * @returns {string} The complete prompt
 */
function generatePrompt() {
    // Format conversation history
    const conversationText = currentConversation
        .map(exchange =>
            `Question: ${exchange.question}\nAnswer: ${exchange.answer}`
        )
        .join('\n\n');

    // Replace placeholders in template
    return clarificationPromptTemplate
        .replace('{userTask}', currentTask)
        .replace('{conversation}', conversationText || 'No additional information yet.');
}

/**
 * Extract JSON from the model's response
 * @param {string} response - The full model response
 * @returns {Object|null} Parsed JSON or null if invalid
 */
function extractJSON(response) {
    try {
        // Strip any markdown code block markers if they exist
        let cleanResponse = response;
        if (response.includes('```json')) {
            cleanResponse = response.replace(/```json\n|\n```/g, '');
        } else if (response.includes('```')) {
            cleanResponse = response.replace(/```\n|\n```/g, '');
        }

        // Look for JSON within the structured_output tags first
        const tagMatch = cleanResponse.match(/<structured_output>([\s\S]*?)<\/structured_output>/);
        if (tagMatch && tagMatch[1]) {
            // Try to parse the JSON content
            const jsonContent = tagMatch[1].trim();
            console.log('Found JSON in structured_output tags:', jsonContent);
            return JSON.parse(jsonContent);
        }

        // If no tags found, try to parse the entire response as JSON
        // First, attempt to find a JSON object in the text (anything between { and })
        const jsonMatch = cleanResponse.match(/(\{[\s\S]*\})/);
        if (jsonMatch && jsonMatch[1]) {
            const jsonStr = jsonMatch[1].trim();
            console.log('Found JSON object in response:', jsonStr);
            return JSON.parse(jsonStr);
        }

        // If still no valid JSON, log the response for debugging
        console.error('No JSON found in response. Full response:', cleanResponse);
        return null;
    } catch (error) {
        console.error('Error parsing JSON response:', error);
        console.error('Raw response:', response);
        return null;
    }
}

/**
 * Get clarification questions from the AI model
 * @returns {Promise<Object>} Object containing questions and needsMoreQuestions flag
 */
export async function getQuestions() {
    try {
        const apiKey = await getSetting('apiKey');
        const model = await getSetting('model', 'deepseek/deepseek-chat-v3-0324:free');

        if (!apiKey) {
            throw new Error('API key not set. Please configure it in Settings.');
        }

        // Generate full prompt
        const prompt = generatePrompt();

        console.log('Sending prompt to model:', prompt.substring(0, 100) + '...');

        // Call API through Electron main process
        const response = await window.electronAPI.settings.callModel({
            apiKey,
            model,
            prompt,
            temperature: 0.0,
            maxTokens: 2000
        });

        console.log('Received response from model');

        if (!response || !response.text) {
            throw new Error('Invalid response from model');
        }

        // Parse JSON from response
        const result = extractJSON(response.text);

        if (!result) {
            throw new Error('Could not parse JSON from model response');
        }

        if (!Array.isArray(result.questions)) {
            console.error('Questions is not an array in response:', result);
            throw new Error('Invalid question format in response');
        }

        // If the model decided no more questions are needed but didn't provide any
        // questions (empty array), add a default question to avoid errors
        if (result.questions.length === 0) {
            console.log('Model returned empty questions array with needsMoreQuestions =', result.needsMoreQuestions);

            if (result.needsMoreQuestions === false) {
                // No more questions needed, return with an empty array
                return {
                    needsMoreQuestions: false,
                    questions: []
                };
            } else {
                // Add a default question to avoid UI errors
                result.questions = [{
                    question: "Could you provide any additional details that might help with your task?",
                    hint: "Any specific requirements, technologies, or constraints you have in mind."
                }];
            }
        }

        return result;
    } catch (error) {
        console.error('Error getting clarification questions:', error);
        return {
            needsMoreQuestions: false,
            questions: [{
                question: "I'm having trouble connecting to the AI model. What would you like to do?",
                hint: "Please check your API settings or try again later."
            }],
            error: error.message
        };
    }
}

/**
 * Add a question-answer pair to the conversation history
 * @param {string} question - The question text
 * @param {string} answer - The user's answer
 */
export function addExchange(question, answer) {
    currentConversation.push({ question, answer });
}

/**
 * Get the current clarification state
 * @returns {Object} The current task and conversation
 */
export function getClarificationState() {
    return {
        task: currentTask,
        conversation: [...currentConversation]
    };
}