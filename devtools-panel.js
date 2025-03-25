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
  let configModal = null;
  let currentConfigSuite = null;

  // Initialize configuration modal
  function initializeConfigModal() {
    configModal = document.getElementById("configModal");
    const closeBtn = configModal.querySelector(".modal-close");
    const cancelBtn = configModal.querySelector(".cancel-btn");
    const saveBtn = configModal.querySelector(".save-btn");

    closeBtn.addEventListener("click", closeConfigModal);
    cancelBtn.addEventListener("click", closeConfigModal);
    saveBtn.addEventListener("click", saveConfig);

    // Close modal when clicking outside
    configModal.addEventListener("click", (e) => {
      if (e.target === configModal) {
        closeConfigModal();
      }
    });
  }

  // Show configuration modal
  function showConfigModal(suite) {
    currentConfigSuite = suite;
    const beforeAllHook = document.getElementById("beforeAllHook");
    const afterAllHook = document.getElementById("afterAllHook");
    const imports = document.getElementById("imports");

    // Load existing configuration
    beforeAllHook.value = suite.beforeAllHook || "";
    afterAllHook.value = suite.afterAllHook || "";
    imports.value = suite.imports || "";

    configModal.style.display = "block";
  }

  // Close configuration modal
  function closeConfigModal() {
    configModal.style.display = "none";
    currentConfigSuite = null;
  }

  // Save configuration
  async function saveConfig() {
    if (!currentConfigSuite) return;

    const beforeAllHook = document.getElementById("beforeAllHook").value;
    const afterAllHook = document.getElementById("afterAllHook").value;
    const imports = document.getElementById("imports").value;

    currentConfigSuite.beforeAllHook = beforeAllHook;
    currentConfigSuite.afterAllHook = afterAllHook;
    currentConfigSuite.imports = imports;

    await saveTestSuitesToStorage();
    closeConfigModal();
    renderTestSuites();
  }

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

      // Check if the error is due to extension context invalidation
      if (err.message.includes("Extension context invalidated")) {
        // Try to reload the panel
        try {
          // Attempt to reload the current panel
          const tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (tabs && tabs[0]) {
            await chrome.tabs.reload(tabs[0].id);
          }
        } catch (reloadErr) {
          console.error("Failed to reload panel:", reloadErr);
        }

        // Show a user-friendly error message
        showError(
          "The extension needs to be reloaded. Please close and reopen the DevTools panel."
        );

        // Clear the current state
        testSuites = [];
        currentSuite = null;
        currentTest = null;
        testCaseInput.value = "";
        outputDiv.textContent = "";
        saveBtn.disabled = true;

        // Hide the test generator
        updateTestGeneratorVisibility();

        // Re-render the empty state
        renderTestSuites();
      } else {
        // For other errors, show a generic error message
        showError("Failed to save test suites. Please try again.");
      }
    }
  }

  // Create a new test suite
  function createTestSuite() {
    const newSuite = {
      id: Date.now().toString(),
      name: "New Test Suite",
      tests: [],
      isCollapsed: false,
      beforeAllHook: "",
      afterAllHook: "",
      imports: "",
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
          <button class="configure-suite-btn" data-suite-id="${suite.id}">Configure</button>
          <button class="export-tests-btn" data-suite-id="${suite.id}">Export Test Suite</button>
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
      const configureBtn = suiteElement.querySelector(".configure-suite-btn");

      newTestBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent header click from firing
        currentSuite = suite;
        createNewTest();
      });

      exportTestsBtn.addEventListener("click", async (e) => {
        e.stopPropagation(); // Prevent header click from firing
        try {
          // Set busy state
          exportTestsBtn.disabled = true;
          const originalText = exportTestsBtn.textContent;
          exportTestsBtn.textContent = "Exporting...";

          await exportTests(suite);
        } catch (error) {
          console.error("Error exporting tests:", error);
          showError(`Failed to export tests: ${error.message}`);
        } finally {
          // Reset button state
          exportTestsBtn.disabled = false;
          exportTestsBtn.textContent = "Export Test Suite";
        }
      });

      deleteSuiteBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent header click from firing
        deleteTestSuite(suite.id);
      });

      // Add event listener for configure button
      configureBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent header click from firing
        showConfigModal(suite);
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
          <button class="export-test-btn" data-index="${index}">Export</button>
          <button class="delete-test-btn" data-index="${index}">Delete</button>
        </div>
      `;

      // Add event listeners to the buttons and filename link
      const copyCodeBtn = testElement.querySelector(".copy-code-btn");
      const exportTestBtn = testElement.querySelector(".export-test-btn");
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

      // Handle Export Test
      exportTestBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          // Create a Blob with the test content and TypeScript MIME type
          const blob = new Blob([test.body], {
            type: "application/typescript",
          });
          const url = URL.createObjectURL(blob);

          // Ensure the filename has .ts extension
          const filename = test.filename.endsWith(".ts")
            ? test.filename
            : test.filename.replace(/\.[^.]+$/, "") + ".ts";

          // Download the file
          await chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: true,
          });

          // Clean up the URL object
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error("Failed to export test:", err);
          showError("Failed to export test file");
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
      // Generate the test suite content
      const suiteContent = await generateTestSuite(suite);

      // Create a Blob with the test content and TypeScript MIME type
      const blob = new Blob([suiteContent], { type: "application/typescript" });
      const url = URL.createObjectURL(blob);

      // Generate filename for the suite
      const suiteFilename = `${suite.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")}.spec.ts`;

      // Download the file
      await chrome.downloads.download({
        url: url,
        filename: suiteFilename,
        saveAs: true,
      });

      // Clean up the URL object
      URL.revokeObjectURL(url);

      showOutput(`Exported test suite "${suite.name}" successfully`);
    } catch (error) {
      console.error("Error exporting tests:", error);
      showError(`Failed to export tests: ${error.message}`);
    }
  }

  // Generate test suite content
  async function generateTestSuite(suite) {
    try {
      // First, collect all unique imports from child test cases
      const childImports = new Set();
      suite.tests.forEach((test) => {
        const imports =
          test.body.match(/^import[\s\S]*?from[\s\S]*?;?\n/gm) || [];
        imports.forEach((imp) => childImports.add(imp.trim()));
      });

      // Get user-defined imports and split into lines
      const userImports = (suite.imports || "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("//"));

      // Combine all imports
      const allImports = [
        "import { expect, test } from '@playwright/test';",
        ...userImports,
        ...childImports,
      ].filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

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
                content: `You are a Playwright test automation expert. Create a test suite file that follows this exact template:

${allImports.join("\n")}

test.describe('Description of test suite', () => {
    // Common vars
    let context;
    let page;
    // Before/after declaration
    test.beforeAll(/** User defined function HERE */);
    test.afterAll(/** User defined function HERE */);
    // Test cases
    test(...);
});

Requirements:
1. Follow the template structure exactly
2. Include proper line breaks and indentation
3. Convert ALL provided test cases into proper test blocks
4. Use proper Playwright selectors and assertions
5. Follow best practices for test organization
6. MUST include every test case provided in the input
7. Each test case should be a separate test block
8. Maintain the original test logic while organizing it properly
9. Format the code with proper spacing and indentation
10. DO NOT include any imports in the response - they will be added automatically
11. Use relative URLs for navigation - do not include protocol, host, or port
12. Each test should navigate to its specific relative URL before running

Return ONLY the test suite content, nothing else.`,
              },
              {
                role: "user",
                content: `Create a test suite file for the following tests:

Suite Name: ${suite.name}

Before All Hook:
${suite.beforeAllHook || "// No beforeAll hook configured"}

After All Hook:
${suite.afterAllHook || "// No afterAll hook configured"}

Tests:
${suite.tests
  .map(
    (test, index) => `${index + 1}. ${test.instructions}
URL: ${test.url}`
  )
  .join("\n\n")}

Test Bodies:
${suite.tests
  .map((test, index) => `\nTest ${index + 1}:\n${test.body}`)
  .join("\n")}

IMPORTANT: Include ALL test cases in the output, converting each one into a proper test block.`,
              },
            ],
            temperature: 0.7,
            max_tokens: 2000,
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

      // Clean up the response
      let content = data.choices[0].message.content.trim();

      // Remove any backticks and their content, but preserve the actual code
      content = content.replace(/```typescript\n?|\n?```/g, "");

      // Remove any existing imports at the start of the file
      content = content.replace(/^import[\s\S]*?from[\s\S]*?;?\n/gm, "");

      // Remove any require statements at the start of the file
      content = content.replace(/^require[\s\S]*?;?\n/gm, "");

      // Remove any eslint comments at the start of the file
      content = content.replace(/^\/\*[\s\S]*?\*\/\n/gm, "");

      // Remove any empty lines at the start
      content = content.replace(/^\s+/, "");

      // Remove any language identifiers or unwanted text
      content = content.replace(/^(javascript|typescript|js|ts)\s*$/gm, "");

      // Remove any empty lines that might have been created
      content = content.replace(/^\s+|\s+$/gm, "");

      // Verify that we have test blocks in the content
      if (!content.includes("test(")) {
        console.error("Generated content:", content); // Log the content for debugging
        throw new Error("Generated content does not include any test blocks");
      }

      // Add the required imports and config at the top
      content = `/* eslint-disable testing-library/prefer-screen-queries */
${allImports.join("\n")}

${content}`;

      return content;
    } catch (error) {
      console.error("Error generating test suite:", error);
      throw error;
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
      const currentUrl = new URL(tabs[0].url);
      // Convert to relative URL by removing protocol, host, and port
      const relativeUrl =
        currentUrl.pathname + currentUrl.search + currentUrl.hash;

      if (!currentTest) {
        // Generate a contextual filename for the new test
        const filename = await generateFilename(testCaseInput.value);

        // Create new test
        const newTest = {
          instructions: testCaseInput.value,
          body: outputDiv.textContent,
          filename: filename,
          description: testCaseInput.value,
          url: relativeUrl,
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

  // Initialize the configuration modal when the panel loads
  initializeConfigModal();
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
1. Uses ONLY valid Playwright selector syntax:
   - Use page.locator('selector', { hasText: 'text' }) for text matching
   - Use page.locator('selector', { has: page.locator('nested-selector') }) for nested elements
   - Use page.locator('selector').first() or .last() for multiple matches
   - Use page.locator('selector').nth(index) for specific index
   - Use page.locator('selector').filter({ hasText: 'text' }) for filtering
   - NEVER use :text() or :has-text() pseudo-selectors
   - NEVER use deprecated selector syntax
2. Uses proper selectors and assertions
3. Includes error handling
4. Follows best practices
5. Is well-documented
6. Uses async/await properly
7. Includes proper TypeScript types
8. Uses Playwright's built-in types

Example of valid selector syntax:
const button = page.locator('button', { hasText: 'Click me' });
const input = page.locator('input[type="text"]', { has: page.locator('label', { hasText: 'Username' }) });
const link = page.locator('a').filter({ hasText: 'Learn more' });

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
              content: `You are a Playwright test automation expert specializing in TypeScript. Generate clear, well-structured test scripts that:
1. Use ONLY valid Playwright selector syntax
2. Follow best practices for element selection
3. Include proper TypeScript types
4. Return ONLY the script content, without any explanations, comments, or backticks

Example of valid selector syntax:
const button = page.locator('button', { hasText: 'Click me' });
const input = page.locator('input[type="text"]', { has: page.locator('label', { hasText: 'Username' }) });
const link = page.locator('a').filter({ hasText: 'Learn more' });`,
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
                "You are a helpful assistant that generates appropriate filenames for Playwright test scripts. Return ONLY the filename with .ts extension, nothing else. The filename should be kebab-case and descriptive of the test case.",
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
    // Remove any existing extension
    filename = filename.replace(/\.[^.]+$/, "");
    // Add .ts extension
    filename = filename + ".ts";
    // Clean up the filename to ensure it's valid
    filename = filename.replace(/[^a-z0-9-_.]/gi, "-").toLowerCase();
    return filename;
  } catch (error) {
    console.error("Error generating filename:", error);
    // Fallback to a simple filename if AI generation fails
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `playwright-test-${timestamp}.ts`;
  }
}
