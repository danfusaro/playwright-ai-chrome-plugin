// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("Playwright Script Generator extension installed.");
});

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  console.log("Extension icon clicked for tab:", tab.id);

  try {
    // Ensure content script is injected
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    console.log("Content script injected successfully");
  } catch (error) {
    console.error("Error injecting content script:", error);
  }
});

// Handle messages from DevTools panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background script received message:", message);

  if (
    message.action === "getPageDetails" ||
    message.action === "getVisibleElements"
  ) {
    // First ensure content script is injected
    chrome.scripting
      .executeScript({
        target: { tabId: message.tabId },
        files: ["content.js"],
      })
      .then(() => {
        // After injection, forward the message
        chrome.tabs.sendMessage(message.tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error forwarding message to content script:",
              chrome.runtime.lastError
            );
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse(response);
          }
        });
      })
      .catch((error) => {
        console.error("Error injecting content script:", error);
        sendResponse({ error: error.message });
      });

    return true; // Keep the message channel open for async response
  }
});
