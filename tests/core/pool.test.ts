import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "../../src/core/pool";

describe("mapWithConcurrency", () => {
  it("preserves input order while limiting active workers", async () => {
    let active = 0;
    let peak = 0;
    const result = await mapWithConcurrency([4, 3, 2, 1], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => window.setTimeout(resolve, value));
      active -= 1;
      return value * 2;
    });
    expect(result).toEqual([8, 6, 4, 2]);
    expect(peak).toBe(2);
  });

  it("passes stable indexes to workers", async () => {
    expect(
      await mapWithConcurrency(["a", "b"], 8, async (value, index) =>
        Promise.resolve(`${index}:${value}`),
      ),
    ).toEqual(["0:a", "1:b"]);
  });

  it("handles empty input without calling the worker", async () => {
    let calls = 0;
    expect(
      await mapWithConcurrency([], 2, () => {
        calls += 1;
        return Promise.resolve("unused");
      }),
    ).toEqual([]);
    expect(calls).toBe(0);
  });

  it("normalizes non-positive and fractional limits to one worker", async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2], 0.5, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active -= 1;
    });
    expect(peak).toBe(1);
  });

  it("rejects when a worker rejects", async () => {
    await expect(
      mapWithConcurrency([1], 1, async () =>
        Promise.reject(new Error("failed")),
      ),
    ).rejects.toThrow("failed");
  });
});
