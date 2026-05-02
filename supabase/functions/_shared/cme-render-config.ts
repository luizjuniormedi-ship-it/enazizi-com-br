/**
 * CME Render Config — Shared validator and builder.
 *
 * Single source of truth for `cme_render_jobs.config` shape used across
 * orchestrator, retry, recovery, fallback and lineage paths. Guarantees
 * that no NULL or partial config ever reaches workers, and that retries
 * always reuse the original persisted config.
 */

export const CONFIG_VERSION = 1;

export type RenderMode = 'cinematic' | 'slides' | 'audio_only';
export type Quality = 'low' | 'medium' | 'high' | 'ultra';
export type Resolution = '480p' | '720p' | '1080p' | '1440p' | '2160p';
export type NarrationMode = 'adaptive' | 'fixed' | 'off';
export type CognitivePacing = 'static' | 'dynamic' | 'fast' | 'slow';
export type FallbackStrategy = 'slides' | 'audio' | 'tutor_only' | 'none';
export type GpuTier = 'low_vram' | 'mid_vram' | 'high_vram' | 'multi_gpu';

export interface RenderConfig {
  render_mode: RenderMode;
  quality: Quality;
  fps: number;
  resolution: Resolution;
  narration_mode: NarrationMode;
  cognitive_pacing: CognitivePacing;
  fallback_strategy: FallbackStrategy;
  worker_preferences: { gpu_tier: GpuTier; [k: string]: unknown };
  segment_settings: { segment_duration: number; [k: string]: unknown };
  enaflix_publish: { auto_publish: boolean; [k: string]: unknown };
  _config_version: number;
  _persisted_at: string;
  [k: string]: unknown;
}

export const DEFAULT_RENDER_CONFIG: Omit<RenderConfig, '_persisted_at'> = {
  render_mode: 'cinematic',
  quality: 'high',
  fps: 30,
  resolution: '1080p',
  narration_mode: 'adaptive',
  cognitive_pacing: 'dynamic',
  fallback_strategy: 'slides',
  worker_preferences: { gpu_tier: 'high_vram' },
  segment_settings: { segment_duration: 30 },
  enaflix_publish: { auto_publish: true },
  _config_version: CONFIG_VERSION,
};

const ALLOWED = {
  render_mode: ['cinematic', 'slides', 'audio_only'] as const,
  quality: ['low', 'medium', 'high', 'ultra'] as const,
  resolution: ['480p', '720p', '1080p', '1440p', '2160p'] as const,
  narration_mode: ['adaptive', 'fixed', 'off'] as const,
  cognitive_pacing: ['static', 'dynamic', 'fast', 'slow'] as const,
  fallback_strategy: ['slides', 'audio', 'tutor_only', 'none'] as const,
  gpu_tier: ['low_vram', 'mid_vram', 'high_vram', 'multi_gpu'] as const,
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export function validateRenderConfig(config: unknown): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!isObject(config)) {
    return { valid: false, warnings, errors: ['config must be an object'] };
  }

  const c = config as Record<string, unknown>;

  if (!ALLOWED.render_mode.includes(c.render_mode as any)) errors.push('invalid render_mode');
  if (!ALLOWED.quality.includes(c.quality as any)) errors.push('invalid quality');
  if (!ALLOWED.resolution.includes(c.resolution as any)) errors.push('invalid resolution');
  if (!ALLOWED.narration_mode.includes(c.narration_mode as any)) errors.push('invalid narration_mode');
  if (!ALLOWED.cognitive_pacing.includes(c.cognitive_pacing as any)) errors.push('invalid cognitive_pacing');
  if (!ALLOWED.fallback_strategy.includes(c.fallback_strategy as any)) errors.push('invalid fallback_strategy');

  if (typeof c.fps !== 'number' || c.fps < 12 || c.fps > 120) errors.push('invalid fps');

  if (!isObject(c.worker_preferences)) errors.push('invalid worker_preferences');
  else if (!ALLOWED.gpu_tier.includes((c.worker_preferences as any).gpu_tier))
    warnings.push('unknown gpu_tier — defaulted');

  if (!isObject(c.segment_settings)) errors.push('invalid segment_settings');
  if (!isObject(c.enaflix_publish)) errors.push('invalid enaflix_publish');

  if (typeof c._config_version !== 'number') warnings.push('missing _config_version');

  return { valid: errors.length === 0, warnings, errors };
}

