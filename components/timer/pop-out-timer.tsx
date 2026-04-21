"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, Pause, PictureInPicture2, Play, X } from "lucide-react";
import { useTimerStore } from "@/lib/stores/timer-store";
import { useFlowStore, useFlowTasksForDate } from "@/lib/stores/flow-store";
import { useTaskById } from "@/lib/stores/todoist-store";
import { usePopOutStore } from "@/lib/stores/pop-out-store";
import { buildPomodoroPresets } from "@/lib/utils/pomodoro-presets";
import { formatDuration, formatElapsed } from "@/lib/utils/time";
import { cn } from "@/lib/utils";

export function PopOutTimerButton() {
  const pipWindow = usePopOutStore((s) => s.pipWindow);
  const container = usePopOutStore((s) => s.container);
  const open = usePopOutStore((s) => s.open);
  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  const pomodoroFinishedTaskId = useTimerStore((s) => s.pomodoroFinishedTaskId);

  const supported =
    typeof window !== "undefined" && "documentPictureInPicture" in window;

  // Mirror dark-mode class so theme toggles in the main window propagate.
  useEffect(() => {
    if (!pipWindow) return;
    const sync = () => {
      const isDark = document.documentElement.classList.contains("dark");
      pipWindow.document.documentElement.classList.toggle("dark", isDark);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [pipWindow]);

  if (!supported) return null;
  // Keep the portal mounted while a pomodoro-finished marker is set so the
  // "restart or complete" panel stays visible after the timer drops to idle.
  const hasActivity = Boolean(activeTaskId) || Boolean(pomodoroFinishedTaskId);
  if (!hasActivity) return null;

  return (
    <>
      {activeTaskId && (
        <button
          onClick={() => void open()}
          title="Pop out timer"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-6 sm:w-6"
        >
          <PictureInPicture2 className="h-3 w-3" />
        </button>
      )}
      {pipWindow && container && createPortal(<PipTimerContent />, container)}
    </>
  );
}

function PipTimerContent() {
  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  const activeFlowDate = useTimerStore((s) => s.activeFlowDate);
  const status = useTimerStore((s) => s.status);
  const timerMode = useTimerStore((s) => s.timerMode);
  const pomodoroTargetSeconds = useTimerStore((s) => s.pomodoroTargetSeconds);
  const displaySeconds = useTimerStore((s) => s.displaySeconds);
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const resumeTimer = useTimerStore((s) => s.resumeTimer);
  const stopAndSave = useTimerStore((s) => s.stopAndSave);
  const startTimer = useTimerStore((s) => s.startTimer);
  const pomodoroFinishedTaskId = useTimerStore((s) => s.pomodoroFinishedTaskId);

  const completeTask = useFlowStore((s) => s.completeTask);
  const currentDate = useFlowStore((s) => s.currentDate);
  const task = useTaskById(activeTaskId ?? "");

  const flowDate = activeFlowDate ?? currentDate;
  const flowTasks = useFlowTasksForDate(flowDate);
  const nextTask = flowTasks.find((t) => t.id !== activeTaskId);

  // A pomodoro just hit zero — surface a restart/complete panel so the user
  // doesn't land on a bare "Up next" screen for the task they were just working on.
  if (pomodoroFinishedTaskId) {
    return <PomodoroFinishedPanel />;
  }

  // Idle: surface the next queued task as the new "current" with a Start button.
  if (!activeTaskId || !task) {
    if (!nextTask) {
      return (
        <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
          No tasks queued
        </div>
      );
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-3">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Up next
        </div>
        <div className="text-center">
          <div className="truncate text-sm font-medium" title={nextTask.title}>
            {nextTask.title}
          </div>
          {nextTask.estimatedMins != null && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              ~{formatDuration(nextTask.estimatedMins)}
            </div>
          )}
        </div>
        <button
          onClick={() => startTimer(nextTask.id, flowDate)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Play className="h-3 w-3" />
          Start
        </button>
      </div>
    );
  }

  const isPomodoro = timerMode === "pomodoro";
  const pomodoroLabel =
    pomodoroTargetSeconds != null
      ? formatDuration(Math.round(pomodoroTargetSeconds / 60))
      : null;

  const handleComplete = async () => {
    const date = activeFlowDate;
    const taskId = activeTaskId;
    await stopAndSave();
    if (date && taskId) {
      completeTask(taskId, date);
    }
  };

  return (
    <div className="flex h-full flex-col justify-between gap-2 p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex h-2 w-2 shrink-0">
          {status === "running" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/75" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              status === "running" ? "bg-primary" : "bg-muted-foreground"
            }`}
          />
        </div>
        <span className="truncate text-sm font-medium" title={task.title}>
          {task.title}
        </span>
        {isPomodoro && (
          <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {pomodoroLabel ?? "Pomodoro"}
          </span>
        )}
      </div>

      <div className="text-center text-3xl font-bold tabular-nums text-primary">
        {formatElapsed(displaySeconds)}
        {isPomodoro && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            left
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => (status === "running" ? pauseTimer() : resumeTimer())}
          title={status === "running" ? "Pause" : "Resume"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent"
        >
          {status === "running" ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={handleComplete}
          title="Complete task"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-green-500/20 hover:text-green-600"
        >
          <Check className="h-4 w-4" />
        </button>
      </div>

      {nextTask && (
        <div
          className="truncate border-t border-border/50 pt-1.5 text-[11px] text-muted-foreground"
          title={nextTask.title}
        >
          <span className="opacity-60">Next: </span>
          {nextTask.title}
          {nextTask.estimatedMins != null && (
            <span className="opacity-60"> · ~{formatDuration(nextTask.estimatedMins)}</span>
          )}
        </div>
      )}
    </div>
  );
}

function PomodoroFinishedPanel() {
  const finishedTaskId = useTimerStore((s) => s.pomodoroFinishedTaskId);
  const finishedFlowDate = useTimerStore((s) => s.pomodoroFinishedFlowDate);
  const startPomodoro = useTimerStore((s) => s.startPomodoro);
  const dismiss = useTimerStore((s) => s.dismissPomodoroFinished);
  const completeTask = useFlowStore((s) => s.completeTask);
  const task = useTaskById(finishedTaskId ?? "");

  if (!finishedTaskId || !finishedFlowDate) return null;

  const presets = buildPomodoroPresets(task?.estimatedMins);

  const handleRestart = (mins: number) => {
    dismiss();
    void startPomodoro(finishedTaskId, finishedFlowDate, mins * 60);
  };

  const handleComplete = () => {
    completeTask(finishedTaskId, finishedFlowDate);
    dismiss();
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Pomodoro done
          </span>
        </div>
        <button
          onClick={dismiss}
          title="Dismiss"
          className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div
        className="truncate text-sm font-medium text-foreground"
        title={task?.title ?? ""}
      >
        {task?.title ?? "Task"}
      </div>

      <div className="grid grid-cols-3 gap-1">
        {presets.map((preset) => (
          <button
            key={preset.mins}
            onClick={() => handleRestart(preset.mins)}
            title={
              preset.suggested
                ? `Restart · matches estimate (${preset.label})`
                : `Restart ${preset.label}`
            }
            className={cn(
              "rounded-md px-1.5 py-1 text-xs font-medium transition-colors",
              preset.suggested
                ? "bg-primary/15 text-primary ring-1 ring-primary/30 hover:bg-primary/25"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <button
        onClick={handleComplete}
        className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-green-500/20 hover:text-green-600"
      >
        <Check className="h-3 w-3" />
        Complete &amp; next
      </button>
    </div>
  );
}
