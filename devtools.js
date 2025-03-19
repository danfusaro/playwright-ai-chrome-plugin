console.log("DevTools script loaded");

// Create the DevTools panel
chrome.devtools.panels.create(
  "Playwright Generator",
  null,
  "devtools-panel.html",
  (panel) => {
    if (chrome.runtime.lastError) {
      console.error("Error creating DevTools panel:", chrome.runtime.lastError);
    } else {
      console.log("DevTools panel created successfully");

      // Log when the panel is shown
      panel.onShown.addListener(() => {
        console.log("DevTools panel shown");
      });

      // Log when the panel is hidden
      panel.onHidden.addListener(() => {
        console.log("DevTools panel hidden");
      });
    }
  }
);

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("DevTools received message:", message);

  if (message.type === "SCRIPT_GENERATED") {
    console.log("Updating output with generated script");
    const output = document.getElementById("output");
    if (output) {
      output.textContent = message.script;
      console.log("Output updated successfully");
    } else {
      console.error("Output element not found");
    }
  }
});
