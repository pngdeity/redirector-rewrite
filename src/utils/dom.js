/**
 * DOM Utilities
 * Safe element creation and sanitization utilities to prevent XSS and avoid legacy raw string HTML bindings.
 */
export class Dom {
  /**
   * Helper to create elements with safe attributes, classes, events, and child nodes.
   * @param {string} tag - The HTML tag name (e.g. 'div', 'button')
   * @param {Object} [options] - Options configuration
   * @param {Array<string>} [options.classes] - Array of class names
   * @param {Object} [options.attributes] - Key-value map of attributes
   * @param {Object} [options.events] - Key-value map of event listeners
   * @param {string} [options.text] - Safe text content (sets textContent)
   * @param {Array<HTMLElement>} [options.children] - Array of child elements
   * @returns {HTMLElement} The created DOM element
   */
  static create(tag, options = {}) {
    const el = document.createElement(tag);
    
    // Classes
    if (options.classes && Array.isArray(options.classes)) {
      options.classes.forEach(c => el.classList.add(c));
    }
    
    // Attributes
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          el.setAttribute(key, String(val));
        }
      });
    }
    
    // Event listeners
    if (options.events) {
      Object.entries(options.events).forEach(([event, handler]) => {
        el.addEventListener(event, handler);
      });
    }
    
    // Text content (Safe)
    if (options.text !== undefined) {
      el.textContent = options.text;
    }
    
    
    // Children
    if (options.children && Array.isArray(options.children)) {
      options.children.forEach(child => {
        if (child instanceof Node) {
          el.appendChild(child);
        }
      });
    }
    
    return el;
  }
}
