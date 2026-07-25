import { describe, it, expect } from "vitest";
import { normalizePlanJson, extractPlanTasks } from "../normalizePlanJson";

describe("normalizePlanJson", () => {
  describe("nullish / primitives", () => {
    it.each([null, undefined, 0, "", "hello", true, false, 42])(
      "returns empty canonical shape for primitive %p",
      (v) => {
        const r = normalizePlanJson(v);
        expect(r.tasks).toEqual([]);
        expect(r.metadata.version).toBe("v2");
        expect(r.metadata.source).toBe("runtime_normalization");
        expect(typeof r.metadata.generated_at).toBe("string");
      }
    );

    it("uses fallbackSource override", () => {
      const r = normalizePlanJson(null, "custom_src");
      expect(r.metadata.source).toBe("custom_src");
    });
  });

  describe("canonical v2 input", () => {
    it("preserves tasks and merges metadata, forcing version=v2", () => {
      const raw = {
        tasks: [{ id: "t1" }, { id: "t2" }],
        metadata: { version: "v1" as any, source: "prev", extra: "keep" },
      };
      const r = normalizePlanJson(raw);
      expect(r.tasks).toHaveLength(2);
      expect(r.tasks[0]).toEqual({ id: "t1" });
      expect(r.metadata.version).toBe("v2");
      expect(r.metadata.source).toBe("prev");
      expect(r.metadata.extra).toBe("keep");
    });

    it("handles canonical shape with non-object metadata gracefully", () => {
      const r = normalizePlanJson({ tasks: [{ a: 1 }], metadata: "invalid" as any });
      expect(r.tasks).toEqual([{ a: 1 }]);
      expect(r.metadata.source).toBe("runtime_normalization");
    });

    it("empty tasks array is preserved", () => {
      const r = normalizePlanJson({ tasks: [], metadata: { source: "x" } });
      expect(r.tasks).toEqual([]);
      expect(r.metadata.source).toBe("x");
    });
  });

  describe("legacy array v1", () => {
    it("wraps array into tasks and tags source=legacy_array", () => {
      const arr = [{ id: 1 }, { id: 2 }];
      const r = normalizePlanJson(arr);
      expect(r.tasks).toEqual(arr);
      expect(r.metadata.source).toBe("legacy_array");
      expect(r.metadata.version).toBe("v2");
    });

    it("empty array yields empty tasks", () => {
      const r = normalizePlanJson([]);
      expect(r.tasks).toEqual([]);
      expect(r.metadata.source).toBe("legacy_array");
    });
  });

  describe("legacy blocks object v1", () => {
    it("moves blocks→tasks and preserves siblings in metadata", () => {
      const raw = {
        blocks: [{ b: 1 }],
        tips: ["dica"],
        focus_areas: ["cardio"],
        greeting: "olá",
      };
      const r = normalizePlanJson(raw);
      expect(r.tasks).toEqual([{ b: 1 }]);
      expect(r.metadata.source).toBe("legacy_blocks");
      expect(r.metadata.tips).toEqual(["dica"]);
      expect(r.metadata.focus_areas).toEqual(["cardio"]);
      expect(r.metadata.greeting).toBe("olá");
      // blocks key should not leak into metadata
      expect((r.metadata as any).blocks).toBeUndefined();
    });
  });

  describe("unknown object shape", () => {
    it("returns empty tasks and preserves fields in metadata", () => {
      const raw = { foo: 1, bar: "x" };
      const r = normalizePlanJson(raw);
      expect(r.tasks).toEqual([]);
      expect(r.metadata.source).toBe("legacy_unknown");
      expect((r.metadata as any).foo).toBe(1);
      expect((r.metadata as any).bar).toBe("x");
    });
  });

  describe("precedence", () => {
    it("canonical `tasks` wins over `blocks` when both present", () => {
      const raw = { tasks: [{ t: 1 }], blocks: [{ b: 1 }] };
      const r = normalizePlanJson(raw);
      expect(r.tasks).toEqual([{ t: 1 }]);
    });
  });
});

describe("extractPlanTasks", () => {
  it("returns array for canonical input", () => {
    expect(extractPlanTasks({ tasks: [{ x: 1 }] })).toEqual([{ x: 1 }]);
  });
  it("returns array for legacy array", () => {
    expect(extractPlanTasks([{ y: 1 }])).toEqual([{ y: 1 }]);
  });
  it("returns [] for null", () => {
    expect(extractPlanTasks(null)).toEqual([]);
  });
  it("always returns an Array (backward compat)", () => {
    expect(Array.isArray(extractPlanTasks(undefined))).toBe(true);
    expect(Array.isArray(extractPlanTasks({ blocks: [] }))).toBe(true);
    expect(Array.isArray(extractPlanTasks({ unknown: 1 }))).toBe(true);
  });
});
