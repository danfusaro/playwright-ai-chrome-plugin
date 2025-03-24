import config from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("DevTools panel loaded");

  const testCaseInput = document.getElementById("testCase");
  const generateBtn = document.getElementById("generateBtn");
  const saveBtn = document.getElementById("saveBtn");
  const loadingDiv = document.getElementById("loading");
  const errorDiv = document.getElementById("error");
  const outputDiv = document.getElementById("output");
  const testSuitesList = document.getElementById("testSuitesList");
  const newSuiteBtn = document.getElementById("newSuiteBtn");
  const testGenerator = document.getElementById("testGenerator");

  if (
    !testCaseInput ||
    !generateBtn ||
    !saveBtn ||
    !loadingDiv ||
    !errorDiv ||
    !outputDiv ||
    !testSuitesList ||
    !newSuiteBtn ||
    !testGenerator
  ) {
    console.error("Required DOM elements not found:", {
      testCaseInput: !!testCaseInput,
      generateBtn: !!generateBtn,
      saveBtn: !!saveBtn,
      loadingDiv: !!loadingDiv,
      errorDiv: !!errorDiv,
      outputDiv: !!outputDiv,
      testSuitesList: !!testSuitesList,
      newSuiteBtn: !!newSuiteBtn,
      testGenerator: !!testGenerator,
    });
    return;
  }

  console.log("All DOM elements found successfully");

  let currentScript = "";
  let testSuites = [];
  let currentTest = null;
  let currentSuite = null;

  // Show/hide test generator based on suite selection
  function updateTestGeneratorVisibility() {
    testGenerator.style.display = currentSuite ? "block" : "none";
  }

  // Load test suites from storage
  async function loadTestSuites() {
    try {
      const result = await chrome.storage.local.get("testSuites");
      testSuites = result.testSuites || [];
      renderTestSuites();
    } catch (err) {
      console.error("Error loading test suites:", err);
    }
  }

  // Load test suites immediately when the panel opens
  loadTestSuites();

  // Save test suites to storage
  async function saveTestSuitesToStorage() {
    try {
      await chrome.storage.local.set({ testSuites });
    } catch (err) {
      console.error("Error saving test suites:", err);
    }
  }

  // Create a new test suite
  function createTestSuite() {
    const newSuite = {
      id: Date.now().toString(),
      name: "New Test Suite",
      tests: [],
      isCollapsed: false,
    };
    testSuites.push(newSuite);
    saveTestSuitesToStorage();
    renderTestSuites();
  }

  // Toggle suite collapse state
  function toggleSuiteCollapse(suite) {
    suite.isCollapsed = !suite.isCollapsed;
    saveTestSuitesToStorage();
    renderTestSuites();
  }

  // Delete a test suite
  function deleteTestSuite(suiteId) {
    if (
      confirm(
        "Are you sure you want to delete this test suite and all its tests?"
      )
    ) {
      testSuites = testSuites.filter((suite) => suite.id !== suiteId);
      if (currentSuite && currentSuite.id === suiteId) {
        currentSuite = null;
        currentTest = null;
        testCaseInput.value = "";
        outputDiv.textContent = "";
        saveBtn.disabled = true;
        // Hide the test generator when suite is deleted
        updateTestGeneratorVisibility();
      }
      saveTestSuitesToStorage();
      renderTestSuites();
    }
  }

  // Render all test suites
  function renderTestSuites() {
    testSuitesList.innerHTML = "";
    testSuites.forEach((suite) => {
      const suiteElement = document.createElement("div");
      suiteElement.className = `test-suite ${
        suite.isCollapsed ? "collapsed" : ""
      }`;
      suiteElement.innerHTML = `
        <div class="test-suite-header">
          <div class="suite-name-container">
            <span class="collapse-icon">▼</span>
            <span class="suite-name-label">${suite.name}</span>
            <input type="text" class="suite-name-input" value="${suite.name}" />
            <div class="suite-name-actions">
              <button class="edit-suite-name-btn">Edit</button>
              <button class="update-suite-name-btn" style="display: none">Update</button>
            </div>
          </div>
        </div>
        <div class="saved-tests-list" id="savedTestsList${suite.id}"></div>
        <div class="suite-actions">
          <button class="new-test-btn" data-suite-id="${suite.id}">New Test</button>
          <button class="export-tests-btn" data-suite-id="${suite.id}">Export Tests</button>
          <button class="delete-suite-btn" data-suite-id="${suite.id}">Delete Suite</button>
        </div>
      `;

      // Add click handler for the entire header to toggle collapse
      const header = suiteElement.querySelector(".test-suite-header");
      header.addEventListener("click", (e) => {
        // Don't toggle if clicking on buttons or input
        if (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT") {
          return;
        }
        toggleSuiteCollapse(suite);
      });

      // Add event listeners for suite name editing
      const suiteNameInput = suiteElement.querySelector(".suite-name-input");
      const editSuiteNameBtn = suiteElement.querySelector(
        ".edit-suite-name-btn"
      );
      const updateSuiteNameBtn = suiteElement.querySelector(
        ".update-suite-name-btn"
      );
      const suiteNameLabel = suiteElement.querySelector(".suite-name-label");

      editSuiteNameBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent header click from firing
        suiteNameInput.classList.add("editing");
        suiteNameLabel.style.display = "none";
        editSuiteNameBtn.style.display = "none";
        updateSuiteNameBtn.style.display = "block";
        suiteNameInput.focus();
      });

      updateSuiteNameBtn.addEventListener("click", async (e) => {
        e.stopPropagation(); // Prevent header click from firing
        const newName = suiteNameInput.value.trim();
        if (newName) {
          suite.name = newName;
          suiteNameLabel.textContent = newName;
          suiteNameLabel.style.display = "block";
          suiteNameInput.classList.remove("editing");
          editSuiteNameBtn.style.display = "block";
          updateSuiteNameBtn.style.display = "none";
          await saveTestSuitesToStorage();
        }
      });

      // Handle Enter key in suite name input
      suiteNameInput.addEventListener("keypress", async (e) => {
        e.stopPropagation(); // Prevent header click from firing
        if (e.key === "Enter") {
          const newName = suiteNameInput.value.trim();
          if (newName) {
            suite.name = newName;
            suiteNameLabel.textContent = newName;
            suiteNameLabel.style.display = "block";
            suiteNameInput.classList.remove("editing");
            editSuiteNameBtn.style.display = "block";
            updateSuiteNameBtn.style.display = "none";
            await saveTestSuitesToStorage();
          }
        }
      });

      // Handle Escape key in suite name input
      suiteNameInput.addEventListener("keydown", (e) => {
        e.stopPropagation(); // Prevent header click from firing
        if (e.key === "Escape") {
          suiteNameInput.value = suiteNameLabel.textContent;
          suiteNameLabel.style.display = "block";
          suiteNameInput.classList.remove("editing");
          editSuiteNameBtn.style.display = "block";
          updateSuiteNameBtn.style.display = "none";
        }
      });

      // Add event listeners for suite actions
      const newTestBtn = suiteElement.querySelector(".new-test-btn");
      const exportTestsBtn = suiteElement.querySelector(".export-tests-btn");
      const deleteSuiteBtn = suiteElement.querySelector(".delete-suite-btn");

      newTestBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent header click from firing
        currentSuite = suite;
        createNewTest();
      });

      exportTestsBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent header click from firing
        exportTests(suite);
      });

      deleteSuiteBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent header click from firing
        deleteTestSuite(suite.id);
      });

      // Render tests for this suite
      const savedTestsList = suiteElement.querySelector(
        `#savedTestsList${suite.id}`
      );
      renderSavedTests(suite, savedTestsList);

      testSuitesList.appendChild(suiteElement);
    });
  }

  // Render the list of saved tests for a specific suite
  function renderSavedTests(suite, container) {
    container.innerHTML = "";
    suite.tests.slice(0, 10).forEach((test, index) => {
      const testElement = document.createElement("div");
      testElement.className = "saved-test-item";
      testElement.innerHTML = `
        <div class="test-filename">
          <a href="#" class="test-filename-link">${test.filename}</a>
        </div>
        <div class="test-instructions">${test.instructions}</div>
        <div class="test-actions">
          <button class="copy-code-btn" data-index="${index}">Copy Code</button>
          <button class="delete-test-btn" data-index="${index}">Delete</button>
        </div>
      `;

      // Add event listeners to the buttons and filename link
      const copyCodeBtn = testElement.querySelector(".copy-code-btn");
      const deleteBtn = testElement.querySelector(".delete-test-btn");
      const filenameLink = testElement.querySelector(".test-filename-link");

      // Handle Copy Code
      copyCodeBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          // Create a temporary textarea element
          const textarea = document.createElement("textarea");
          textarea.value = test.body;
          document.body.appendChild(textarea);

          // Select and copy the text
          textarea.select();
          document.execCommand("copy");

          // Remove the temporary textarea
          document.body.removeChild(textarea);

          // Show feedback
          const originalText = copyCodeBtn.textContent;
          copyCodeBtn.textContent = "Copied!";
          setTimeout(() => {
            copyCodeBtn.textContent = originalText;
          }, 2000);
        } catch (err) {
          console.error("Failed to copy code:", err);
          showError("Failed to copy code to clipboard");
        }
      });

      // Handle filename click for test selection
      filenameLink.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectTest(suite, index);
      });

      deleteBtn.addEventListener("click", () => deleteTest(suite, index));

      container.appendChild(testElement);
    });
  }

  // Select a test
  function selectTest(suite, index) {
    const test = suite.tests[index];
    currentSuite = suite;
    currentTest = test;

    // Load the test data into the view
    testCaseInput.value = test.instructions;
    outputDiv.textContent = test.body;

    // Enable the save button for updates
    saveBtn.disabled = false;

    // Update selected state - use suite ID to ensure correct selection
    document.querySelectorAll(".saved-test-item").forEach((item) => {
      item.classList.remove("selected");
    });

    // Find the selected item using the test details ID
    const detailsElement = document.getElementById(
      `testDetails${suite.id}_${index}`
    );
    if (detailsElement) {
      const selectedItem = detailsElement.closest(".saved-test-item");
      if (selectedItem) {
        selectedItem.classList.add("selected");
        selectedItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }

    // Show the test generator
    updateTestGeneratorVisibility();
  }

  // Delete a test
  function deleteTest(suite, index) {
    if (confirm("Are you sure you want to delete this test?")) {
      suite.tests.splice(index, 1);
      if (currentTest && currentSuite && currentSuite.id === suite.id) {
        currentTest = null;
        testCaseInput.value = "";
        outputDiv.textContent = "";
        saveBtn.disabled = true;
      }
      saveTestSuitesToStorage();
      renderTestSuites();
    }
  }

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

    // Show the test generator
    updateTestGeneratorVisibility();
  }

  // Export tests for a specific suite
  async function exportTests(suite) {
    try {
      // Send message to background script to handle export
      const response = await chrome.runtime.sendMessage({
        type: "exportTests",
        tests: suite.tests.map((test) => ({
          name: test.filename.replace(".js", ""),
          code: test.body,
          metadata: {
            description: test.description,
            url: test.url,
            timestamp: test.timestamp,
          },
        })),
        suiteName: suite.name,
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

  // Add event listener for the New Suite button
  newSuiteBtn.addEventListener("click", createTestSuite);

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
        currentSuite.tests.unshift(newTest);
      } else {
        // Update existing test
        currentTest.instructions = testCaseInput.value;
        currentTest.body = outputDiv.textContent;
      }

      saveTestSuitesToStorage();
      renderTestSuites();

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

  const prompt = `Generate a Playwright test script in TypeScript for the following test case. Return ONLY the script content, without any explanations, comments, or backticks:

Test Case: ${testCase}

Page Details:
URL: ${pageDetails.url}
Title: ${pageDetails.title}

Visible Elements:
${JSON.stringify(elements, null, 2)}

Generate a complete Playwright test script in TypeScript that:
1. Uses proper selectors and assertions
2. Includes error handling
3. Follows best practices
4. Is well-documented
5. Uses async/await properly
6. Includes proper TypeScript types
7. Uses Playwright's built-in types

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
                "You are a Playwright test automation expert specializing in TypeScript. Generate clear, well-structured test scripts that follow best practices and include proper TypeScript types. Return ONLY the script content, without any explanations, comments, or backticks.",
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
    return content.replace(/```typescript\n?|\n?```/g, "").trim();
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
                "You are a helpful assistant that generates appropriate filenames for Playwright test scripts. Return ONLY the filename with .spec.ts extension, nothing else. The filename should be kebab-case and descriptive of the test case.",
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
    // Ensure the filename ends with .spec.ts
    if (!filename.endsWith(".spec.ts")) {
      filename = filename.replace(/\.(js|ts)?$/, "") + ".spec.ts";
    }
    // Clean up the filename to ensure it's valid
    filename = filename.replace(/[^a-z0-9-_.]/gi, "-").toLowerCase();
    return filename;
  } catch (error) {
    console.error("Error generating filename:", error);
    // Fallback to a simple filename if AI generation fails
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `playwright-test-${timestamp}.spec.ts`;
  }
}
