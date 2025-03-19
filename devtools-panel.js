import config from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("DevTools panel loaded");

  const testCaseInput = document.getElementById("testCase");
  const generateBtn = document.getElementById("generateBtn");
  const saveBtn = document.getElementById("saveBtn");
  const loadingDiv = document.getElementById("loading");
  const errorDiv = document.getElementById("error");
  const outputDiv = document.getElementById("output");

  if (
    !testCaseInput ||
    !generateBtn ||
    !saveBtn ||
    !loadingDiv ||
    !errorDiv ||
    !outputDiv
  ) {
    console.error("Required DOM elements not found:", {
      testCaseInput: !!testCaseInput,
      generateBtn: !!generateBtn,
      saveBtn: !!saveBtn,
      loadingDiv: !!loadingDiv,
      errorDiv: !!errorDiv,
      outputDiv: !!outputDiv,
    });
    return;
  }

  console.log("All DOM elements found successfully");

  let currentScript = "";

  generateBtn.addEventListener("click", async () => {
    console.log("Generate button clicked");
    const testCase = testCaseInput.value.trim();
    if (!testCase) {
      showError("Please enter a test case");
      return;
    }

    try {
      showLoading();
      hideError();
      clearOutput();

      // Get the current tab's details
      console.log("Querying current tab...");
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs || !tabs[0]) {
        throw new Error("Could not find active tab");
      }
      const tabId = tabs[0].id;
      console.log("Found active tab:", tabId);

      // Get page details and visible elements through background script
      console.log("Requesting page details and elements...");
      const [pageDetails, elementsResponse] = await Promise.all([
        new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { action: "getPageDetails", tabId },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error getting page details:",
                  chrome.runtime.lastError
                );
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            }
          );
        }),
        new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { action: "getVisibleElements", tabId },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error getting visible elements:",
                  chrome.runtime.lastError
                );
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            }
          );
        }),
      ]);

      console.log("Page details received:", pageDetails);
      console.log("Elements response received:", elementsResponse);

      if (!pageDetails || !elementsResponse) {
        throw new Error("Failed to get page details or elements");
      }

      // Generate the script
      console.log("Generating script with AI...");
      currentScript = await generateScriptWithAI(
        testCase,
        pageDetails,
        elementsResponse.elements
      );
      console.log("Script generated successfully");
      showOutput(currentScript);
      saveBtn.disabled = false;
    } catch (error) {
      console.error("Error generating script:", error);
      showError(error.message);
    } finally {
      hideLoading();
    }
  });

  saveBtn.addEventListener("click", async () => {
    if (!currentScript) {
      showError("No script to save");
      return;
    }

    try {
      const testCase = testCaseInput.value.trim();
      const filename = await generateFilename(testCase);

      // Create a blob with the script content
      const blob = new Blob([currentScript], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);

      // Create a temporary link element
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;

      // Append to body, click, and cleanup
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error saving script:", error);
      showError("Failed to save script: " + error.message);
    }
  });

  function showLoading() {
    console.log("Showing loading state");
    loadingDiv.style.display = "block";
    generateBtn.disabled = true;
    saveBtn.disabled = true;
  }

  function hideLoading() {
    console.log("Hiding loading state");
    loadingDiv.style.display = "none";
    generateBtn.disabled = false;
  }

  function showError(message) {
    console.log("Showing error:", message);
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
  }

  function hideError() {
    console.log("Hiding error");
    errorDiv.style.display = "none";
  }

  function showOutput(script) {
    console.log("Showing output");
    outputDiv.textContent = script;
  }

  function clearOutput() {
    console.log("Clearing output");
    outputDiv.textContent = "";
    currentScript = "";
    saveBtn.disabled = true;
  }
});

async function generateScriptWithAI(testCase, pageDetails, elements) {
  console.log("Generating script with AI...");

  const prompt = `Generate a Playwright test script for the following test case. Return ONLY the script content, without any explanations, comments, or backticks:

Test Case: ${testCase}

Page Details:
URL: ${pageDetails.url}
Title: ${pageDetails.title}

Visible Elements:
${JSON.stringify(elements, null, 2)}

Generate a complete Playwright test script that:
1. Uses proper selectors and assertions
2. Includes error handling
3. Follows best practices
4. Is well-documented
5. Uses async/await properly

Return ONLY the script content, nothing else.`;

  try {
    console.log("Making API request to Azure OpenAI...");
    const response = await fetch(
      `https://${config.azure.endpoint}.openai.azure.com/openai/deployments/${config.azure.deployment}/chat/completions?api-version=${config.azure.apiVersion}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": config.azure.apiKey,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are a Playwright test automation expert. Generate clear, well-structured test scripts that follow best practices. Return ONLY the script content, without any explanations, comments, or backticks.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API response not OK:", response.status, errorText);
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("AI response received:", data);

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response format from AI");
    }

    // Clean up the response by removing any backticks and extra whitespace
    const content = data.choices[0].message.content;
    return content.replace(/```javascript\n?|\n?```/g, "").trim();
  } catch (error) {
    console.error("Error in generateScriptWithAI:", error);
    throw error;
  }
}

async function generateFilename(testCase) {
  try {
    const response = await fetch(
      `https://${config.azure.endpoint}.openai.azure.com/openai/deployments/${config.azure.deployment}/chat/completions?api-version=${config.azure.apiVersion}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": config.azure.apiKey,
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that generates appropriate filenames for Playwright test scripts. Return ONLY the filename with .js extension, nothing else. The filename should be kebab-case and descriptive of the test case.",
            },
            {
              role: "user",
              content: `Generate a filename for this test case: ${testCase}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 50,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Invalid response format from AI");
    }

    let filename = data.choices[0].message.content.trim();
    // Ensure the filename ends with .js
    if (!filename.endsWith(".js")) {
      filename += ".js";
    }
    // Clean up the filename to ensure it's valid
    filename = filename.replace(/[^a-z0-9-_.]/gi, "-").toLowerCase();
    return filename;
  } catch (error) {
    console.error("Error generating filename:", error);
    // Fallback to a simple filename if AI generation fails
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `playwright-test-${timestamp}.js`;
  }
}
