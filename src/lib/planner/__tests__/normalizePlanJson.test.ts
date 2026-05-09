import { describe, it, expect } from "vitest";
import { normalizePlanJson, extractPlanTasks } from "../normalizePlanJson";

describe("normalizePlanJson — Loop 3A integrity", () => {
  it("handles null / undefined as empty plan v2", () => {
    for (const raw of [null, undefined, 0, "", false]) {
      const r = normalizePlanJson(raw as unknown);
      expect(r.tasks).toEqual([]);
      expect(r.metadata.version).toBe("v2");
    }
  });

  it("passes through canonical v2 unchanged", () => {
    const raw = {
      tasks: [{ id: "t1" }, { id: "t2" }],
      metadata: { version: "v2", generated_at: "2026-05-09", source: "ai" },
    };
    const r = normalizePlanJson(raw);
    expect(r.tasks).toHaveLength(2);
    expect(r.metadata.source).toBe("ai");
    expect(r.metadata.version).toBe("v2");
  });

  it("normalizes legacy array format", () => {
    const raw = [{ topic: "Cardio" }, { topic: "Pneumo" }];
    const r = normalizePlanJson(raw);
    expect(r.tasks).toHaveLength(2);
    expect(r.metadata.source).toBe("legacy_array");
  });

  it("normalizes legacy object with `blocks`", () => {
    const raw = {
      blocks: [{ topic: "A" }, { topic: "B" }],
      tips: ["tip1"],
      focus_areas: ["X"],
    };
    const r = normalizePlanJson(raw);
    expect(r.tasks).toHaveLength(2);
    expect(r.metadata.source).toBe("legacy_blocks");
    expect((r.metadata as any).tips).toEqual(["tip1"]);
    expect((r.metadata as any).focus_areas).toEqual(["X"]);
  });

  it("preserves unknown objects as metadata with empty tasks", () => {
    const raw = { weirdField: 42, nested: { a: 1 } };
    const r = normalizePlanJson(raw);
    expect(r.tasks).toEqual([]);
    expect(r.metadata.source).toBe("legacy_unknown");
    expect((r.metadata as any).weirdField).toBe(42);
  });

  it("extractPlanTasks always returns an array", () => {
    expect(extractPlanTasks(null)).toEqual([]);
    expect(extractPlanTasks([{ a: 1 }])).toHaveLength(1);
    expect(extractPlanTasks({ blocks: [{ x: 1 }, { x: 2 }] })).toHaveLength(2);
    expect(extractPlanTasks({ tasks: [{ y: 1 }] })).toHaveLength(1);
  });
});
