import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildConfig,
  DEFAULT_RENDER_CONFIG,
  lineageProjection,
  sanitizeRenderConfig,
  validateRenderConfig,
} from "../_shared/cme-render-config.ts";

Deno.test("buildConfig: empty payload yields full defaults", () => {
  const c = buildConfig(undefined);
  assertEquals(c.render_mode, "cinematic");
  assertEquals(c.quality, "high");
  assertEquals(c.fallback_strategy, "slides");
  assertEquals(c.worker_preferences.gpu_tier, "high_vram");
  assertEquals(c._config_version, 1);
  assert(typeof c._persisted_at === "string");
});

Deno.test("buildConfig: partial payload merges with defaults", () => {
  const c = buildConfig({ quality: "ultra", worker_preferences: { gpu_tier: "multi_gpu" } });
  assertEquals(c.quality, "ultra");
  assertEquals(c.worker_preferences.gpu_tier, "multi_gpu");
  assertEquals(c.render_mode, DEFAULT_RENDER_CONFIG.render_mode);
});

Deno.test("sanitizeRenderConfig: invalid values fall back to defaults", () => {
  const c = sanitizeRenderConfig({
    render_mode: "hologram",
    quality: "infinite",
    fps: 9999,
    resolution: "8k",
    fallback_strategy: "telepathy",
    worker_preferences: { gpu_tier: "quantum" },
  });
  assertEquals(c.render_mode, "cinematic");
  assertEquals(c.quality, "high");
  assertEquals(c.fps, 30);
  assertEquals(c.resolution, "1080p");
  assertEquals(c.fallback_strategy, "slides");
  assertEquals(c.worker_preferences.gpu_tier, "high_vram");
});

Deno.test("sanitizeRenderConfig: null/array/string never crashes", () => {
  for (const bad of [null, [], "x", 42, true]) {
    const c = sanitizeRenderConfig(bad);
    assertEquals(c.render_mode, "cinematic");
    assertEquals(c._config_version, 1);
  }
});

Deno.test("validateRenderConfig: valid config returns valid=true", () => {
  const v = validateRenderConfig(buildConfig({}));
  assertEquals(v.valid, true);
  assertEquals(v.errors.length, 0);
});

Deno.test("validateRenderConfig: missing fields produce errors", () => {
  const v = validateRenderConfig({ render_mode: "cinematic" });
  assertEquals(v.valid, false);
  assert(v.errors.length > 0);
});

Deno.test("lineageProjection: exposes audited fields", () => {
  const c = buildConfig({ quality: "ultra", fallback_strategy: "audio" });
  const p = lineageProjection(c);
  assertEquals(p.config_version, 1);
  assertEquals(p.quality, "ultra");
  assertEquals(p.fallback_strategy, "audio");
  assertEquals(p.gpu_tier, "high_vram");
  assertEquals(p.auto_publish, true);
});

Deno.test("retry semantics: original config is preserved (deep-equal after re-sanitize)", () => {
  const original = buildConfig({ quality: "ultra", fallback_strategy: "audio" });
  // simulate retry: pass the persisted config back through sanitize — must be stable
  const reused = sanitizeRenderConfig(original);
  assertEquals(reused.quality, original.quality);
  assertEquals(reused.fallback_strategy, original.fallback_strategy);
  assertEquals(reused.worker_preferences.gpu_tier, original.worker_preferences.gpu_tier);
});

Deno.test("fallback strategy is always present and non-null", () => {
  const c = buildConfig({ fallback_strategy: undefined });
  assert(c.fallback_strategy !== null && c.fallback_strategy !== undefined);
  assertEquals(c.fallback_strategy, "slides");
});

Deno.test("worker_preferences and segment_settings always objects (never null)", () => {
  const c = buildConfig({ worker_preferences: null, segment_settings: null });
  assertEquals(typeof c.worker_preferences, "object");
  assertEquals(typeof c.segment_settings, "object");
  assertEquals(c.segment_settings.segment_duration, 30);
});
