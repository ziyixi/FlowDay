"use client";

import type { Task } from "@/lib/types/task";
import { PRIORITY_CONFIG } from "@/lib/types/task";
import { formatDuration } from "@/lib/utils/time";
import { cn } from "@/lib/utils";

interface TaskCardOverlayProps {
  task: Task;
}

export function TaskCardOverlay({ task }: TaskCardOverlayProps) {
  const priorityColor = PRIORITY_CONFIG[task.priority].color;

  return (
    <div className="flex items-start gap-2.5 rounded-md border border-border bg-card px-2.5 py-2 shadow-lg ring-2 ring-primary/20 w-[252px]">
      <span
        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", priorityColor)}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {task.title}
        </p>
        {task.projectName && (
          <p className="truncate text-xs text-muted-foreground">
            {task.projectName}
          </p>
        )}
      </div>
      {task.estimatedMins != null && task.estimatedMins > 0 && (
        <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatDuration(task.estimatedMins)}
        </span>
      )}
    </div>
  );
}
