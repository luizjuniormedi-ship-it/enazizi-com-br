/**
 * audioRuntime — singleton de áudio para o módulo plantão clínico (Wave 1).
 *
 * Substitui múltiplas instâncias de `new AudioContext()` espalhadas em
 * `ClinicalSimulation.tsx` (browsers limitam ~6 contextos concorrentes;
 * exceder esse limite quebrava o áudio silenciosamente após algumas sessões).
 *
 * API pública estável — pode ser plugada incrementalmente.
 * fire-and-forget, fail-safe (try/catch em tudo, nunca lança).
 */

type SoundKind =
  | "response"      // beep curto agudo — resposta do paciente
  | "worsened"      // tom grave sustentado — paciente piorou
  | "improved"      // tom agudo curto — paciente melhorou
  | "positive"      // beep curto positivo — ação correta
  | "negative"      // tom quadrado — ação incorreta
  | "alert"         // beep médio — alerta de deterioração
  | "timeout";      // tom alto sustentado — tempo esgotado

let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!_ctx || _ctx.state === "closed") {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      _ctx = new Ctor();
    }
    if (_ctx.state === "suspended") _ctx.resume().catch(() => {});
    return _ctx;
  } catch {
    return null;
  }
}

const PROFILES: Record<SoundKind, { freq: number; type?: OscillatorType; duration: number; gain?: number }> = {
  response:  { freq: 520, duration: 0.08 },
  worsened:  { freq: 220, type: "sawtooth", duration: 0.30 },
  improved:  { freq: 720, duration: 0.10 },
  positive:  { freq: 660, duration: 0.12 },
  negative:  { freq: 330, type: "square", duration: 0.15 },
  alert:     { freq: 480, duration: 0.18 },
  timeout:   { freq: 880, duration: 0.50, gain: 0.3 },
};

export function play(kind: SoundKind): void {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    const p = PROFILES[kind];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (p.type) osc.type = p.type;
    osc.frequency.value = p.freq;
    gain.gain.value = p.gain ?? 0.15;
    osc.start();
    osc.stop(ctx.currentTime + p.duration);
  } catch {
    /* never throw */
  }
}

/** Fecha o contexto compartilhado. Use em cleanup global / logout. */
export function dispose(): void {
  try {
    _ctx?.close();
  } catch {
    /* noop */
  } finally {
    _ctx = null;
  }
}

export const audioRuntime = { play, dispose };
export type { SoundKind };
