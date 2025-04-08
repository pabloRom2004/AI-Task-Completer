/**
 * Shared utility functions used across multiple components
 */

/**
 * Shows a notification message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of message ('success', 'error', 'info')
 * @param {number} duration - How long to show the message in milliseconds
 */
export function showNotification(message, type = 'info', duration = 3000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Create content container
    const content = document.createElement('div');
    content.className = 'notification-content';
    content.textContent = message;
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      notification.classList.add('fadeout');
      setTimeout(() => notification.remove(), 300);
    });
    
    // Assemble notification
    notification.appendChild(content);
    notification.appendChild(closeBtn);
    
    // Add to document
    document.body.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
      notification.classList.add('fadeout');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
  
  /**
   * Debounce function to limit how often a function can be called
   * @param {Function} func - The function to debounce
   * @param {number} wait - The debounce wait time in milliseconds
   * @returns {Function} The debounced function
   */
  export function debounce(func, wait = 300) {
    let timeout;
    
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }