import config from "./config.js";
import { makeLLMRequest } from "./utils.js";

// OpenRouter API configuration
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
let openRouterSettings = {
  apiKey: null,
  model: null,
  free: false,
};

document.addEventListener("DOMContentLoaded", () => {
  // Initialize OpenRouter settings modal
  const settingsBtn = document.getElementById("settingsBtn");
  const openRouterModal = document.getElementById("openRouterModal");
  const openRouterCloseBtn = openRouterModal.querySelector(".modal-close");
  const openRouterCancelBtn = openRouterModal.querySelector(".cancel-btn");
  const openRouterSaveBtn = openRouterModal.querySelector(".save-btn");
  const openRouterApiKeyInput = document.getElementById("openRouterApiKey");
  const openRouterModelSelect = document.getElementById("openRouterModel");
  const openRouterStatus = document.getElementById("openRouterStatus");
  const openRouterFree = document.getElementById("openRouterFree");

  let models;

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "sync" && changes.openRouterSettings) {
      console.log(
        "OpenRouter settings changed:",
        changes.openRouterSettings.newValue
      );
      openRouterSettings = changes.openRouterSettings.newValue;
      // Perform actions based on the updated settings
      models = await validateAndFetchModels(openRouterSettings.apiKey);
      updateOpenRouterUI(models, openRouterSettings.free);
    }
  });

  // Load OpenRouter settings from storage
  chrome.storage.sync.get(["openRouterSettings"], async (result) => {
    if (result.openRouterSettings) {
      openRouterSettings = result.openRouterSettings;
      models = await validateAndFetchModels(openRouterSettings.apiKey);
      updateOpenRouterUI(models, openRouterSettings.free);
      openRouterFree.checked = openRouterSettings.free;
    }
  });

  // Show settings modal
  settingsBtn.addEventListener("click", async () => {
    openRouterModal.style.display = "block";
    // openRouterSettings = result.openRouterSettings;
    // const models = await validateAndFetchModels(openRouterSettings.apiKey);
    // updateOpenRouterUI(models, openRouterSettings.free);
  });

  openRouterFree.addEventListener("change", async () => {
    await chrome.storage.sync.set({
      openRouterSettings: {
        ...openRouterSettings,
        free: openRouterFree.checked,
      },
    });
    // updateOpenRouterUI(models, openRouterFree.checked);
  });

  // Close settings modal
  openRouterCloseBtn.addEventListener("click", closeOpenRouterModal);
  openRouterCancelBtn.addEventListener("click", closeOpenRouterModal);
  openRouterModal.addEventListener("click", (e) => {
    if (e.target === openRouterModal) {
      closeOpenRouterModal();
    }
  });

  // Save OpenRouter settings
  openRouterSaveBtn.addEventListener("click", async () => {
    const apiKey = openRouterApiKeyInput.value.trim();
    const model = openRouterModelSelect.value;

    if (!apiKey) {
      openRouterStatus.textContent = "Please enter an API key";
      openRouterStatus.style.color = "red";
      return;
    }

    try {
      openRouterStatus.textContent = "Validating API key...";
      openRouterStatus.style.color = "black";

      const models = await validateAndFetchModels(apiKey);
      openRouterSettings = {
        apiKey,
        model,
        free: openRouterSettings.checked,
      };

      // Save to Chrome storage
      await chrome.storage.sync.set({ openRouterSettings });

      updateOpenRouterUI(models, openRouterFree.checked);

      openRouterStatus.textContent = "Settings saved successfully";
      openRouterStatus.style.color = "green";
    } catch (error) {
      console.error("Error saving OpenRouter settings:", error);
      openRouterStatus.textContent = `Error: ${error.message}`;
      openRouterStatus.style.color = "red";
    }
  });

  // Update OpenRouter UI
  function updateOpenRouterUI(models, isFree) {
    openRouterApiKeyInput.value = openRouterSettings.apiKey || "";
    openRouterModelSelect.options.length = 0;

    if (!openRouterSettings.model) {
      // Populate model select
      openRouterModelSelect.innerHTML =
        '<option value="">Select a model</option>';
    }

    if (models?.length > 0) {
      openRouterModelSelect.disabled = false;
      models
        ?.filter((x) => {
          return isFree
            ? x.name?.match(/free/i)?.index > -1 ||
                x.id.match(/free/i)?.index > -1
            : true;
        })
        .forEach((model) => {
          const option = document.createElement("option");
          option.value = model.id;
          option.text = `${model.name} (${model.id})`;
          option.selected = model.id === openRouterSettings.model;
          openRouterModelSelect.appendChild(option);
        });
    }

    // Update status
    if (openRouterSettings.apiKey && openRouterSettings.model) {
      openRouterStatus.textContent = "OpenRouter configured";
      openRouterStatus.style.color = "green";
    } else {
      openRouterStatus.textContent = "OpenRouter not configured";
      openRouterStatus.style.color = "red";
    }
  }

  // Close OpenRouter modal
  function closeOpenRouterModal() {
    openRouterModal.style.display = "none";
  }

  // Validate API key and fetch available models
  async function validateAndFetchModels(apiKey) {
    try {
      // Test API key
      const testResponse = await fetch(`${OPENROUTER_API_URL}/auth/key`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!testResponse.ok) {
        throw new Error("Invalid API key");
      }

      // Fetch available models
      const modelsResponse = await fetch(`${OPENROUTER_API_URL}/models`);
      if (!modelsResponse.ok) {
        throw new Error("Failed to fetch models");
      }

      const modelsData = await modelsResponse.json();
      return modelsData.data || [];
    } catch (error) {
      console.error("OpenRouter validation error:", error);
      throw error;
    }
  }
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
  const addSnapshotBtn = document.getElementById("addSnapshotBtn");
  const snapshotsList = document.getElementById("snapshotsList");

  if (
    !testCaseInput ||
    !generateBtn ||
    !saveBtn ||
    !loadingDiv ||
    !errorDiv ||
    !outputDiv ||
    !testSuitesList ||
    !newSuiteBtn ||
    !testGenerator ||
    !addSnapshotBtn ||
    !snapshotsList
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
      addSnapshotBtn: !!addSnapshotBtn,
      snapshotsList: !!snapshotsList,
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
  let currentSnapshots = [];

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

    // Load snapshots
    currentSnapshots = test.snapshots || [];
    renderSnapshots();

    // Enable the save button for updates
    saveBtn.disabled = false;

    // Update selected state
    document.querySelectorAll(".saved-test-item").forEach((item) => {
      item.classList.remove("selected");
    });

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

    // Reset snapshots
    currentSnapshots = [];
    renderSnapshots();

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

      const systemPrompt = `You are a Playwright test automation expert. Create a test suite file that follows this exact template:

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
4. Use proper Playwright selectors and assertions, favor getByRole, getBy
5. Follow best practices for test organization
6. MUST include every test case provided in the input
7. Each test case should be a separate test block
8. Maintain the original test logic while organizing it properly
9. Format the code with proper spacing and indentation
10. DO NOT include any imports in the response - they will be added automatically
11. Use relative URLs for navigation - do not include protocol, host, or port
12. Each test should navigate to its specific relative URL before running

Return ONLY the test suite content, nothing else.`;

      const userPrompt = `Create a test suite file for the following tests:

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

IMPORTANT: Include ALL test cases in the output, converting each one into a proper test block.`;

      const response = await makeLLMRequest({
        systemPrompt,
        userPrompt,
        openRouterSettings,
        config,
      });

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
        elementsResponse.elements,
        currentSnapshots
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
          snapshots: currentSnapshots,
        };
        currentSuite.tests.unshift(newTest);
      } else {
        // Update existing test
        currentTest.instructions = testCaseInput.value;
        currentTest.body = outputDiv.textContent;
        currentTest.snapshots = currentSnapshots;
      }

      saveTestSuitesToStorage();
      renderTestSuites();

      // Clear the input and output after saving
      testCaseInput.value = "";
      outputDiv.textContent = "";
      currentTest = null;
      currentSnapshots = [];
      renderSnapshots();
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

  // Add snapshot functionality
  addSnapshotBtn.addEventListener("click", async () => {
    try {
      // Get the current tab's details
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs || !tabs[0]) {
        throw new Error("Could not find active tab");
      }
      const tabId = tabs[0].id;

      // Get visible elements through background script
      const elementsResponse = await new Promise((resolve, reject) => {
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
      });

      if (!elementsResponse) {
        throw new Error("Failed to get visible elements");
      }

      // Create a new snapshot
      const snapshot = {
        id: Date.now().toString(),
        label: `Snapshot ${currentSnapshots.length + 1}`,
        elements: elementsResponse.elements,
        timestamp: new Date().toISOString(),
      };

      // Add to current snapshots
      currentSnapshots.push(snapshot);

      // Update the UI
      renderSnapshots();

      // If we have a current test, update it with the new snapshots
      if (currentTest) {
        currentTest.snapshots = currentSnapshots;
        saveTestSuitesToStorage();
      }
    } catch (error) {
      console.error("Error adding snapshot:", error);
      showError(`Failed to add snapshot: ${error.message}`);
    }
  });

  // Render snapshots
  function renderSnapshots() {
    snapshotsList.innerHTML = "";
    currentSnapshots.forEach((snapshot) => {
      const snapshotElement = document.createElement("div");
      snapshotElement.className = "snapshot-item";
      snapshotElement.innerHTML = `
        <span class="snapshot-label">${snapshot.label}</span>
        <span class="remove-snapshot" data-id="${snapshot.id}">×</span>
      `;

      // Add remove handler
      const removeBtn = snapshotElement.querySelector(".remove-snapshot");
      removeBtn.addEventListener("click", () => {
        currentSnapshots = currentSnapshots.filter((s) => s.id !== snapshot.id);
        renderSnapshots();

        // Update current test if it exists
        if (currentTest) {
          currentTest.snapshots = currentSnapshots;
          saveTestSuitesToStorage();
        }
      });

      snapshotsList.appendChild(snapshotElement);
    });
  }
});

