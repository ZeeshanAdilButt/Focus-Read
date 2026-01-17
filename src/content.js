console.log("Flow Mate Content Script Loaded");

// Highlight overlay element
let highlightOverlay = null;
let currentHighlightRange = null;

// Track last right-click position for "Flow from here"
let lastClickedWordIndex = 0;

// Paragraph boundaries (word indices where paragraphs start)
let paragraphStarts = [];

// Create highlight styles
const style = document.createElement('style');
style.textContent = `
  .flowmate-highlight {
    background: rgba(231, 76, 60, 0.25) !important;
    outline: 2px solid rgba(231, 76, 60, 0.8) !important;
    border-radius: 3px;
    transition: all 0.15s ease;
    box-shadow: 0 0 15px rgba(231, 76, 60, 0.3);
  }
  .flowmate-highlight-mark {
    background: linear-gradient(135deg, rgba(231, 76, 60, 0.4), rgba(243, 156, 18, 0.3)) !important;
    padding: 2px 0;
    border-radius: 2px;
  }
`;
document.head.appendChild(style);

// Track right-click position to find word under cursor
document.addEventListener('contextmenu', (e) => {
    // Get word index at click position
    const wordIndex = getWordIndexAtPoint(e.clientX, e.clientY);
    if (wordIndex !== -1) {
        lastClickedWordIndex = wordIndex;
        console.log("Flow Mate: Right-clicked at word index", wordIndex, "word:", getWordAtIndex(wordIndex));
    } else {
        // Fallback: try to find nearest word by checking nearby positions
        const offsets = [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5], [10, 0], [-10, 0]];
        for (const [dx, dy] of offsets) {
            const idx = getWordIndexAtPoint(e.clientX + dx, e.clientY + dy);
            if (idx !== -1) {
                lastClickedWordIndex = idx;
                console.log("Flow Mate: Right-clicked near word index", idx, "(fallback)");
                break;
            }
        }
    }
});

// Get word at specific index (for debugging)
function getWordAtIndex(index) {
    const result = extractPageContent();
    const words = result.text.split(/\s+/);
    return words[index] || '(unknown)';
}

// Find word index at a given screen coordinate
function getWordIndexAtPoint(x, y) {
    const range = document.caretRangeFromPoint(x, y);
    if (!range) return -1;
    
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return -1;
    
    // Count words up to this point
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(n) {
                const parent = n.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tag = parent.tagName.toLowerCase();
                if (tag === 'script' || tag === 'style' || tag === 'noscript') {
                    return NodeFilter.FILTER_REJECT;
                }
                if (n.textContent.trim().length === 0) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
    
    let wordCount = 0;
    let currentNode;
    
    while (currentNode = walker.nextNode()) {
        if (currentNode === node) {
            // Found the node, count words up to click offset
            const textBefore = node.textContent.substring(0, range.startOffset);
            const wordsBefore = textBefore.split(/\s+/).filter(w => w.length > 0).length;
            return wordCount + wordsBefore;
        }
        // Count words in this node
        const words = currentNode.textContent.split(/\s+/).filter(w => w.length > 0);
        wordCount += words.length;
    }
    
    return -1;
}

// Function to extract text from the page with paragraph info
// IMPORTANT: Uses TreeWalker for consistency with getWordIndexAtPoint()
function extractPageContent() {
    const result = { text: '', paragraphStarts: [] };
    const allWords = [];
    let currentBlockElement = null;
    
    // Use TreeWalker - MUST match the same filtering as getWordIndexAtPoint()
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function(n) {
                const parent = n.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tag = parent.tagName.toLowerCase();
                if (tag === 'script' || tag === 'style' || tag === 'noscript') {
                    return NodeFilter.FILTER_REJECT;
                }
                if (n.textContent.trim().length === 0) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );
    
    paragraphStarts = [0]; // First paragraph starts at 0
    
    let node;
    while (node = walker.nextNode()) {
        const words = node.textContent.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) continue;
        
        // Find the nearest block-level parent for paragraph detection
        let blockParent = node.parentElement;
        while (blockParent && !['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'ARTICLE', 'BLOCKQUOTE', 'DIV', 'SECTION'].includes(blockParent.tagName)) {
            blockParent = blockParent.parentElement;
        }
        
        // If we moved to a new block element, mark paragraph start
        if (blockParent && blockParent !== currentBlockElement && allWords.length > 0) {
            paragraphStarts.push(allWords.length);
            currentBlockElement = blockParent;
        } else if (!currentBlockElement) {
            currentBlockElement = blockParent;
        }
        
        allWords.push(...words);
    }
    
    result.text = allWords.join(' ');
    result.paragraphStarts = paragraphStarts;
    return result;
}

// Track the last highlighted word index
let lastHighlightIndex = -1;

// Build a map of all words with their positions for efficient lookup
function buildWordMap() {
  const wordMap = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.textContent.trim().length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent;
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      wordMap.push({
        node: node,
        word: match[0],
        startOffset: match.index,
        endOffset: match.index + match[0].length
      });
    }
  }
  return wordMap;
}

// Find text node containing the Nth word in the document
function findWordByIndex(targetIndex) {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script/style/hidden elements
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.textContent.trim().length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let wordCount = 0;
  let node;
  
  while (node = walker.nextNode()) {
    const text = node.textContent;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    for (let i = 0; i < words.length; i++) {
      if (wordCount === targetIndex) {
        // Found the target word
        // Now find its position in the text node
        const word = words[i];
        let offset = 0;
        let wordIdx = 0;
        
        // Find the start position of this word in the text
        const regex = /\S+/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          if (wordIdx === i) {
            offset = match.index;
            break;
          }
          wordIdx++;
        }
        
        return {
          node: node,
          word: word,
          startOffset: offset,
          endOffset: offset + word.length
        };
      }
      wordCount++;
    }
  }
  
  return null;
}

