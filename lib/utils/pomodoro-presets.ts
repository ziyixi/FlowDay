import { formatDuration } from "./time";

const BASE_MINS = [5, 30, 45, 60, 90, 120] as const;

export type PomodoroPreset = {
  mins: number;
  label: string;
  suggested?: boolean;
};

// Build the preset list with the task's own estimate prepended (and
// deduplicated). Surfacing the estimate first means a one-click pomodoro that
// matches what the user already planned, rather than a best-guess round number.
export function buildPomodoroPresets(
  estimatedMins?: number | null
): PomodoroPreset[] {
  const base: PomodoroPreset[] = BASE_MINS.map((mins) => ({
    mins,
    label: formatDuration(mins),
  }));
  if (estimatedMins && estimatedMins > 0) {
    const filtered = base.filter((p) => p.mins !== estimatedMins);
    return [
      { mins: estimatedMins, label: formatDuration(estimatedMins), suggested: true },
      ...filtered,
    ];
  }
  return base;
}
