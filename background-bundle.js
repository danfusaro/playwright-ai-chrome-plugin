// JSZip library code will be here
// ... existing code ...

// Our background script code
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

  if (message.type === "exportTests") {
    handleExportTests(message.tests)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
});

// Handle test export
async function handleExportTests(tests) {
  try {
    // Create a zip file containing all tests
    const zip = new JSZip();

    // Add each test to the zip
    tests.forEach((test) => {
      zip.file(test.filename, test.body);
    });

    // Generate the zip file
    const zipContent = await zip.generateAsync({ type: "blob" });

    // Create a URL for the zip file
    const url = URL.createObjectURL(zipContent);

    // Download the zip file
    await chrome.downloads.download({
      url: url,
      filename: "playwright-tests.zip",
      saveAs: true,
    });

    // Clean up the URL
    URL.revokeObjectURL(url);

    return {
      success: true,
      message: `Exported ${tests.length} tests successfully`,
    };
  } catch (error) {
    console.error("Error exporting tests:", error);
    return { success: false, error: error.message };
  }
}
