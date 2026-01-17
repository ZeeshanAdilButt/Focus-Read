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
    title: "Start Focus Read from here",
    contexts: ["selection", "page", "frame"],
    documentUrlPatterns: ["<all_urls>"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "focus-read-from-here") {
    // Open the side panel first just in case
    chrome.sidePanel.open({ tabId: tab.id }, () => {
        // Send a message to the side panel (needs a small delay or retry if panel wasn't open)
        // Actually, we can't send directly to side panel easily from here unless we use runtime.connect or broadbast.
        // Better pattern: Send message to the tab/content script to "get relevant text"
        // and then the content script sends it to the Side Panel, OR generic storage.
        
        // For now, let's just trigger the side panel to "pull" the selection.
        setTimeout(() => {
             chrome.runtime.sendMessage({
                action: "contextMenuTriggered",
                selectionText: info.selectionText,
                tabId: tab.id
             });
        }, 500); 
    });
  }
});