async function generateFilename(testCase) {
  try {
    const response = await makeLLMRequest({
      systemPrompt:
        "You are a helpful assistant that generates appropriate filenames for Playwright test scripts. Return ONLY the filename with .ts extension, nothing else. The filename should be kebab-case and descriptive of the test case.",
      userPrompt: `Generate a filename for this test case: ${testCase}`,
      openRouterSettings,
      config,
    });

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

async function generateScriptWithAI(
  testCase,
  pageDetails,
  elements,
  snapshots = []
) {
  console.log("Generating script with AI...");

  const userPrompt = `Generate a Playwright test script in TypeScript for the following test case. Return ONLY the script content, without any explanations, comments, or backticks:

Test Case: ${testCase}

Page Details:
URL: ${pageDetails.url}
Title: ${pageDetails.title}

Current Visible Elements:
${JSON.stringify(elements, null, 2)}

${
  snapshots.length > 0
    ? `Additional Markup Snapshots:
${snapshots
  .map(
    (snapshot, index) => `
Snapshot ${index + 1} (${snapshot.label}):
${JSON.stringify(snapshot.elements, null, 2)}
`
  )
  .join("\n")}`
    : ""
}

Generate a complete Playwright test script in TypeScript that:
1. Uses ONLY selectors that are physically present in the provided HTML elements:
   - ONLY use selectors that match elements in the provided Visible Elements list
   - ONLY use selectors that match elements in any of the provided Markup Snapshots
   - DO NOT make up or hallucinate selectors that don't exist
   - If an element doesn't have a unique identifier, use the most specific selector available from the provided HTML
2. Uses ONLY modern Playwright selector syntax.  Ensure selectors work across multiple environments, considering CMS 
text changes, dynamic class names, and UI variations.  When generating Playwright test selectors, prioritize:
	a.	Use data-testid or data-test attributes if available.
	b.	Use getByRole() for accessibility-based selection.
	c.	Use parent-child relationships for stable structure-based selection.
	d.	Use IDs only if they are stable.
	e.	Use text-based locators sparingly and make them case-insensitive if necessary.
	f.	Avoid using CSS class selectors unless they are explicitly stable and version-controlled.
	g.	Avoid nth-child selectors as they may change with content updates.

3. Uses proper selectors and assertions
4. Includes error handling
5. Follows best practices
6. Is well-documented
7. Uses async/await properly
8. Includes proper TypeScript types
9. Uses Playwright's built-in types where needed

Example of correct function declaration:
test('should do something', async ({ page }) => {
  // test code here
});

// -------------------------
// Example 2a: Selecting Elements by Stable Attributes
// -------------------------
const submitButton = page.locator('[data-testid="submit-button"]');
const searchInput = page.locator('[data-testid="search-input"]');
const form = page.locator('form[data-testid="search-form"]');
const carouselItem = page.locator('form[data-analytics-id="search-form"]');

// -------------------------
// Example 2b: Using ARIA Roles for Accessibility
// -------------------------
const submitButton = page.getByRole('button', { name: /submit/i }); // Case insensitive
const searchField = page.getByRole('textbox', { name: 'Search' });

// -------------------------
// Example 2c: Using Parent-Child Relationships
// -------------------------
const usernameInput = page.locator('label:has-text("Username") + input');
const modalButton = page.locator('div.modal-content button', { hasText: 'Confirm' });

// -------------------------
// Example 2d: Using Text-Based Locators (Only If Necessary)
// -------------------------
const button = page.locator('button', { hasText: /submit/i }); // Case insensitive match
const link = page.locator('a').filter({ hasText: /learn more/i });

// -------------------------
// Example 2e: Using Nested Elements for Contextual Selection
// -------------------------
const usernameInput = page.locator('input[type="text"]', { 
    has: page.locator('label', { hasText: 'Username' }) 
});

// -------------------------
// Example 2f: Handling Multiple Matches
// -------------------------
const firstButton = page.locator('button').first();
const lastButton = page.locator('button').last();
const secondButton = page.locator('button').nth(1); // 0-based index

Return ONLY the script content, nothing else.`;

  const systemPrompt = `You are a Playwright test automation expert specializing in TypeScript. Generate clear, well-structured test scripts that:
1. Use ONLY selectors that are physically present in the provided HTML elements:
   - ONLY use selectors that match elements in the provided Visible Elements list
   - ONLY use selectors that match elements in any of the provided Markup Snapshots
   - DO NOT make up or hallucinate selectors that don't exist
   - If an element doesn't have a unique identifier, use the most specific selector available from the provided HTML
2. Use ONLY modern Playwright selector syntax:
   - VALID: page.locator('button', { hasText: 'Click me' })
   - VALID: page.locator('input[type="text"]', { has: page.locator('label', { hasText: 'Username' }) })
   - VALID: page.locator('button').filter({ hasText: 'Submit' })
   - VALID: page.locator('a').first()
   - VALID: page.locator('div').nth(1)
   - INVALID: page.locator('button:text("Click me")')
   - INVALID: page.locator('button:has-text("Click me")')
   - INVALID: page.locator('button >> text=Click me')
   - INVALID: page.locator('button:has(span)')
3. Follow best practices for element selection
4. Include proper TypeScript types
5. Return ONLY the script content, without any explanations, comments, or backticks
6. NEVER include { page } in test function declarations:
   - INCORRECT: test('should do something', async ({ page }) => { ... })
   - CORRECT: test('should do something', async () => { ... })

Example of correct function declaration:
test('should do something', async () => {
  // test code here
});

Example of valid selector syntax:
// Using HTML attributes
const submitButton = page.locator('button[type="submit"]');
const searchInput = page.locator('input[name="search"]');
const form = page.locator('form[data-testid="search-form"]');

// Using text content
const button = page.locator('button', { hasText: 'Submit' });
const link = page.locator('a').filter({ hasText: 'Learn more' });

// Using nested elements
const input = page.locator('input[type="text"]', { has: page.locator('label', { hasText: 'Username' }) });

// Using multiple matches
const firstButton = page.locator('button').first();
const lastButton = page.locator('button').last();
const secondButton = page.locator('button').nth(1);`;

  try {
    console.log("Making API request to configured LLM");

    const response = await makeLLMRequest({
      systemPrompt,
      userPrompt,
      openRouterSettings,
      config,
    });

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
      throw new Error(
        data?.error?.message ?? "Invalid response format from AI"
      );
    }

    // Clean up the response by removing any backticks and extra whitespace
    let content = data.choices[0].message.content;
    content = content.replace(/```typescript\n?|\n?```/g, "").trim();

    // Validate and fix any invalid selectors
    content = content.replace(
      /page\.locator\(['"]([^'"]*):text\(['"]([^'"]*)['"]\)['"]\)/g,
      "page.locator('$1', { hasText: '$2' })"
    );
    content = content.replace(
      /page\.locator\(['"]([^'"]*):has-text\(['"]([^'"]*)['"]\)['"]\)/g,
      "page.locator('$1', { hasText: '$2' })"
    );
    content = content.replace(
      /page\.locator\(['"]([^'"]*) >> text=([^'"]*)['"]\)/g,
      "page.locator('$1', { hasText: $2 })"
    );
    content = content.replace(
      /page\.locator\(['"]([^'"]*):has\(([^)]*)\)['"]\)/g,
      "page.locator('$1', { has: page.locator($2) })"
    );

    return content;
  } catch (error) {
    console.error("Error in generateScriptWithAI:", error);

    // Handle extension context invalidation
    if (error.message.includes("Extension context invalidated")) {
      try {
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
      throw new Error(
        "The extension needs to be reloaded. Please close and reopen the DevTools panel."
      );
    }

    throw error;
  }
}
