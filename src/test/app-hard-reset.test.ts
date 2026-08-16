import { afterEach, describe, expect, it, vi } from "vitest";
import { performHardAppReset } from "@/lib/app-hard-reset";

describe("performHardAppReset", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("libera o bootstrap quando a API de Service Worker fica pendente", async () => {
    vi.useFakeTimers();

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: vi.fn(() => new Promise(() => {})),
      },
    });

    const reset = performHardAppReset();
    let completed = false;
    void reset.then(() => {
      completed = true;
    });

    await vi.advanceTimersByTimeAsync(1499);
    expect(completed).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await reset;
    expect(completed).toBe(true);
  });
});
