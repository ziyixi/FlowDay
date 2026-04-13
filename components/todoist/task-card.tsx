"use client";

import { useState, useRef, useEffect } from "react";
import { useDraggable } from "@dnd-kit/react";
import type { Task } from "@/lib/types/task";
import { PRIORITY_CONFIG } from "@/lib/types/task";
import { formatDuration } from "@/lib/utils/time";
import { useTodoistStore } from "@/lib/stores/todoist-store";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function InlineEstimateEditor({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.estimatedMins?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const updateEstimate = useTodoistStore((s) => s.updateEstimate);

  useEffect(() => {
    if (editing) {
      setValue(task.estimatedMins?.toString() ?? "");
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, task.estimatedMins]);

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    const mins = trimmed === "" ? null : parseInt(trimmed, 10);
    if (mins !== null && (isNaN(mins) || mins < 0)) return;
    if (mins !== task.estimatedMins) {
      updateEstimate(task.id, mins);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground hover:text-foreground transition-colors cursor-text"
        title="Click to edit estimate"
      >
        {task.estimatedMins != null && task.estimatedMins > 0
          ? formatDuration(task.estimatedMins)
          : "—"}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="number"
      min="0"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      onClick={(e) => e.stopPropagation()}
      className="mt-0.5 w-12 shrink-0 rounded border border-border bg-background px-1 text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
      placeholder="min"
    />
  );
}

export function TaskCard({ task }: { task: Task }) {
  const { ref, isDragSource } = useDraggable({
    id: task.id,
    type: "task-pool-card",
    data: { task },
  });

  const priorityColor = PRIORITY_CONFIG[task.priority].color;
  const hasDescription = task.description && task.description.trim().length > 0;

  const cardContent = (
    <>
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
      <InlineEstimateEditor task={task} />
    </>
  );

  const cardClassName = cn(
    "group flex items-start gap-2.5 rounded-md border border-border bg-card px-2.5 py-2 transition-colors hover:bg-accent cursor-grab active:cursor-grabbing",
    isDragSource && "opacity-50"
  );

  if (!hasDescription) {
    return (
      <div ref={ref} className={cardClassName}>
        {cardContent}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<div />} className="w-full">
        <div ref={ref} className={cardClassName}>
          {cardContent}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs whitespace-pre-wrap">
        {task.description}
      </TooltipContent>
    </Tooltip>
  );
}
