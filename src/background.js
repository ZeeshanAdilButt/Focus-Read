// Listen for the extension icon click to open the side panel
chrome.action.onClicked.addListener((tab) => {
  // Open the side panel
  chrome.sidePanel.open({ tabId: tab.id });
});

// Store for fullscreen state sharing
let fullscreenState = null;

// Setup context menu or other background tasks here if needed
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.contextMenus.create({
    id: "focus-read-from-here",
    title: "Flow from here",
    contexts: ["selection", "page", "frame"],
    documentUrlPatterns: ["<all_urls>"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "focus-read-from-here") {
    // First, ask the content script for the clicked word index
    chrome.tabs.sendMessage(tab.id, { action: "getClickedWordIndex" }, (response) => {
      const clickedIndex = response?.wordIndex ?? -1;
      
      // Open the side panel
      chrome.sidePanel.open({ tabId: tab.id }, () => {
        // Small delay for panel to initialize, then send message
        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: "contextMenuTriggered",
            selectionText: info.selectionText || '',
            clickedWordIndex: clickedIndex,
            tabId: tab.id
          });
        }, 600); 
      });
    });
  }
});

// Handle messages for fullscreen mode
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openFullscreen") {
    // Store the state for fullscreen page to retrieve
    fullscreenState = {
      words: message.words,
      currentIndex: message.currentIndex,
      config: message.config,
      wasPlaying: message.wasPlaying
    };
    
    // Open fullscreen page in a new popup window
    chrome.windows.create({
      url: chrome.runtime.getURL("fullscreen.html"),
      type: "popup",
      state: "fullscreen"
    });
    sendResponse({ success: true });
  }
  
  if (message.action === "getFullscreenContent") {
    // Fullscreen page is requesting content
    sendResponse(fullscreenState || { words: [], currentIndex: 0 });
  }
  
  if (message.action === "fullscreenClosed") {
    // Fullscreen closed, notify sidepanel to sync state
    chrome.runtime.sendMessage({
      action: "syncFromFullscreen",
      currentIndex: message.currentIndex,
      wasPlaying: message.wasPlaying
    }).catch(() => {});
    fullscreenState = null;
    sendResponse({ success: true });
  }
  
  if (message.action === "fullscreenSync") {
    // Periodic sync from fullscreen
    chrome.runtime.sendMessage({
      action: "syncFromFullscreen",
      currentIndex: message.currentIndex,
      wasPlaying: false
    }).catch(() => {});
  }
  
  if (message.action === "highlightFromFullscreen") {
    // Forward highlight request to active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "highlightWord",
          index: message.index,
          wordCount: message.wordCount,
          text: message.text
        }).catch(() => {});
      }
    });
  }
  
  if (message.action === "clearHighlightFromFullscreen") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "clearHighlight"
        }).catch(() => {});
      }
    });
  }
  
  return true;
});


