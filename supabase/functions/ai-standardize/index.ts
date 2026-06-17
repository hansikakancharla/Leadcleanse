const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  provider: string;
  api_key: string;
  unique_values: string[];
  column_name: string;
  instruction: string;
}

interface StandardizationPair {
  original_value: string;
  standardized_value: string;
}

interface StandardizationResponse {
  mappings: StandardizationPair[];
}

function buildPrompt(column_name: string, instruction: string, unique_values: string[]): string {
  return `You are a data standardization engine. Your task is to map raw, messy values from a dataset column to clean, standardized values.

Column Name: "${column_name}"
Standardization Rule: ${instruction}

Here are the unique raw values to standardize:
${unique_values.map((v, i) => `${i + 1}. "${v}"`).join("\n")}

Return a JSON object with this exact structure:
{
  "mappings": [
    { "original_value": "<exact original value>", "standardized_value": "<clean standardized value>" },
    ...
  ]
}

Rules:
- Every input value must appear exactly once in the mappings as "original_value"
- "original_value" must be EXACTLY the raw value (case-sensitive, character-for-character match)
- "standardized_value" should follow the standardization rule
- Do not skip any values
- Return only the JSON object, nothing else`;
}

async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number }): Promise<Response> {
  const { timeout = 25000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function callGroq(apiKey: string, prompt: string): Promise<StandardizationResponse> {
  const Groq = (await import("npm:groq-sdk@0.9.0")).default;
  const groq = new Groq({ apiKey });

  const completionPromise = groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are a data cleansing assistant. Output data strictly in valid JSON arrays." },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" },
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Groq API request timed out after 25 seconds")), 25000)
  );

  const completion = await Promise.race([completionPromise, timeoutPromise]);
  const text = completion.choices[0]?.message?.content || "";
  return parseJsonResponse(text);
}

async function callOpenAI(apiKey: string, prompt: string): Promise<StandardizationResponse> {
  const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a data cleansing assistant. Output data strictly in valid JSON arrays." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await response.json();
  const text = data.choices[0]?.message?.content || "";
  return parseJsonResponse(text);
}

async function callAnthropic(apiKey: string, prompt: string): Promise<StandardizationResponse> {
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 4096,
      messages: [
        { role: "user", content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await response.json();
  const text = data.content[0]?.text || "";
  return parseJsonResponse(text);
}

async function callGemini(apiKey: string, prompt: string): Promise<StandardizationResponse> {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return parseJsonResponse(text);
}

function parseJsonResponse(text: string): StandardizationResponse {
  let parsed: StandardizationResponse;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse response as JSON");
    parsed = JSON.parse(match[0]);
  }

  if (!parsed.mappings || !Array.isArray(parsed.mappings)) {
    throw new Error("Invalid response structure");
  }

  return parsed;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { provider, api_key, unique_values, column_name, instruction } = body;

    if (!api_key) {
      return new Response(
        JSON.stringify({ error: "API key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!unique_values || unique_values.length === 0) {
      return new Response(
        JSON.stringify({ mappings: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(column_name, instruction, unique_values);

    let result: StandardizationResponse;

    switch (provider) {
      case "groq":
        result = await callGroq(api_key, prompt);
        break;
      case "openai":
        result = await callOpenAI(api_key, prompt);
        break;
      case "anthropic":
        result = await callAnthropic(api_key, prompt);
        break;
      case "gemini":
        result = await callGemini(api_key, prompt);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown provider: ${provider}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
