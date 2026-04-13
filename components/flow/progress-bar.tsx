"use client";

import { useFlowTasksForDate, useFlowStore } from "@/lib/stores/flow-store";
import { formatDuration } from "@/lib/utils/time";

export function ProgressBar({ date }: { date: string }) {
  const flowTasks = useFlowTasksForDate(date);
  const completedTasks = useFlowStore((s) => s.completedTasks);
  const completedCount = (completedTasks[date] ?? []).length;
  const totalCount = flowTasks.length + completedCount;

  const remainingMins = flowTasks.reduce(
    (sum, t) => sum + (t.estimatedMins ?? 0),
    0
  );

  if (totalCount === 0) return null;

  const fraction = totalCount > 0 ? completedCount / totalCount : 0;

  return (
    <div className="border-t border-border bg-background/80 px-4 py-2.5 backdrop-blur-sm">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {completedCount}/{totalCount} tasks
        </span>
        {remainingMins > 0 && (
          <span>~{formatDuration(remainingMins)} remaining</span>
        )}
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
