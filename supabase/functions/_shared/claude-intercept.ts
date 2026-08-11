// Auto-intercepts fetch() calls to Lovable Gateway / OpenAI chat completions
// and tries Claude (Anthropic) first when ANTHROPIC_API_KEY is configured.
// Falls back to original request on any Claude failure.
//
// Usage: just `import "../_shared/claude-intercept.ts";` at the top of any
// edge function that calls AI directly via fetch().

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_BASE_URL = Deno.env.get("ANTHROPIC_BASE_URL") || "https://api.anthropic.com";
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-3-5-sonnet-latest";

const GATEWAY_HOSTS = [
  "ai.gateway.lovable.dev",
  "api.openai.com",
];

function isChatCompletionsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return GATEWAY_HOSTS.includes(u.host) && u.pathname.endsWith("/chat/completions");
  } catch {
    return false;
  }
}

function hasImageContent(messages: any[]): boolean {
  if (!Array.isArray(messages)) return false;
  for (const m of messages) {
    if (Array.isArray(m?.content)) {
      for (const c of m.content) {
        if (c?.type === "image_url" || c?.type === "image") return true;
      }
    }
  }
  return false;
}

if (ANTHROPIC_API_KEY && !(globalThis as any).__claudeInterceptInstalled) {
  (globalThis as any).__claudeInterceptInstalled = true;
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = (async (input: any, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input?.url;
    if (!url || !isChatCompletionsUrl(url) || !init?.body || init.method !== "POST") {
      return originalFetch(input, init);
    }

    try {
      const bodyStr = typeof init.body === "string" ? init.body : new TextDecoder().decode(init.body as any);
      const body = JSON.parse(bodyStr);

      // Skip vision/multimodal — hudapi Claude proxy here is text-only.
      if (hasImageContent(body.messages)) return originalFetch(input, init);
      // Skip tool/function calling — schemas differ; let original run.
      if (body.tools || body.functions) return originalFetch(input, init);

      const claudeBody: any = {
        model: ANTHROPIC_MODEL,
        messages: body.messages,
        max_tokens: body.max_tokens || body.max_completion_tokens || 4096,
        temperature: body.temperature ?? 0.7,
      };
      if (body.response_format) claudeBody.response_format = body.response_format;

      const res = await originalFetch(`${ANTHROPIC_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ANTHROPIC_API_KEY}`,
          "x-api-key": ANTHROPIC_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(claudeBody),
      });

      if (res.ok) {
        console.log(`[claude-intercept] ✅ ${ANTHROPIC_MODEL} (redirected from ${new URL(url).host})`);
        return res;
      }
      console.warn(`[claude-intercept] Claude ${res.status}, falling back to original`);
    } catch (e) {
      console.warn(`[claude-intercept] error, falling back:`, (e as Error).message);
    }
    return originalFetch(input, init);
  }) as typeof fetch;
}
