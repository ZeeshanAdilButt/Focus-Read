// Listen for the extension icon click to open the side panel
chrome.action.onClicked.addListener((tab) => {
  // Open the side panel
  chrome.sidePanel.open({ tabId: tab.id });
});

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

