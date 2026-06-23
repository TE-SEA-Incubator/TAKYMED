// Models tried in order, first success wins.
// Keep only models currently exposed by the Gemini API for this project.
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
] as const;

function summarizeGeminiError(
  status: number,
  rawBody: string,
  model: string,
): { message: string; status: number } {
  const lowerBody = rawBody.toLowerCase();

  if (
    status === 429 ||
    lowerBody.includes("resource_exhausted") ||
    lowerBody.includes("prepayment credits are depleted")
  ) {
    return {
      status: 429,
      message:
        "Crédits Gemini épuisés sur le serveur. Rechargez le projet AI Studio ou activez la facturation.",
    };
  }

  if (status === 403) {
    return {
      status: 403,
      message: "Accès Gemini refusé pour la clé API configurée sur le serveur.",
    };
  }

  if (status === 404) {
    return {
      status: 502,
      message: `Modèle Gemini indisponible: ${model}`,
    };
  }

  if (status >= 500) {
    return {
      status: 502,
      message: `Erreur Gemini (${model}): service distant indisponible (${status})`,
    };
  }

  return {
    status: 502,
    message: `Erreur Gemini (${model}): HTTP ${status}`,
  };
}

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.includes("Your_Key_Here")) return null;
  return key;
}

export async function geminiGenerateText(
  prompt: string,
  options?: { maxOutputTokens?: number; json?: boolean },
): Promise<{
  text: string | null;
  model: string | null;
  error?: string;
  status?: number;
}> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      text: null,
      model: null,
      error: "Clé API Gemini non configurée sur le serveur",
      status: 503,
    };
  }

  let bestError: { message: string; status: number } = {
    message: "Erreur API Gemini",
    status: 502,
  };

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
        console.error(
          `[Gemini] Error response from ${model} (${response.status}):`,
          errorText,
        );
        const candidateError = summarizeGeminiError(
          response.status,
          errorText,
          model,
        );

        if (bestError.status === 502 || candidateError.status !== 502) {
          bestError = candidateError;
        }

        continue;
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      if (text) return { text, model };
    } catch (err: any) {
      const candidateError =
        err.name === "AbortError"
          ? {
              message: `Timeout Gemini (${model}) après 15 secondes`,
              status: 504,
            }
          : {
              message: `Erreur réseau Gemini (${model}): ${err.message}`,
              status: 502,
            };

      if (bestError.status === 502 || candidateError.status !== 502) {
        bestError = candidateError;
      }

      console.error(`Gemini call error (${model}):`, err.message);
      continue;
    }
  }

  return {
    text: null,
    model: null,
    error: bestError.message,
    status: bestError.status,
  };
}

export function parseJsonFromAiText(raw: string): unknown {
  const cleaned = raw.replace(/```json?|```/g, "").trim();
  return JSON.parse(cleaned);
}
