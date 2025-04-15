export async function makeLLMRequest({
  systemPrompt,
  userPrompt,
  openRouterSettings,
  config,
}) {
  let url = "";
  let headers;

  console.log("Making API request to configured LLM");

  if (openRouterSettings.apiKey && openRouterSettings.model) {
    // Use OpenRouter
    url = `https://openrouter.ai/api/v1/chat/completions`;
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openRouterSettings.apiKey}`,
      "X-Title": "Playwright AI Script Generator",
    };
  } else {
    // Use Azure OpenAI
    url = `https://${config.azure.endpoint}.openai.azure.com/openai/deployments/${config.azure.deployment}/chat/completions?api-version=${config.azure.apiVersion}`;
    headers = {
      "Content-Type": "application/json",
      "api-key": config.azure.apiKey,
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      model: openRouterSettings.model,
      temperature: 0.7,
      max_tokens: 5000,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.statusText}`);
  }

  return response;
}
