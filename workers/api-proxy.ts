export interface Env {
  GOOGLE_MAPS_KEY: string;
  LLM_API_KEY: string;
}

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/milessilverman\.github\.io$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/localhost:\d+$/,
];

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((pat) => pat.test(origin));
}

function getCorsHeaders(origin: string | null) {
  const allowOrigin = isOriginAllowed(origin) && origin ? origin : "https://milessilverman.github.io";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");

    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin),
      });
    }

    // 2. Validate Origin Security Boundary
    if (origin && !isOriginAllowed(origin)) {
      return new Response("Forbidden Origin", {
        status: 403,
        headers: getCorsHeaders(origin),
      });
    }

    const url = new URL(request.url);

    // 3. Health & Readiness Probe
    if (url.pathname === "/api/health" || url.pathname === "/api/ai/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          timestamp: new Date().toISOString(),
          edge_runtime: "Cloudflare Workers",
          services: {
            streetview_proxy: Boolean(env.GOOGLE_MAPS_KEY),
            ai_advisor_proxy: Boolean(env.LLM_API_KEY),
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...getCorsHeaders(origin),
          },
        }
      );
    }

    // 4. Street View Static API Proxy
    if (url.pathname === "/api/streetview") {
      const lat = url.searchParams.get("lat");
      const lng = url.searchParams.get("lng");
      const heading = url.searchParams.get("heading") ?? "0";
      const upstream = `https://maps.googleapis.com/maps/api/streetview?size=640x400&location=${lat},${lng}&heading=${heading}&pitch=5&key=${env.GOOGLE_MAPS_KEY}`;
      const res = await fetch(upstream);
      return new Response(res.body, {
        headers: {
          "Content-Type": "image/jpeg",
          ...getCorsHeaders(origin),
          "Cache-Control": "public, max-age=604800",
        },
      });
    }

    // 5. AI Urban & Property Advisor Proxy
    if (url.pathname === "/api/ai" || url.pathname === "/api/advisor") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: getCorsHeaders(origin),
        });
      }

      if (!env.LLM_API_KEY) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "LLM_API_KEY is not configured in this Cloudflare Worker environment.",
            fallback_suggested: true,
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              ...getCorsHeaders(origin),
            },
          }
        );
      }

      try {
        const body: any = await request.json();
        const userPrompt = body.userPrompt || body.userMessage || "Analyze this property";
        const systemPrompt = body.systemPrompt || "You are the City Pretty Urban & Property Advisor.";
        const modelName = body.model || "gemini-1.5-flash";

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${env.LLM_API_KEY}`;

        // Format system instruction and multi-turn contents for Gemini
        const geminiPayload: any = {
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            ...(body.history || []).map((h: any) => ({
              role: h.role === "assistant" ? "model" : "user",
              parts: [{ text: h.text }],
            })),
            {
              role: "user",
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2000,
          },
        };

        const upstreamRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
        });

        if (!upstreamRes.ok) {
          const errText = await upstreamRes.text();
          return new Response(
            JSON.stringify({
              ok: false,
              error: `Upstream LLM error (${upstreamRes.status}): ${errText}`,
              fallback_suggested: true,
            }),
            {
              status: 502,
              headers: {
                "Content-Type": "application/json",
                ...getCorsHeaders(origin),
              },
            }
          );
        }

        const data: any = await upstreamRes.json();
        const candidate = data.candidates?.[0];
        const text =
          candidate?.content?.parts?.map((p: any) => p.text).join("") || "";

        return new Response(
          JSON.stringify({
            ok: true,
            text,
            model: modelName,
            finishReason: candidate?.finishReason || "STOP",
            usageMetadata: data.usageMetadata || null,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              ...getCorsHeaders(origin),
            },
          }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: `Edge worker proxy exception: ${err.message}`,
            fallback_suggested: true,
          }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...getCorsHeaders(origin),
            },
          }
        );
      }
    }

    return new Response("Not Found", {
      status: 404,
      headers: getCorsHeaders(origin),
    });
  },
};