/** Returns a guaranteed-valid config, repairing any invalid/missing fields with defaults. */
export function sanitizeRenderConfig(raw: unknown): RenderConfig {
  const incoming: Record<string, any> = isObject(raw) ? (raw as Record<string, any>) : {};

  const pick = <T extends string>(allowed: readonly string[], value: unknown, fallback: T): T =>
    (allowed.includes(value as string) ? (value as T) : fallback);

  const fps = typeof incoming.fps === 'number' && incoming.fps >= 12 && incoming.fps <= 120
    ? (incoming.fps as number)
    : DEFAULT_RENDER_CONFIG.fps;

  const fps = typeof incoming.fps === 'number' && incoming.fps >= 12 && incoming.fps <= 120
    ? incoming.fps
    : DEFAULT_RENDER_CONFIG.fps;

  const wp = isObject(incoming.worker_preferences) ? incoming.worker_preferences : {};
  const ss = isObject(incoming.segment_settings) ? incoming.segment_settings : {};
  const ep = isObject(incoming.enaflix_publish) ? incoming.enaflix_publish : {};

  return {
    render_mode: pick('render_mode', incoming.render_mode, DEFAULT_RENDER_CONFIG.render_mode),
    quality: pick('quality', incoming.quality, DEFAULT_RENDER_CONFIG.quality),
    fps,
    resolution: pick('resolution', incoming.resolution, DEFAULT_RENDER_CONFIG.resolution),
    narration_mode: pick('narration_mode', incoming.narration_mode, DEFAULT_RENDER_CONFIG.narration_mode),
    cognitive_pacing: pick('cognitive_pacing', incoming.cognitive_pacing, DEFAULT_RENDER_CONFIG.cognitive_pacing),
    fallback_strategy: pick('fallback_strategy', incoming.fallback_strategy, DEFAULT_RENDER_CONFIG.fallback_strategy),
    worker_preferences: {
      ...DEFAULT_RENDER_CONFIG.worker_preferences,
      ...wp,
      gpu_tier: pick('gpu_tier', wp.gpu_tier, DEFAULT_RENDER_CONFIG.worker_preferences.gpu_tier),
    },
    segment_settings: {
      ...DEFAULT_RENDER_CONFIG.segment_settings,
      ...ss,
      segment_duration:
        typeof ss.segment_duration === 'number' && ss.segment_duration > 0 && ss.segment_duration <= 600
          ? ss.segment_duration
          : DEFAULT_RENDER_CONFIG.segment_settings.segment_duration,
    },
    enaflix_publish: {
      ...DEFAULT_RENDER_CONFIG.enaflix_publish,
      ...ep,
      auto_publish:
        typeof ep.auto_publish === 'boolean'
          ? ep.auto_publish
          : DEFAULT_RENDER_CONFIG.enaflix_publish.auto_publish,
    },
    _config_version: CONFIG_VERSION,
    _persisted_at: new Date().toISOString(),
  };
}

/**
 * Build the canonical config to persist on a render job INSERT.
 * Always returns a fully-populated, validated object — never null or partial.
 */
export function buildConfig(raw: unknown): RenderConfig {
  return sanitizeRenderConfig(raw);
}

/** Lineage projection: small, queryable subset to attach to lineage nodes. */
export function lineageProjection(config: RenderConfig) {
  return {
    config_version: config._config_version,
    render_mode: config.render_mode,
    quality: config.quality,
    fallback_strategy: config.fallback_strategy,
    gpu_tier: config.worker_preferences?.gpu_tier,
    segment_duration: config.segment_settings?.segment_duration,
    auto_publish: config.enaflix_publish?.auto_publish,
  };
}
