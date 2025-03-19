import config from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("DevTools panel loaded");

  const testCaseInput = document.getElementById("testCase");
  const generateBtn = document.getElementById("generateBtn");
  const loadingDiv = document.getElementById("loading");
  const errorDiv = document.getElementById("error");
  const outputDiv = document.getElementById("output");

  if (
    !testCaseInput ||
    !generateBtn ||
    !loadingDiv ||
    !errorDiv ||
    !outputDiv
  ) {
    console.error("Required DOM elements not found:", {
      testCaseInput: !!testCaseInput,
      generateBtn: !!generateBtn,
      loadingDiv: !!loadingDiv,
      errorDiv: !!errorDiv,
      outputDiv: !!outputDiv,
    });
    return;
  }

  console.log("All DOM elements found successfully");

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
      const script = await generateScriptWithAI(
        testCase,
        pageDetails,
        elementsResponse.elements
      );
      console.log("Script generated successfully");
      showOutput(script);
    } catch (error) {
      console.error("Error generating script:", error);
      showError(error.message);
    } finally {
      hideLoading();
    }
  });

  function showLoading() {
    console.log("Showing loading state");
    loadingDiv.style.display = "block";
    generateBtn.disabled = true;
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
  }
});

async function generateScriptWithAI(testCase, pageDetails, elements) {
  console.log("Generating script with AI...");

  const prompt = `Generate a Playwright test script for the following test case. Return ONLY the script content within backticks, without any explanations or comments outside the script:

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

Return ONLY the script content within backticks, nothing else.`;

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
                "You are a Playwright test automation expert. Generate clear, well-structured test scripts that follow best practices. Return ONLY the script content within backticks, without any explanations or comments outside the script.",
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

    // Extract only the content within backticks
    const content = data.choices[0].message.content;
    const scriptMatch = content.match(/```javascript\n([\s\S]*?)```/);
    return scriptMatch ? scriptMatch[1].trim() : content.trim();
  } catch (error) {
    console.error("Error in generateScriptWithAI:", error);
    throw error;
  }
}
