console.log("Focus Read Content Script Loaded");

// Function to extract text from the page
function extractPageContent() {
  // Simple extraction for now - creates a list of words with their element references if possible
  // For better PDF support, we might need a specific PDF parser or integration if we use a custom viewer.
  // For standard web pages:
  const textContent = document.body.innerText;
  return textContent;
}

// Listen for messages from the side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getContent") {
    sendResponse({ content: extractPageContent() });
  } else if (request.action === "highlight") {
      // Logic to highlight text on the page
      // This is complex because we need to map the word index back to the DOM
      // For MVP, we might just highlight the paragraph or sentence
      // Placeholder for highlight logic
      console.log("Highlighting:", request.text);
      if (document.body) {
          // Rudimentary Highlight: Find text and scroll to it?
          // Using window.find is the nuclear option but effective for MVP
          // Note: window.find selects the text.
          
          try {
             // Reset selection first
             window.getSelection().removeAllRanges();
             
             // Find the specific word. Problem: "the" appears 1000 times.
             // We need context or index. window.find finds NEXT occurrence.
             // If we keep state, we might track it.
             // But we are stateless here mostly.
             
             // Better MVP: Don't highlight on standard webpage yet to avoid breaking UI 
             // or annoying user until we have a robust "App mode" overlay.
             // The user asked for "highlight text being read in actual doc".
             
             // Let's at least try to highlight the first match of the current chunk?
             // Or maybe rely on the index if we had a mapping.
          } catch(e) {}
      }
  }
});

