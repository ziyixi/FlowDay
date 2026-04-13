"use client";

import { useState, useEffect } from "react";
import { useFlowTasksForDate, useCompletedTasksForDate, useFlowStore } from "@/lib/stores/flow-store";
import { formatDuration, formatElapsed } from "@/lib/utils/time";
import { getEntryRevision } from "@/lib/stores/timer-store";

export function ProgressBar({ date }: { date: string }) {
  const flowTasks = useFlowTasksForDate(date);
  const completedTasks = useCompletedTasksForDate(date);
  const completedCount = completedTasks.length;
  const totalCount = flowTasks.length + completedCount;

  const estimatedTotalMins = [...flowTasks, ...completedTasks].reduce(
    (sum, t) => sum + (t.estimatedMins ?? 0),
    0
  );
  const remainingMins = flowTasks.reduce(
    (sum, t) => sum + (t.estimatedMins ?? 0),
    0
  );

  // Fetch actual logged time for this date
  const [actualSeconds, setActualSeconds] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entries?date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((entries: { durationS: number | null }[]) => {
        if (!cancelled) {
          setActualSeconds(entries.reduce((s, e) => s + (e.durationS ?? 0), 0));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [date, completedCount, getEntryRevision()]);

  if (totalCount === 0) return null;

  const fraction = totalCount > 0 ? completedCount / totalCount : 0;

  return (
    <div className="border-t border-border bg-background/80 px-4 py-2.5 backdrop-blur-sm">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {completedCount}/{totalCount} tasks
        </span>
        <div className="flex items-center gap-3">
          {actualSeconds > 0 && (
            <span className="tabular-nums font-medium text-foreground">
              {formatElapsed(actualSeconds)} logged
            </span>
          )}
          {remainingMins > 0 && (
            <span>~{formatDuration(remainingMins)} left</span>
          )}
        </div>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
    </div>
  );
}
