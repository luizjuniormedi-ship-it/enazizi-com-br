import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  anthropicToOpenAIBody,
  flattenAnthropicContent,
  NVIDIA_ANTHROPIC_SHADOW_META,
  normalizeNativeAnthropic,
  openAIToAnthropicResponse,
} from "./nvidia-anthropic-provider.ts";

Deno.test("shadow feature está desabilitada por padrão", () => {
  assertEquals(NVIDIA_ANTHROPIC_SHADOW_META.enabled, false);
  assertEquals(NVIDIA_ANTHROPIC_SHADOW_META.stage, "shadow");
});

Deno.test("flatten aceita string e blocos de texto", () => {
  assertEquals(flattenAnthropicContent("oi"), "oi");
  assertEquals(
    flattenAnthropicContent([{ type: "text", text: "a" }, { type: "text", text: "b" }]),
    "a\nb",
  );
});

Deno.test("system top-level vira primeira mensagem system no body OpenAI", () => {
  const body = anthropicToOpenAIBody({
    model: "meta/llama-3.3-70b-instruct",
    system: "Você é o Tutor.",
    messages: [
      { role: "user", content: "P1" },
      { role: "assistant", content: [{ type: "text", text: "R1" }] },
      { role: "user", content: "P2" },
    ],
    max_tokens: 256,
    temperature: 0.4,
  }) as Record<string, unknown>;
  const messages = body.messages as Array<{ role: string; content: string }>;
  assertEquals(messages.length, 4);
  assertEquals(messages[0], { role: "system", content: "Você é o Tutor." });
  assertEquals(messages[2].content, "R1");
  assertEquals(body.max_tokens, 256);
  assertEquals(body.temperature, 0.4);
  assertEquals(body.stream, false);
});

Deno.test("temperature ausente não é enviada", () => {
  const body = anthropicToOpenAIBody({
    model: "m",
    messages: [{ role: "user", content: "x" }],
    max_tokens: 10,
  }) as Record<string, unknown>;
  assert(!("temperature" in body));
});

Deno.test("resposta OpenAI é normalizada para forma Anthropic", () => {
  const out = openAIToAnthropicResponse({
    id: "cmpl-1",
    model: "meta/llama-3.3-70b-instruct",
    choices: [{ message: { content: "texto" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 11, completion_tokens: 22 },
  }, "fallback");
  assertEquals(out.type, "message");
  assertEquals(out.role, "assistant");
  assertEquals(out.content, [{ type: "text", text: "texto" }]);
  assertEquals(out.stop_reason, "end_turn");
  assertEquals(out.usage, { input_tokens: 11, output_tokens: 22 });
});

Deno.test("finish_reason length vira max_tokens e reasoning é aproveitado", () => {
  const out = openAIToAnthropicResponse({
    choices: [{ message: { content: "", reasoning: "pensamento" }, finish_reason: "length" }],
  }, "m");
  assertEquals(out.stop_reason, "max_tokens");
  assertEquals(out.content[0].text, "pensamento");
});

Deno.test("resposta nativa Anthropic mantém blocos e usage", () => {
  const out = normalizeNativeAnthropic({
    id: "msg_1",
    model: "m",
    content: [{ type: "text", text: "a" }, { type: "tool_use", name: "x" }],
    stop_reason: "end_turn",
    usage: { input_tokens: 3, output_tokens: 4 },
  }, "fallback");
  assertEquals(out.content.length, 1);
  assertEquals(out.usage, { input_tokens: 3, output_tokens: 4 });
});
