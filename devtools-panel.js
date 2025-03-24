import config from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("DevTools panel loaded");

  const testCaseInput = document.getElementById("testCase");
  const generateBtn = document.getElementById("generateBtn");
  const saveBtn = document.getElementById("saveBtn");
  const loadingDiv = document.getElementById("loading");
  const errorDiv = document.getElementById("error");
  const outputDiv = document.getElementById("output");
  const suiteNameInput = document.getElementById("suiteName");
  const suiteNameLabel = document.querySelector(".suite-name-label");
  const editSuiteNameBtn = document.getElementById("editSuiteNameBtn");
  const updateSuiteNameBtn = document.getElementById("updateSuiteNameBtn");

  if (
    !testCaseInput ||
    !generateBtn ||
    !saveBtn ||
    !loadingDiv ||
    !errorDiv ||
    !outputDiv ||
    !suiteNameInput ||
    !suiteNameLabel ||
    !editSuiteNameBtn ||
    !updateSuiteNameBtn
  ) {
    console.error("Required DOM elements not found:", {
      testCaseInput: !!testCaseInput,
      generateBtn: !!generateBtn,
      saveBtn: !!saveBtn,
      loadingDiv: !!loadingDiv,
      errorDiv: !!errorDiv,
      outputDiv: !!outputDiv,
      suiteNameInput: !!suiteNameInput,
      suiteNameLabel: !!suiteNameLabel,
      editSuiteNameBtn: !!editSuiteNameBtn,
      updateSuiteNameBtn: !!updateSuiteNameBtn,
    });
    return;
  }

  console.log("All DOM elements found successfully");

  let currentScript = "";

  // Test storage and management
  let savedTests = [];
  let currentTest = null;
  let suiteName = "Saved Tests";

  // DOM Elements
  const savedTestsList = document.getElementById("savedTestsList");
  const newTestBtn = document.getElementById("newTestBtn");
  const exportTestsBtn = document.getElementById("exportTestsBtn");

  // Load saved tests and suite name from storage
  async function loadSavedTests() {
    try {
      const result = await chrome.storage.local.get([
        "savedTests",
        "suiteName",
      ]);
      savedTests = result.savedTests || [];
      suiteName = result.suiteName || "Saved Tests";
      suiteNameInput.value = suiteName;
      suiteNameLabel.textContent = suiteName;
      renderSavedTests();
    } catch (err) {
      console.error("Error loading saved tests:", err);
    }
  }

  // Load saved tests immediately when the panel opens
  loadSavedTests();

  // Save tests and suite name to storage
  async function saveTestsToStorage() {
    try {
      await chrome.storage.local.set({
        savedTests,
        suiteName: suiteNameInput.value,
      });
    } catch (err) {
      console.error("Error saving tests:", err);
    }
  }

  // Handle suite name editing
  editSuiteNameBtn.addEventListener("click", () => {
    suiteNameInput.classList.add("editing");
    suiteNameLabel.style.display = "none";
    editSuiteNameBtn.style.display = "none";
    updateSuiteNameBtn.style.display = "block";
    suiteNameInput.focus();
  });

  updateSuiteNameBtn.addEventListener("click", async () => {
    const newName = suiteNameInput.value.trim();
    if (newName) {
      suiteNameLabel.textContent = newName;
      suiteNameLabel.style.display = "block";
      suiteNameInput.classList.remove("editing");
      editSuiteNameBtn.style.display = "block";
      updateSuiteNameBtn.style.display = "none";
      await saveTestsToStorage();
    }
  });

  // Handle Enter key in suite name input
  suiteNameInput.addEventListener("keypress", async (e) => {
    if (e.key === "Enter") {
      const newName = suiteNameInput.value.trim();
      if (newName) {
        suiteNameLabel.textContent = newName;
        suiteNameLabel.style.display = "block";
        suiteNameInput.classList.remove("editing");
        editSuiteNameBtn.style.display = "block";
        updateSuiteNameBtn.style.display = "none";
        await saveTestsToStorage();
      }
    }
  });

  // Handle Escape key in suite name input
  suiteNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      suiteNameInput.value = suiteNameLabel.textContent;
      suiteNameLabel.style.display = "block";
      suiteNameInput.classList.remove("editing");
      editSuiteNameBtn.style.display = "block";
      updateSuiteNameBtn.style.display = "none";
    }
  });

  // Render the list of saved tests
  function renderSavedTests() {
    savedTestsList.innerHTML = "";
    savedTests.slice(0, 10).forEach((test, index) => {
      const testElement = document.createElement("div");
      testElement.className = "saved-test-item";
      testElement.innerHTML = `
        <div class="test-filename">${test.filename}</div>
        <div class="test-instructions">${test.instructions}</div>
        <div class="test-actions">
          <button class="select-test-btn" data-index="${index}">Select</button>
          <button class="delete-test-btn" data-index="${index}">Delete</button>
        </div>
        <div class="test-details" id="testDetails${index}">
          <div class="test-body">${test.body}</div>
        </div>
      `;

      // Add event listeners to the buttons
      const selectBtn = testElement.querySelector(".select-test-btn");
      const deleteBtn = testElement.querySelector(".delete-test-btn");

      selectBtn.addEventListener("click", () => selectTest(index));
      deleteBtn.addEventListener("click", () => deleteTest(index));

      savedTestsList.appendChild(testElement);
    });
  }

  // Make functions globally accessible for onclick handlers
  function selectTest(index) {
    const test = savedTests[index];
    currentTest = test;

    // Load the test data into the view
    testCaseInput.value = test.instructions;
    outputDiv.textContent = test.body;

    // Enable the save button for updates
    saveBtn.disabled = false;

    // Show test details
    const detailsElement = document.getElementById(`testDetails${index}`);
    if (detailsElement) {
      detailsElement.classList.toggle("show");
    }

    // Update selected state
    document.querySelectorAll(".saved-test-item").forEach((item, i) => {
      item.classList.toggle("selected", i === index);
    });

    // Scroll the selected test into view
    const selectedItem = document.querySelector(".saved-test-item.selected");
    if (selectedItem) {
      selectedItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function deleteTest(index) {
    if (confirm("Are you sure you want to delete this test?")) {
      savedTests.splice(index, 1);
      saveTestsToStorage();
      renderSavedTests();
    }
  }

  // Export all tests
  async function exportTests() {
    try {
      // Send message to background script to handle export
      const response = await chrome.runtime.sendMessage({
        type: "exportTests",
        tests: savedTests.map((test) => ({
          name: test.filename.replace(".js", ""),
          code: test.body,
          metadata: {
            description: test.description,
            url: test.url,
            timestamp: test.timestamp,
          },
        })),
        suiteName: suiteNameInput.value,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to export tests");
      }

      showOutput(response.message);
    } catch (error) {
      console.error("Error exporting tests:", error);
      showError(`Failed to export tests: ${error.message}`);
    }
  }

  // Listen for messages from the background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "exportTestsToDevTools") {
      // Handle the export request
      exportTests()
        .then(() => sendResponse({ success: true }))
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Keep the message channel open for async response
    }
  });

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

  // Create a new test
  function createNewTest() {
    // Clear the current view
    testCaseInput.value = "";
    outputDiv.textContent = "";
    saveBtn.disabled = true;
    currentTest = null;

    // Deselect any selected item in the list
    document.querySelectorAll(".saved-test-item").forEach((item) => {
      item.classList.remove("selected");
    });

    // Hide any open test details
    document.querySelectorAll(".test-details").forEach((details) => {
      details.classList.remove("show");
    });
  }

  saveBtn.addEventListener("click", async () => {
    try {
      // Get the current tab's URL
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs || !tabs[0]) {
        throw new Error("Could not find active tab");
      }
      const currentUrl = tabs[0].url;

      if (!currentTest) {
        // Generate a contextual filename for the new test
        const filename = await generateFilename(testCaseInput.value);

        // Create new test
        const newTest = {
          instructions: testCaseInput.value,
          body: outputDiv.textContent,
          filename: filename,
          description: testCaseInput.value,
          url: currentUrl,
          timestamp: new Date().toISOString(),
        };
        savedTests.unshift(newTest);
      } else {
        // Update existing test
        currentTest.instructions = testCaseInput.value;
        currentTest.body = outputDiv.textContent;
      }

      saveTestsToStorage();
      renderSavedTests();

      // Clear the input and output after saving
      testCaseInput.value = "";
      outputDiv.textContent = "";
      currentTest = null;
      saveBtn.textContent = "Save Test";
    } catch (error) {
      console.error("Error saving test:", error);
      showError(`Failed to save test: ${error.message}`);
    }
  });

  // Add event listener for the New Test button
  newTestBtn.addEventListener("click", createNewTest);

  exportTestsBtn.addEventListener("click", exportTests);

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
