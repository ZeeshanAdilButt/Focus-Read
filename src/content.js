console.log("Focus Read Content Script Loaded");

// Highlight overlay element
let highlightOverlay = null;
let currentHighlightRange = null;

// Create highlight styles
const style = document.createElement('style');
style.textContent = `
  .focus-read-highlight {
    background: rgba(231, 76, 60, 0.3) !important;
    outline: 2px solid #e74c3c !important;
    border-radius: 2px;
    transition: all 0.1s ease;
  }
  .focus-read-highlight-mark {
    background: rgba(231, 76, 60, 0.4) !important;
    padding: 2px 0;
    border-radius: 2px;
  }
`;
document.head.appendChild(style);

// Function to extract text from the page
function extractPageContent() {
  const textContent = document.body.innerText;
  return textContent;
}

// Find and highlight text in the DOM
function highlightTextInDocument(searchText) {
  if (!searchText || searchText.length < 2) return;
  
  // Clear previous highlight
  clearHighlight();
  
  // Use window.find to locate and select the text
  // This is a simple but effective approach
  try {
    const selection = window.getSelection();
    selection.removeAllRanges();
    
    // Find the text (case insensitive, not whole word)
    const found = window.find(searchText, false, false, true, false, true, false);
    
    if (found) {
      const range = selection.getRangeAt(0);
      
      // Create a highlight element
      const rect = range.getBoundingClientRect();
      
      if (rect.width > 0 && rect.height > 0) {
        // Scroll the element into view smoothly
        const element = range.startContainer.parentElement;
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Create overlay highlight
        highlightOverlay = document.createElement('div');
        highlightOverlay.className = 'focus-read-highlight';
        highlightOverlay.style.cssText = `
          position: fixed;
          left: ${rect.left - 4}px;
          top: ${rect.top - 2}px;
          width: ${rect.width + 8}px;
          height: ${rect.height + 4}px;
          pointer-events: none;
          z-index: 999999;
          background: rgba(231, 76, 60, 0.25);
          border: 2px solid #e74c3c;
          border-radius: 4px;
          box-shadow: 0 0 10px rgba(231, 76, 60, 0.5);
        `;
        document.body.appendChild(highlightOverlay);
        
        currentHighlightRange = range;
      }
      
      // Keep selection visible briefly then clear
      setTimeout(() => {
        selection.removeAllRanges();
      }, 100);
    }
  } catch (e) {
    console.log("Focus Read: Highlight error", e);
  }
}

function clearHighlight() {
  if (highlightOverlay) {
    highlightOverlay.remove();
    highlightOverlay = null;
  }
  currentHighlightRange = null;
  
  // Also clear any text selection
  try {
    window.getSelection().removeAllRanges();
  } catch (e) {}
}

// Listen for messages from the side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getContent") {
    sendResponse({ content: extractPageContent() });
  } else if (request.action === "highlight") {
    // Highlight the text being read
    const textToHighlight = request.text;
    if (textToHighlight) {
      highlightTextInDocument(textToHighlight);
    }
  } else if (request.action === "clearHighlight") {
    clearHighlight();
  }
});

