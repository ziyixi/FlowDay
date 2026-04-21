import { describe, it, expect } from "vitest";
import { buildPomodoroPresets } from "@/lib/utils/pomodoro-presets";

describe("buildPomodoroPresets", () => {
  it("returns the fixed base list when no estimate is given", () => {
    const presets = buildPomodoroPresets();
    expect(presets.map((p) => p.mins)).toEqual([5, 30, 45, 60, 90, 120]);
    expect(presets.every((p) => !p.suggested)).toBe(true);
  });

  it("ignores null, undefined, zero, and negative estimates", () => {
    const baseMins = [5, 30, 45, 60, 90, 120];
    expect(buildPomodoroPresets(null).map((p) => p.mins)).toEqual(baseMins);
    expect(buildPomodoroPresets(undefined).map((p) => p.mins)).toEqual(baseMins);
    expect(buildPomodoroPresets(0).map((p) => p.mins)).toEqual(baseMins);
    expect(buildPomodoroPresets(-15).map((p) => p.mins)).toEqual(baseMins);
  });

  it("prepends a non-base estimate as the first, suggested preset", () => {
    const presets = buildPomodoroPresets(25);
    expect(presets[0]).toEqual({ mins: 25, label: "25m", suggested: true });
    expect(presets).toHaveLength(7);
    expect(presets.slice(1).map((p) => p.mins)).toEqual([5, 30, 45, 60, 90, 120]);
  });

  it("deduplicates when the estimate matches a base preset but still marks it suggested", () => {
    const presets = buildPomodoroPresets(45);
    expect(presets).toHaveLength(6);
    expect(presets[0]).toEqual({ mins: 45, label: "45m", suggested: true });
    // The base 45m must be removed so the list isn't duplicated.
    const fortyFives = presets.filter((p) => p.mins === 45);
    expect(fortyFives).toHaveLength(1);
  });

  it("labels multi-hour estimates using formatDuration conventions", () => {
    expect(buildPomodoroPresets(90)[0].label).toBe("1h 30m");
    expect(buildPomodoroPresets(120)[0].label).toBe("2h");
    expect(buildPomodoroPresets(15)[0].label).toBe("15m");
  });
});
