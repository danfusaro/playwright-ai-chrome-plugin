importScripts(chrome.runtime.getURL("lib/jszip.min.js"));

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
    handleExportTests(message.tests, message.suiteName)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Will respond asynchronously
  }
});

// Handle test export
async function handleExportTests(tests, suiteName) {
  try {
    // Create a new zip file
    const zip = new JSZip();

    // Add each test to the zip file
    tests.forEach((test) => {
      // Create a directory for each test
      const testDir = zip.folder(test.name);

      // Add the test file
      testDir.file("test.js", test.code);

      // Add metadata if available
      if (test.metadata) {
        testDir.file("metadata.json", JSON.stringify(test.metadata, null, 2));
      }
    });

    // Generate the zip file as a blob
    const content = await zip.generateAsync({ type: "blob" });

    // Convert blob to base64
    const reader = new FileReader();
    const base64Data = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(content);
    });

    // Download the zip file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${suiteName}-${timestamp}.zip`;

    await chrome.downloads.download({
      url: base64Data,
      filename: filename,
      saveAs: true,
    });

    return {
      success: true,
      message: `Exported ${tests.length} tests successfully`,
    };
  } catch (error) {
    console.error("Error exporting tests:", error);
    return { success: false, error: error.message };
  }
}
