import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────
// Isolate protocolCompliance from Supabase and from the real block extractor.

const insertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn().mockReturnValue({ insert: insertMock });
const getUserMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    auth: { getUser: (...args: unknown[]) => getUserMock(...args) },
  },
}));

vi.mock("@/lib/tutor/extractInlineBlocks", () => ({
  extractInlineTutorBlocks: (md: string) => {
    // Simple mock: detect blocks by tag pattern `[[block:TYPE]]` in the string.
    const blocks: { type: string }[] = [];
    const re = /\[\[block:([a-z_]+)\]\]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(md)) !== null) blocks.push({ type: m[1] });
    return { blocks };
  },
}));

import {
  evaluateProtocolCompliance,
  buildComplementPrompt,
  logComplianceTelemetry,
} from "../protocolCompliance";

beforeEach(() => {
  insertMock.mockClear();
  fromMock.mockClear();
  getUserMock.mockReset();
});

describe("evaluateProtocolCompliance", () => {
  it("returns score 0 and all 15 stages missing for empty input", () => {
    const r = evaluateProtocolCompliance("");
    expect(r.score).toBe(0);
    expect(r.presentStageIds).toEqual([]);
    expect(r.missingStageIds).toHaveLength(15);
    expect(r.isComplete).toBe(false);
    expect(r.shouldRetry).toBe(true);
  });

  it("handles null/undefined-ish safely", () => {
    const r = evaluateProtocolCompliance(null as unknown as string);
    expect(r.score).toBe(0);
    expect(r.missingStageIds.length).toBe(15);
  });

  it("detects stage by text marker (case-insensitive)", () => {
    const r = evaluateProtocolCompliance("Aqui vai a MISSÃO DA SESSÃO de hoje");
    expect(r.presentStageIds).toContain("missao");
    expect(r.score).toBeGreaterThan(0);
  });

  it("detects stage by block type via mocked extractor", () => {
    const md = "conteúdo [[block:lay_explanation]] fim";
    const r = evaluateProtocolCompliance(md);
    expect(r.presentStageIds).toContain("leigo");
  });

  it("marks isComplete=true when all 15 stages are present via text markers", () => {
    const fullText = [
      "missão da sessão",
      "roadmap cognitivo",
      "explicação leiga",
      "explicação técnica",
      "fisiopatologia",
      "quadro clínico",
      "raciocínio diagnóstico",
      "diagnósticos diferenciais",
      "conduta",
      "pegadinhas",
      "active recall",
      "questão comentada",
      "resumo feynman",
      "mapa mental",
      "próximos passos",
    ].join(" | ");
    const r = evaluateProtocolCompliance(fullText);
    expect(r.presentStageIds).toHaveLength(15);
    expect(r.missingStageIds).toEqual([]);
    expect(r.isComplete).toBe(true);
    expect(r.shouldRetry).toBe(false);
    expect(r.score).toBe(100);
  });

  it("shouldRetry only when more than 3 stages missing", () => {
    // Provide 12 stages via text markers (3 missing → shouldRetry false)
    const twelve = [
      "missão da sessão",
      "roadmap cognitivo",
      "explicação leiga",
      "explicação técnica",
      "fisiopatologia",
      "quadro clínico",
      "raciocínio diagnóstico",
      "diagnósticos diferenciais",
      "conduta",
      "pegadinhas",
      "active recall",
      "questão comentada",
    ].join(" ");
    const r = evaluateProtocolCompliance(twelve);
    expect(r.missingStageIds).toHaveLength(3);
    expect(r.shouldRetry).toBe(false);
    expect(r.isComplete).toBe(false);
  });

  it("shouldRetry=true at exactly 4 missing", () => {
    const eleven = [
      "missão da sessão",
      "roadmap cognitivo",
      "explicação leiga",
      "explicação técnica",
      "fisiopatologia",
      "quadro clínico",
      "raciocínio diagnóstico",
      "diagnósticos diferenciais",
      "conduta",
      "pegadinhas",
      "active recall",
    ].join(" ");
    const r = evaluateProtocolCompliance(eleven);
    expect(r.missingStageIds.length).toBe(4);
    expect(r.shouldRetry).toBe(true);
  });

  it("score is rounded to nearest integer", () => {
    // 1 stage present out of 15 → 6.66... → 7
    const r = evaluateProtocolCompliance("missão da sessão");
    expect(r.score).toBe(7);
  });

  it("does not double-count when both block and text marker match same stage", () => {
    const md = "[[block:lay_explanation]] modo leigo";
    const r = evaluateProtocolCompliance(md);
    const count = r.presentStageIds.filter((id) => id === "leigo").length;
    expect(count).toBe(1);
  });
});

describe("buildComplementPrompt", () => {
  it("mentions the missing stage labels in the prompt", () => {
    const report = {
      score: 40,
      presentStageIds: [],
      missingStageIds: ["missao", "roadmap"],
      missingStageLabels: ["Missão", "Roadmap"],
      isComplete: false,
      shouldRetry: true,
    };
    const p = buildComplementPrompt(report);
    expect(p).toContain("Missão, Roadmap");
    expect(p).toMatch(/protocolo obrigatório/i);
  });

  it("works with empty missingStageLabels", () => {
    const p = buildComplementPrompt({
      score: 100,
      presentStageIds: [],
      missingStageIds: [],
      missingStageLabels: [],
      isComplete: true,
      shouldRetry: false,
    });
    expect(p).toContain("Faltaram as fases: .");
  });
});

describe("logComplianceTelemetry", () => {
  const report = {
    score: 50,
    presentStageIds: ["missao"],
    missingStageIds: ["roadmap"],
    missingStageLabels: ["Roadmap"],
    isComplete: false,
    shouldRetry: false,
  };

  it("silently no-ops when there is no authenticated user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await logComplianceTelemetry({ conversationId: "c-1", topic: "t", report });
    expect(fromMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("inserts a telemetry event with the expected shape when authenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-42" } } });
    await logComplianceTelemetry({ conversationId: "c-1", topic: "sepse", report });

    expect(fromMock).toHaveBeenCalledWith("telemetry_events");
    expect(insertMock).toHaveBeenCalledTimes(1);

    const payload = insertMock.mock.calls[0][0];
    expect(payload.user_id).toBe("user-42");
    expect(typeof payload.session_id).toBe("string");
    expect(payload.event_name).toBe("tutor_protocol_compliance");
    expect(payload.properties).toMatchObject({
      conversation_id: "c-1",
      topic: "sepse",
      score: 50,
      present: ["missao"],
      missing: ["roadmap"],
      is_complete: false,
      should_retry: false,
    });
  });

  it("defaults conversation_id/topic to null when omitted", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u" } } });
    await logComplianceTelemetry({ report });
    const payload = insertMock.mock.calls[0][0];
    expect(payload.properties.conversation_id).toBeNull();
    expect(payload.properties.topic).toBeNull();
  });

  it("swallows errors from supabase.auth.getUser", async () => {
    getUserMock.mockRejectedValue(new Error("boom"));
    await expect(
      logComplianceTelemetry({ report })
    ).resolves.toBeUndefined();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("swallows errors from insert", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u" } } });
    insertMock.mockRejectedValueOnce(new Error("db down"));
    await expect(logComplianceTelemetry({ report })).resolves.toBeUndefined();
  });
});
