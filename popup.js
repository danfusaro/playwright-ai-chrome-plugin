import config from "./config.js";

document.getElementById("generate").addEventListener("click", async () => {
  const testCases = document.getElementById("testCases").value;
  console.log("Starting script generation with test cases:", testCases);

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    console.log("Current tab:", tab);

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
      console.log("Content script injected successfully");
    } catch (error) {
      console.log("Content script may already be injected:", error);
    }

    // Get page details and visible elements
    console.log("Requesting page details...");
    const pageDetails = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        { action: "getPageDetails" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error getting page details:",
              chrome.runtime.lastError
            );
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        }
      );
    });
    console.log("Page details received:", pageDetails);

    console.log("Requesting visible elements...");
    const elementsResponse = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id,
        { action: "getVisibleElements" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error getting visible elements:",
              chrome.runtime.lastError
            );
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        }
      );
    });
    console.log("Visible elements response:", elementsResponse);

    if (!elementsResponse) {
      throw new Error("No response received from content script");
    }

    if (!elementsResponse.elements) {
      throw new Error("Response missing elements array");
    }

    const visibleElements = elementsResponse.elements;
    console.log("Number of visible elements:", visibleElements.length);

    // Generate a more detailed Playwright script with AI
    console.log("Generating script with AI...");
    const playwrightScript = await generateScriptWithAI(
      testCases,
      pageDetails,
      visibleElements
    );
    console.log("Script generated successfully");
    document.getElementById("output").textContent = playwrightScript;
  } catch (error) {
    console.error("Error in script generation:", error);
    document.getElementById("error").textContent = `Error: ${error.message}`;
  } finally {
    // Hide loading state
    document.getElementById("loading").style.display = "none";
    document.getElementById("generate").disabled = false;
  }
});

async function generateScriptWithAI(testCases, pageDetails, visibleElements) {
  if (!visibleElements || !Array.isArray(visibleElements)) {
    console.error("Invalid visible elements:", visibleElements);
    throw new Error("Failed to get visible elements from page");
  }

  const { url, title } = pageDetails;
  const timestamp = new Date().toISOString();

  // Filter and clean up visible elements
  const cleanElements = visibleElements
    .filter((el) => el && el.text && el.text.length < 100) // Remove long text elements
    .map((el) => ({
      ...el,
      text: el.text.trim(),
      classes: el.classes || [],
    }));

  // Create a map of text content to selectors for easier reference
  const elementMap = cleanElements.reduce((acc, el) => {
    if (el.text && !el.text.includes("@font-face")) {
      // Skip font-face elements
      acc[el.text] = generateSelector(el);
    }
    return acc;
  }, {});

  // Prepare context for AI
  const context = {
    url,
    title,
    elements: cleanElements.map((el) => ({
      text: el.text,
      tag: el.tag,
      id: el.id,
      classes: el.classes,
      selector: generateSelector(el),
    })),
    testCases: testCases.split("\n").filter((tc) => tc.trim()),
  };

  console.log("Prepared context for AI:", {
    url: context.url,
    title: context.title,
    elementCount: context.elements.length,
    testCaseCount: context.testCases.length,
  });

  try {
    // Call Azure OpenAI API to interpret test cases
    const aiResponse = await interpretTestCases(context);
    console.log("AI response received:", aiResponse);

    if (!Array.isArray(aiResponse)) {
      throw new Error("Invalid AI response format");
    }

    // Generate test steps using AI interpretation
    const testSteps = aiResponse
      .map((cmd) => {
        if (!cmd || !cmd.action) {
          return `// Invalid command: ${JSON.stringify(cmd)}`;
        }

        // Handle special cases
        if (cmd.action === "waitForNavigation") {
          return `await page.waitForURL('**/search-results**');`;
        }

        if (cmd.action === "press") {
          return `await page.keyboard.press('Enter');`;
        }

        const element = cleanElements.find(
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
  // Test generated on: ${timestamp}
  await page.goto('${url}');
  
  // Test steps:
  ${testSteps}
});`;
  } catch (error) {
    console.error("AI processing failed:", error);
    return `// Error generating script: ${
      error.message
    }\n\n// Fallback to basic script:\n${generateBasicScript(
      testCases,
      pageDetails
    )}`;
  }
}

async function interpretTestCases(context) {
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
- value: any value to input (if applicable)

Example response:
[
  {
    "originalTestCase": "Enter username in email field",
    "action": "fill",
    "elementText": "email",
    "value": "username"
  },
  {
    "originalTestCase": "Press enter",
    "action": "press",
    "elementText": "",
    "value": "Enter"
  },
  {
    "originalTestCase": "Wait for search results",
    "action": "waitForNavigation",
    "elementText": "",
    "value": ""
  }
]

IMPORTANT: Respond with ONLY the JSON array, no markdown formatting or code blocks.`;

  const response = await fetch(
    `https://${config.azure.endpoint}.openai.azure.com/openai/deployments/${config.azure.deployment}/chat/completions?api-version=2023-05-15`,
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
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Azure OpenAI API error: ${
        errorData.error?.message || response.statusText
      }`
    );
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  // Clean up the response by removing any markdown code blocks
  const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();

  try {
    return JSON.parse(cleanContent);
  } catch (error) {
    console.error("Failed to parse AI response:", cleanContent);
    throw new Error("Failed to parse AI response as JSON");
  }
}

function generatePlaywrightCommand(action, selector, value) {
  switch (action.toLowerCase()) {
    case "click":
      return `await page.locator('${selector}').click();`;
    case "fill":
      return `await page.locator('${selector}').fill('${value}');`;
    case "type":
      return `await page.locator('${selector}').type('${value}');`;
    case "select":
      return `await page.locator('${selector}').selectOption('${value}');`;
    case "check":
      return `await page.locator('${selector}').check();`;
    case "uncheck":
      return `await page.locator('${selector}').uncheck();`;
    default:
      return `await page.locator('${selector}').${action}();`;
  }
}

function generateBasicScript(testCases, pageDetails) {
  const { url, title, timestamp } = pageDetails;
  return `import { test, expect } from '@playwright/test';

test('${title}', async ({ page }) => {
  await page.goto('${url}');
  // Generated test steps based on test cases:
  ${testCases
    .split("\n")
    .map((tc) => `// - ${tc}`)
    .join("\n")}
});`;
}

function generateSelector(element) {
  // Generate a unique selector for the element
  if (element.id) {
    return `#${element.id}`;
  }

  if (element.classes.length > 0) {
    return `.${element.classes.join(".")}`;
  }

  // Fallback to a more specific selector using tag and text
  if (element.text) {
    return `${element.tag}:has-text("${element.text.slice(0, 30)}")`;
  }

  return element.tag;
}
