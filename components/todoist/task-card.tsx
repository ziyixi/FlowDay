"use client";

import { useDraggable } from "@dnd-kit/react";
import type { Task } from "@/lib/types/task";
import { PRIORITY_CONFIG } from "@/lib/types/task";
import { formatDuration } from "@/lib/utils/time";
import { cn } from "@/lib/utils";

export function TaskCard({ task }: { task: Task }) {
  const { ref, isDragSource } = useDraggable({
    id: task.id,
    type: "task-pool-card",
    data: { task },
  });

  const priorityColor = PRIORITY_CONFIG[task.priority].color;

  return (
    <div
      ref={ref}
      className={cn(
        "group flex items-start gap-2.5 rounded-md border border-border bg-card px-2.5 py-2 transition-colors hover:bg-accent cursor-grab active:cursor-grabbing",
        isDragSource && "opacity-50"
      )}
    >
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
