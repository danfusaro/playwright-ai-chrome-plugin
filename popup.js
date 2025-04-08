import config from "./config.js";

// OpenRouter API configuration
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
let openRouterSettings = {
  apiKey: null,
  model: null,
  models: [],
};

// Load settings from Chrome storage
chrome.storage.sync.get(["openRouterSettings"], (result) => {
  if (result.openRouterSettings) {
    openRouterSettings = result.openRouterSettings;
    updateSettingsUI();
  }
});

// Update settings UI based on current state
function updateSettingsUI(models) {
  const apiKeyInput = document.getElementById("apiKey");
  const modelSelect = document.getElementById("modelSelect");
  const saveButton = document.getElementById("saveSettings");
  const status = document.getElementById("settingsStatus");

  apiKeyInput.value = openRouterSettings.apiKey || "";

  // Populate model select
  modelSelect.innerHTML = '<option value="">Select a model</option>';
  if (models?.length > 0) {
    modelSelect.disabled = false;
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.id;
      option.text = `${model.name} (${model.id})`;
      option.selected = model.id === openRouterSettings.model;
      modelSelect.appendChild(option);
    });
  }

  // Update status
  if (openRouterSettings.apiKey && openRouterSettings.model) {
    status.textContent = "OpenRouter configured";
    status.style.color = "green";
  } else {
    status.textContent = "OpenRouter not configured";
    status.style.color = "red";
  }
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

// Save settings event handler
document.getElementById("saveSettings").addEventListener("click", async () => {
  const apiKey = document.getElementById("apiKey").value.trim();
  const model = document.getElementById("modelSelect").value;
  const status = document.getElementById("settingsStatus");

  if (!apiKey) {
    status.textContent = "Please enter an API key";
    status.style.color = "red";
    return;
  }

  try {
    status.textContent = "Validating API key...";
    status.style.color = "black";

    const models = await validateAndFetchModels(apiKey);

    openRouterSettings = {
      apiKey,
      model,
    };

    // Save to Chrome storage
    await chrome.storage.sync.set({ openRouterSettings });
    updateSettingsUI(models);

    status.textContent = "Settings saved successfully";
    status.style.color = "green";
  } catch (error) {
    console.error("Error saving settings:", error);
    status.textContent = `Error: ${error.message}`;
    status.style.color = "red";
  }
});

// Main script generation functionality
document.getElementById("generate").addEventListener("click", async () => {
  const testCases = document.getElementById("testCases").value;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Show loading state
    document.getElementById("loading").style.display = "block";
    document.getElementById("error").textContent = "";
    document.getElementById("generate").disabled = true;

    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
    } catch (error) {
      console.log("Content script may already be injected:", error);
    }

    // Get page details and visible elements
    const pageDetails = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        { action: "getPageDetails" },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        }
      );
    });

    const elementsResponse = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        { action: "getVisibleElements" },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        }
      );
    });

    if (!elementsResponse || !elementsResponse.elements) {
      throw new Error("Failed to get page elements");
    }

    const visibleElements = elementsResponse.elements;
    const playwrightScript = await generateScriptWithAI(
      testCases,
      pageDetails,
      visibleElements
    );

    document.getElementById("output").textContent = playwrightScript;
  } catch (error) {
    console.error("Error in script generation:", error);
    document.getElementById("error").textContent = `Error: ${error.message}`;
  } finally {
    document.getElementById("loading").style.display = "none";
    document.getElementById("generate").disabled = false;
  }
});

async function generateScriptWithAI(testCases, pageDetails, visibleElements) {
  const { url, title } = pageDetails;

  // Prepare context for AI
  const context = {
    url,
    title,
    elements: visibleElements
      .filter((el) => el && el.text && el.text.length < 100)
      .map((el) => ({
        text: el.text.trim(),
        tag: el.tag,
        id: el.id,
        classes: el.classes || [],
        selector: generateSelector(el),
      })),
    testCases: testCases.split("\n").filter((tc) => tc.trim()),
  };

  try {
    let aiResponse;
    if (openRouterSettings.apiKey && openRouterSettings.model) {
      // Use OpenRouter
      aiResponse = await callOpenRouterAI(context);
    } else {
      // Use Azure OpenAI
      aiResponse = await interpretTestCases(context);
    }

    if (!Array.isArray(aiResponse)) {
      throw new Error("Invalid AI response format");
    }

    const testSteps = aiResponse
      .map((cmd) => {
        if (!cmd || !cmd.action) {
          return `// Invalid command: ${JSON.stringify(cmd)}`;
        }

        const element = context.elements.find(
          (el) =>
            el &&
            el.text &&
            cmd.elementText.toLowerCase().includes(el.text.toLowerCase())
        );

        if (element) {
          const selector = generateSelector(element);
          return generatePlaywrightCommand(cmd.action, selector, cmd.value);
        }

        return `// ${cmd.originalTestCase || "Unknown command"}`;
      })
      .join("\n      ");

    return `import { test, expect } from '@playwright/test';

test('${title}', async ({ page }) => {
  await page.goto('${url}');
  
  // Test steps:
  ${testSteps}
});`;
  } catch (error) {
    console.error("AI processing failed:", error);
    return `// Error generating script: ${error.message}`;
  }
}

async function callOpenRouterAI(context) {
  const prompt = `You are a Playwright test automation expert. Given the following context:
URL: ${context.url}
Page Title: ${context.title}

Available Elements:
${context.elements.map((el) => `- ${el.text} (${el.selector})`).join("\n")}

Test Cases:
${context.testCases.map((tc, i) => `${i + 1}. ${tc}`).join("\n")}

For each test case, determine:
1. The action to perform (click, fill, type, select, press, waitForNavigation, etc.)
2. The target element (matching from available elements)
3. Any values to input (for fill/type/select actions)

Format your response as a JSON array of objects with these properties:
- originalTestCase: the original test case text
- action: the Playwright action to perform
- elementText: text to match the element
- value: any value to input (if applicable)`;

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openRouterSettings.apiKey}`,
      "HTTP-Referer": "https://your-extension-url.com",
      "X-Title": "Playwright AI Script Generator",
    },
    body: JSON.stringify({
      model: openRouterSettings.model,
      messages: [
        {
          role: "system",
          content:
            "You are a Playwright test automation expert. Generate precise commands based on test cases. Respond with ONLY the JSON array, no markdown formatting or code blocks.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `OpenRouter API error: ${errorData.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  try {
    return JSON.parse(content);
  } catch (error) {
    console.error("Failed to parse AI response:", content);
    throw new Error("Failed to parse AI response as JSON");
  }
}

// Existing functions (interpretTestCases, generatePlaywrightCommand, generateSelector) remain unchanged
