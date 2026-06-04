const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite"] as const;

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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: options?.maxOutputTokens ?? 512,
            ...(options?.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
      },
    );

    if (response.status === 429) {
      return {
        text: null,
        model: null,
        error: "Quota Gemini dépassé — réessayez dans quelques minutes",
      };
    }

    if (response.status === 403) {
      return {
        text: null,
        model: null,
        error: "Clé Gemini invalide ou révoquée — mettez à jour GEMINI_API_KEY",
      };
    }

    if (!response.ok) {
      lastError = `Gemini ${model}: HTTP ${response.status}`;
      continue;
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
    if (text) return { text, model };
  }

  return { text: null, model: null, error: lastError };
}

export function parseJsonFromAiText(raw: string): unknown {
  const cleaned = raw.replace(/```json?|```/g, "").trim();
  return JSON.parse(cleaned);
}
