// Manual Thinking en línia: funció de servidor "ia"
// Fa dues coses amb l'API d'Anthropic:
//   - mode "transcripcio": llegeix les etiquetes d'una foto d'un mapa
//   - mode "sintesi": redacta la síntesi de la memòria
// La clau d'API es guarda com a secret ANTHROPIC_API_KEY i no surt mai del servidor.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Model per defecte. Es pot canviar amb el secret ANTHROPIC_MODEL sense tocar el codi.
const MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5";

// Límits per evitar usos abusius de la clau
const MAX_PROMPT = 40_000;          // caràcters
const MAX_IMAGE_B64 = 7_000_000;    // uns 5 MB d'imatge
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Mètode no permès" }, 405);

  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "Falta el secret ANTHROPIC_API_KEY", code: "not_configured" }, 500);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Petició no vàlida", code: "invalid_argument" }, 400);
  }

  const mode = body?.mode;
  const prompt = String(body?.prompt ?? "");
  if (mode !== "transcripcio" && mode !== "sintesi") {
    return json({ error: "Mode desconegut", code: "invalid_argument" }, 400);
  }
  if (!prompt || prompt.length > MAX_PROMPT) {
    return json({ error: "Text buit o massa llarg", code: "invalid_argument" }, 400);
  }

  const content: unknown[] = [];
  if (mode === "transcripcio") {
    const img = body?.image;
    if (!img || !IMAGE_TYPES.includes(img.media_type) || typeof img.data !== "string" || img.data.length > MAX_IMAGE_B64) {
      return json({ error: "Imatge no vàlida o massa gran", code: "invalid_argument" }, 400);
    }
    content.push({ type: "image", source: { type: "base64", media_type: img.media_type, data: img.data } });
  }
  content.push({ type: "text", text: prompt });

  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: mode === "transcripcio" ? 4000 : 1500,
        messages: [{ role: "user", content }],
      }),
    });
  } catch {
    return json({ error: "No s'ha pogut contactar amb la IA", code: "upstream_error" }, 502);
  }

  const data: any = await r.json().catch(() => null);
  if (!r.ok) {
    const limited = r.status === 429 || r.status === 529;
    return json(
      { error: data?.error?.message ?? "Error de la IA", code: limited ? "rate_limited" : "upstream_error" },
      limited ? 429 : 502,
    );
  }

  const text = (data?.content ?? [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("");

  return json({ text, model: data?.model ?? MODEL });
});
