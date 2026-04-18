"use client";

import { useTimerStore } from "@/lib/stores/timer-store";
import { useFlowStore } from "@/lib/stores/flow-store";
import { useTaskById } from "@/lib/stores/todoist-store";
import { formatElapsed } from "@/lib/utils/time";
import { Pause, Play, Check } from "lucide-react";

function TimerContent() {
  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  const activeFlowDate = useTimerStore((s) => s.activeFlowDate);
  const status = useTimerStore((s) => s.status);
  const displaySeconds = useTimerStore((s) => s.displaySeconds);
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const resumeTimer = useTimerStore((s) => s.resumeTimer);
  const stopAndSave = useTimerStore((s) => s.stopAndSave);
  const completeTask = useFlowStore((s) => s.completeTask);
  const task = useTaskById(activeTaskId ?? "");

  if (!activeTaskId || !task) return null;

  const handleComplete = async () => {
    const date = activeFlowDate;
    const taskId = activeTaskId;
    await stopAndSave();
    if (date && taskId) {
      completeTask(taskId, date);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1">
      <div className="relative flex h-2 w-2">
        {status === "running" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            status === "running" ? "bg-primary" : "bg-muted-foreground"
          }`}
        />
      </div>

      <span className="max-w-[120px] truncate text-sm font-medium text-foreground sm:text-xs">
        {task.title}
      </span>

      <span className="tabular-nums text-sm font-semibold text-primary">
        {formatElapsed(displaySeconds)}
      </span>

      <div className="flex items-center gap-0.5">
        <button
          onClick={() => (status === "running" ? pauseTimer() : resumeTimer())}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-6 sm:w-6"
        >
          {status === "running" ? (
            <Pause className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={handleComplete}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-green-500/20 hover:text-green-600 sm:h-6 sm:w-6"
        >
          <Check className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function TimerDisplay() {
  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  if (!activeTaskId) return null;
  return <TimerContent />;
}
