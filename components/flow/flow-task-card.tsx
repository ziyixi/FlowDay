"use client";

import { useState, useEffect, useCallback } from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Play, Pause, Check, ChevronsDown, X } from "lucide-react";
import type { Task } from "@/lib/types/task";
import { PRIORITY_CONFIG } from "@/lib/types/task";
import { formatDuration, formatElapsed } from "@/lib/utils/time";
import { useFlowStore } from "@/lib/stores/flow-store";
import { useTimerStore } from "@/lib/stores/timer-store";
import { ManualEntry } from "@/components/timer/manual-entry";
import { cn } from "@/lib/utils";

interface FlowTaskCardProps {
  task: Task;
  index: number;
  isNext: boolean;
  date: string;
}

function useTaskLoggedSeconds(taskId: string, revision: number): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entries?taskId=${encodeURIComponent(taskId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((entries: { durationS: number | null }[]) => {
        if (!cancelled) {
          setSeconds(entries.reduce((s, e) => s + (e.durationS ?? 0), 0));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [taskId, revision]);

  return seconds;
}

export function FlowTaskCard({ task, index, isNext, date }: FlowTaskCardProps) {
  const completeTask = useFlowStore((s) => s.completeTask);
  const skipTask = useFlowStore((s) => s.skipTask);
  const removeTask = useFlowStore((s) => s.removeTask);
  const sortableKey = useFlowStore((s) => s.sortableKeys[task.id] ?? 0);

  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  const timerStatus = useTimerStore((s) => s.status);
  const displaySeconds = useTimerStore((s) => s.displaySeconds);
  const startTimer = useTimerStore((s) => s.startTimer);
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const resumeTimer = useTimerStore((s) => s.resumeTimer);
  const stopAndSave = useTimerStore((s) => s.stopAndSave);
  const stopWithoutSaving = useTimerStore((s) => s.stopWithoutSaving);

  const isActive = activeTaskId === task.id;
  const isRunning = isActive && timerStatus === "running";
  const isPaused = isActive && timerStatus === "paused";

  // Revision counter: bumped when entries are created/edited/deleted
  const [entryRevision, setEntryRevision] = useState(0);
  const onEntriesChanged = useCallback(() => {
    setEntryRevision((r) => r + 1);
  }, []);

  const loggedSeconds = useTaskLoggedSeconds(task.id, entryRevision);
  const shownSeconds = isActive ? displaySeconds : loggedSeconds;

  // Use sortableKey in the id to prevent stale dnd-kit state when task is removed and re-added
  const { ref, isDragSource, isDropTarget } = useSortable({
    id: `${date}::${task.id}::${sortableKey}`,
    index,
    group: `day-flow-${date}`,
    type: "flow-task",
    accept: ["task-pool-card", "flow-task"],
    data: { task, date },
  });

  const priorityColor = PRIORITY_CONFIG[task.priority].color;

  const handlePlayPause = () => {
    if (isRunning) {
      pauseTimer();
    } else if (isPaused) {
      resumeTimer();
    } else {
      startTimer(task.id, date);
    }
  };

  const handleComplete = async () => {
    if (isActive) {
      await stopAndSave();
    }
    completeTask(task.id, date);
  };

  const handleRemove = () => {
    if (isActive) {
      stopWithoutSaving();
    }
    removeTask(task.id, date);
  };

  return (
    <div
      ref={ref}
      className={cn(
        "relative cursor-grab active:cursor-grabbing",
        isDragSource && "opacity-50"
      )}
    >
      {/* Drop indicator line */}
      <div
        className={cn(
          "pointer-events-none absolute -top-1.5 left-0 right-0 h-0.5 rounded-full transition-all duration-150",
          isDropTarget
            ? "bg-primary scale-x-100 opacity-100"
            : "bg-transparent scale-x-0 opacity-0"
        )}
      />
      <div
        className={cn(
          "rounded-lg border bg-card px-4 py-3 transition-colors",
          isNext
            ? "border-l-[3px] border-l-primary border-t-border border-r-border border-b-border"
            : "border-border",
          isActive && "ring-1 ring-primary/30",
          isDropTarget && !isDragSource && "border-primary/40"
        )}
      >
      {/* Header row: badge + title + priority dot */}
      <div className="flex items-start gap-3">
        <span
          className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", priorityColor)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isNext && (
              <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                Next
              </span>
            )}
            <p className="truncate text-sm font-medium text-foreground">
              {task.title}
            </p>
          </div>
          {task.projectName && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {task.projectName}
            </p>
          )}
        </div>
      </div>

      {/* Footer row: time info + action buttons */}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {task.estimatedMins != null && task.estimatedMins > 0 && (
            <span className="tabular-nums">
              {formatDuration(task.estimatedMins)} est
            </span>
          )}
          {shownSeconds > 0 ? (
            <span
              className={cn(
                "tabular-nums font-medium",
                isActive ? "text-primary" : "text-foreground"
              )}
            >
              {formatElapsed(shownSeconds)}
            </span>
          ) : (
            <span className="tabular-nums text-muted-foreground/60">&mdash;</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              isActive
                ? "text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            onClick={handlePlayPause}
          >
            {isRunning ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
          <ManualEntry taskId={task.id} flowDate={date} onEntriesChanged={onEntriesChanged} />
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-green-500/20 hover:text-green-600 transition-colors"
            onClick={handleComplete}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={() => skipTask(task.id, date)}
          >
            <ChevronsDown className="h-3.5 w-3.5" />
          </button>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/20 hover:text-red-600 transition-colors"
            onClick={handleRemove}
            title="Return to pool"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