// Find multiple consecutive words starting from an index
function findWordRangeByIndex(startIndex, wordCount) {
  const wordMap = buildWordMap();
  
  if (startIndex < 0 || startIndex >= wordMap.length) return null;
  
  const endIndex = Math.min(startIndex + wordCount - 1, wordMap.length - 1);
  const startWord = wordMap[startIndex];
  const endWord = wordMap[endIndex];
  
  if (!startWord || !endWord) return null;
  
  return {
    startNode: startWord.node,
    startOffset: startWord.startOffset,
    endNode: endWord.node,
    endOffset: endWord.endOffset,
    sameNode: startWord.node === endWord.node
  };
}

// Find and highlight text using word index for accuracy
function highlightTextInDocument(searchText, contextBefore, contextAfter, wordIndex, wordCount = 1) {
  if (!searchText || searchText.length < 1) return;
  
  // Clear previous highlight
  clearHighlight();
  
  try {
    // If we have a valid word index, use it for precise positioning
    if (wordIndex !== undefined && wordIndex >= 0) {
      // Use multi-word range if we need to highlight more than 1 word
      const actualWordCount = Math.max(1, wordCount);
      const rangeResult = findWordRangeByIndex(wordIndex, actualWordCount);
      
      if (rangeResult) {
        const range = document.createRange();
        range.setStart(rangeResult.startNode, rangeResult.startOffset);
        range.setEnd(rangeResult.endNode, rangeResult.endOffset);
        
        const rects = range.getClientRects();
        
        // For multi-word selections spanning multiple lines, we create multiple overlays
        if (rects.length > 0) {
          // Scroll into view
          const element = rangeResult.startNode.parentElement;
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          
          // Create highlight overlay for each rect (handles multi-line)
          for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            if (rect.width > 0 && rect.height > 0) {
              const overlay = document.createElement('div');
              overlay.className = 'flowmate-highlight';
              overlay.style.cssText = `
                position: fixed;
                left: ${rect.left - 3}px;
                top: ${rect.top - 2}px;
                width: ${rect.width + 6}px;
                height: ${rect.height + 4}px;
                pointer-events: none;
                z-index: 999999;
                background: linear-gradient(135deg, rgba(231, 76, 60, 0.15), rgba(243, 156, 18, 0.1));
                border: 2px solid rgba(231, 76, 60, 0.7);
                border-radius: 4px;
                box-shadow: 0 0 12px rgba(231, 76, 60, 0.3);
              `;
              document.body.appendChild(overlay);
              
              // Keep reference to first overlay for cleanup
              if (i === 0) highlightOverlay = overlay;
            }
          }
          
          currentHighlightRange = range;
          lastHighlightIndex = wordIndex;
          return;
        }
      }
    }
    
    // Fallback: use window.find for simple text search
    const selection = window.getSelection();
    selection.removeAllRanges();
    
    let found = window.find(searchText, false, false, false, false, false, false);
    
    if (found) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      if (rect.width > 0 && rect.height > 0) {
        const element = range.startContainer.parentElement;
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        highlightOverlay = document.createElement('div');
        highlightOverlay.className = 'flowmate-highlight';
        highlightOverlay.style.cssText = `
          position: fixed;
          left: ${rect.left - 3}px;
          top: ${rect.top - 2}px;
          width: ${rect.width + 6}px;
          height: ${rect.height + 4}px;
          pointer-events: none;
          z-index: 999999;
          background: linear-gradient(135deg, rgba(231, 76, 60, 0.15), rgba(243, 156, 18, 0.1));
          border: 2px solid rgba(231, 76, 60, 0.7);
          border-radius: 4px;
          box-shadow: 0 0 12px rgba(231, 76, 60, 0.3);
        `;
        document.body.appendChild(highlightOverlay);
        currentHighlightRange = range;
      }
      
      setTimeout(() => selection.removeAllRanges(), 30);
    }
  } catch (e) {
    console.log("Flow Mate: Highlight error", e);
  }
}

function clearHighlight() {
  // Remove ALL highlight overlays (could be multiple for multi-line text)
  const overlays = document.querySelectorAll('.flowmate-highlight');
  overlays.forEach(o => o.remove());
  highlightOverlay = null;
  currentHighlightRange = null;
  lastHighlightIndex = -1; // Reset index tracking
  
  // Also clear any text selection
  try {
    window.getSelection().removeAllRanges();
  } catch (e) {}
}

// Listen for messages from the side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getContent") {
    const result = extractPageContent();
    sendResponse({ 
        content: result.text,
        paragraphStarts: result.paragraphStarts || paragraphStarts
    });
  } else if (request.action === "getClickedWordIndex") {
    // Return the word index where user last right-clicked
    sendResponse({ wordIndex: lastClickedWordIndex });
  } else if (request.action === "highlight") {
    // Highlight the text being read
    const textToHighlight = request.text;
    const wordIndex = request.index;
    const wordCount = request.wordCount || 1;
    const contextBefore = request.contextBefore || '';
    const contextAfter = request.contextAfter || '';
    if (textToHighlight) {
      highlightTextInDocument(textToHighlight, contextBefore, contextAfter, wordIndex, wordCount);
    }
  } else if (request.action === "clearHighlight") {
    clearHighlight();
  } else if (request.action === "resetHighlightPosition") {
    // Reset highlight tracking when starting from a new position
    lastHighlightIndex = -1;
  }
});

