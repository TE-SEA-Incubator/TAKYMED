// Models available on the free tier (tried in order, first success wins)
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.includes("Your_Key_Here")) return null;
  return key;
}

export async function geminiGenerateText(
  prompt: string,
  options?: { maxOutputTokens?: number; json?: boolean },
): Promise<{ text: string | null; model: string | null; error?: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { text: null, model: null, error: "Clé API Gemini non configurée sur le serveur" };
  }

  let lastError = "Erreur API Gemini";

  for (const model of GEMINI_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

      const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: options?.maxOutputTokens ?? 512,
          ...(options?.json ? { responseMimeType: "application/json" } : {}),
        },
      };

      console.log(`[Gemini] Sending request to ${model}...`);
      // console.log(`[Gemini] Body:`, JSON.stringify(requestBody));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(requestBody),
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Gemini] Error response from ${model} (${response.status}):`, errorText);
        lastError = `Gemini ${model}: HTTP ${response.status}`;
        continue;
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      if (text) return { text, model };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastError = `Gemini ${model}: Timeout (15s)`;
      } else {
        lastError = `Gemini ${model}: ${err.message}`;
      }
      console.error(`Gemini call error (${model}):`, err.message);
      continue;
    }
  }

  return { text: null, model: null, error: lastError };
}

export function parseJsonFromAiText(raw: string): unknown {
  const cleaned = raw.replace(/```json?|```/g, "").trim();
  return JSON.parse(cleaned);
}
