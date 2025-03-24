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
        const htmlContent = document.documentElement.innerHTML;
        sendResponse({
          html: htmlContent,
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
            id: el.id || undefined,
            classes: el.classList.length ? Array.from(el.classList) : undefined,
            text: el.textContent.trim().slice(0, 50),
          }));
        console.log("Found visible elements:", elements.length);
        sendResponse({ elements });
        break;

      case "getScripts":
        const scripts = Array.from(document.scripts)
          .filter((script) => script.src || script.textContent.trim())
          .map((script) => ({
            src: script.src || undefined,
            type: script.type || undefined,
            content: script.textContent.trim().slice(0, 200) || undefined,
          }));
        sendResponse({ scripts });
        break;

      case "getStyles":
        const styles = Array.from(document.styleSheets)
          .filter((sheet) => sheet.href || sheet.cssRules?.length)
          .map((sheet) => ({
            href: sheet.href || undefined,
            rules: sheet.cssRules
              ? Array.from(sheet.cssRules)
                  .map((rule) => rule.cssText.slice(0, 200))
                  .filter((rule) => rule.length > 0)
              : undefined,
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
