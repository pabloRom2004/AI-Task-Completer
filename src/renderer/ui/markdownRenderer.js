/**
 * fixedSimpleMarkdown.js - Super simple markdown renderer with function stubs
 * for compatibility with existing code
 */

/**
 * Initialize the markdown renderer
 */
export function initSimpleMarkdownRenderer() {
    return {
      render: renderBasicMarkdown,
      setupCopyButtons: setupCodeCopyButtons // Added back for compatibility
    };
  }
  
  /**
   * Render markdown to HTML - extremely simplified version
   * @param {string} text - Markdown text to render
   * @returns {string} - HTML output
   */
  function renderBasicMarkdown(text) {
    if (!text) return '';
    
    // Create a container for our result
    let result = '';
    
    // Process code blocks
    let processedText = '';
    let lines = text.split('\n');
    let inCodeBlock = false;
    let codeContent = '';
    let codeLanguage = '';
    let codeBlockCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      
      // Check for code block markers
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          // Starting a code block
          inCodeBlock = true;
          codeLanguage = line.trim().substring(3);
          codeContent = '';
          continue;
        } else {
          // Ending a code block
          inCodeBlock = false;
          const codeId = `code-block-${codeBlockCount++}`;
          
          // Add the code block to our result with copy button
          processedText += `<div class="code-block">`;
          processedText += `<div class="code-header">`;
          processedText += `<span class="code-language">${codeLanguage || 'plaintext'}</span>`;
          processedText += `<button class="copy-code-button" data-target="${codeId}">`;
          processedText += `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
          processedText += `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>`;
          processedText += `<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>`;
          processedText += `</svg><span>Copy</span>`;
          processedText += `</button></div>`;
          processedText += `<pre><code id="${codeId}">`;
          processedText += escapeHtml(codeContent);
          processedText += `</code></pre></div>`;
          continue;
        }
      }
      
      if (inCodeBlock) {
        codeContent += line + '\n';
      } else {
        processedText += line + '\n';
      }
    }
    
    // If we were in a code block and never closed it, close it now
    if (inCodeBlock) {
      const codeId = `code-block-${codeBlockCount++}`;
      
      processedText += `<div class="code-block">`;
      processedText += `<div class="code-header">`;
      processedText += `<span class="code-language">${codeLanguage || 'plaintext'}</span>`;
      processedText += `<button class="copy-code-button" data-target="${codeId}">`;
      processedText += `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
      processedText += `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>`;
      processedText += `<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>`;
      processedText += `</svg><span>Copy</span>`;
      processedText += `</button></div>`;
      processedText += `<pre><code id="${codeId}">`;
      processedText += escapeHtml(codeContent);
      processedText += `</code></pre></div>`;
    }
    
    // Process basic markdown in the non-code sections
    result = processedText;
    
    // Headers
    result = result.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    result = result.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    result = result.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    
    // Bold
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    result = result.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Links
    result = result.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
    
    // Inline code (after block code)
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert line breaks to <br> tags
    result = result.replace(/\n/g, '<br>');
    
    return result;
  }
  
  /**
   * Simple HTML escaping function
   */
  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  /**
   * Set up code copy button functionality 
   * @param {HTMLElement} container - The container with code blocks
   */
  function setupCodeCopyButtons(container) {
    if (!container) return;
    
    container.addEventListener('click', (event) => {
      // Check if a copy button was clicked
      const button = event.target.closest('.copy-code-button');
      if (!button) return;
      
      const targetId = button.getAttribute('data-target');
      const codeElement = document.getElementById(targetId);
      
      if (codeElement) {
        // Copy the code to clipboard
        const text = codeElement.textContent;
        navigator.clipboard.writeText(text).then(() => {
          // Update button text temporarily
          const originalHTML = button.innerHTML;
          button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span>Copied!</span>';
          
          // Reset button after 2 seconds
          setTimeout(() => {
            button.innerHTML = originalHTML;
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy text: ', err);
        });
      }
    });
  }