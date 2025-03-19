console.log("Content script loaded");

// Notify that content script is ready
chrome.runtime.sendMessage({ action: "contentScriptReady" });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Content script received message:", message);

  try {
    switch (message.action) {
      case "getPageDetails":
        console.log("Getting page details...");
        const details = {
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString(),
        };
        console.log("Page details:", details);
        sendResponse(details);
        break;

      case "getFullHTML":
        sendResponse({
          html: document.documentElement.outerHTML,
        });
        break;

      case "getVisibleElements":
        console.log("Getting visible elements...");
        const elements = Array.from(document.querySelectorAll("*"))
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          })
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            id: el.id,
            classes: Array.from(el.classList),
            text: el.textContent.trim().slice(0, 100), // First 100 chars
            isVisible: true,
          }));
        console.log("Found visible elements:", elements.length);
        const response = { elements: elements };
        console.log("Sending response:", response);
        sendResponse(response);
        break;

      case "getScripts":
        const scripts = Array.from(document.scripts).map((script) => ({
          src: script.src,
          type: script.type,
          content: script.textContent,
        }));
        sendResponse({ scripts });
        break;

      case "getStyles":
        const styles = Array.from(document.styleSheets).map((sheet) => ({
          href: sheet.href,
          rules: Array.from(sheet.cssRules || []).map((rule) => rule.cssText),
        }));
        sendResponse({ styles });
        break;

      case "getMetaData":
        const meta = {
          viewport: document.querySelector('meta[name="viewport"]')?.content,
          description: document.querySelector('meta[name="description"]')
            ?.content,
          keywords: document.querySelector('meta[name="keywords"]')?.content,
          robots: document.querySelector('meta[name="robots"]')?.content,
        };
        sendResponse({ meta });
        break;

      default:
        console.log("Unknown action:", message.action);
        sendResponse({ error: "Unknown action" });
    }
  } catch (error) {
    console.error("Error in content script:", error);
    sendResponse({ error: error.message });
  }

  return true; // Required for async response
});
