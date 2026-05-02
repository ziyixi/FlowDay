"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Pause, PictureInPicture2, Play, X } from "lucide-react";
import { useTimerStore } from "@/features/timer/store";
import { useFlowStore, useFlowTasksForDate } from "@/features/flow/store";
import { useTaskById } from "@/features/todoist/store";
import { usePopOutStore } from "@/lib/stores/pop-out-store";
import { useTaskLoggedSeconds } from "@/lib/hooks/use-task-logged-seconds";
import { buildPomodoroPresets } from "@/lib/utils/pomodoro-presets";
import { formatDuration, formatElapsed } from "@/lib/utils/time";
import { isMiscTaskId, MISC_TASK_TITLE } from "@/lib/utils/misc-task";
import { cn } from "@/lib/utils";

const POP_OUT_AUTO_CLOSE_GRACE_MS = 500;
const PIP_SURFACE_STYLE = {
  background:
    "linear-gradient(180deg, var(--background) 0%, color-mix(in oklch, var(--primary) 5%, var(--background)) 100%)",
} as const;

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

function TimerProgressRing({
  progress,
  status,
  children,
}: {
  progress: number | null;
  status: "idle" | "running" | "paused";
  children: ReactNode;
}) {
  const radius = 47;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = progress == null ? 0 : clampProgress(progress);
  const dashOffset = circumference * (1 - clampedProgress);

  return (
    <div className="relative grid h-[124px] w-[124px] shrink-0 place-items-center">
      <svg
        className="absolute inset-0 h-full w-full -rotate-90"
        viewBox="0 0 112 112"
        aria-hidden="true"
      >
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="9"
        />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke={status === "paused" ? "var(--muted-foreground)" : "var(--primary)"}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset,stroke] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-2 rounded-full border border-border/70 bg-card/80 shadow-[inset_0_1px_0_oklch(1_0_0/0.55),0_12px_32px_-24px_oklch(0_0_0/0.55)] backdrop-blur-sm" />
      <div className="relative z-10 flex min-w-0 flex-col items-center text-center">
        {children}
      </div>
    </div>
  );
}

function PipIconButton({
  children,
  title,
  onClick,
  variant = "neutral",
}: {
  children: ReactNode;
  title: string;
  onClick: () => void;
  variant?: "neutral" | "primary" | "success";
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border text-foreground shadow-[0_1px_2px_oklch(0_0_0/0.04)] transition-colors",
        variant === "primary"
          ? "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
          : variant === "success"
            ? "border-green-500/20 bg-green-500/10 text-green-700 hover:bg-green-500/20 dark:text-green-300"
            : "border-border bg-card hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

export function PopOutTimerButton() {
  const pipWindow = usePopOutStore((s) => s.pipWindow);
  const container = usePopOutStore((s) => s.container);
  const open = usePopOutStore((s) => s.open);
  const closePopOut = usePopOutStore((s) => s.close);
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

  const hasActivity = Boolean(activeTaskId) || Boolean(pomodoroFinishedTaskId);

  // Auto-close the pop-out once the user has nothing left to act on. Without
  // this the portal unmounts (no activity) but the PiP window stays open and
  // shows an empty white pane — the user described it as a "blank page".
  //
  // `hadActivityRef` guards against the open-race: the pomodoro picker calls
  // openPopOut() first (to preserve the user gesture), then startPomodoro().
  // If openPopOut resolves before startPomodoro sets activeTaskId, this effect
  // would see "window open + no activity" and close the window on the spot.
  // We only treat "no activity" as a close signal after we've observed
  // activity for this pop-out session. The close is also delayed briefly so a
  // restart click that clears/hydrates state while startPomodoro awaits prior
  // entries does not shut the PiP window before the new round appears.
  const hadActivityRef = useRef(false);
  useEffect(() => {
    if (!pipWindow) {
      hadActivityRef.current = false;
      return;
    }
    if (hasActivity) {
      hadActivityRef.current = true;
      return;
    }
    if (hadActivityRef.current) {
      const timer = window.setTimeout(() => {
        const timerState = useTimerStore.getState();
        if (!timerState.activeTaskId && !timerState.pomodoroFinishedTaskId) {
          closePopOut();
        }
      }, POP_OUT_AUTO_CLOSE_GRACE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [pipWindow, hasActivity, closePopOut]);

  if (!supported) return null;
  // Keep the portal mounted while a pomodoro-finished marker is set so the
  // "restart or complete" panel stays visible after the timer drops to idle.
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
  const closePopOut = usePopOutStore((s) => s.close);

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
  const isMiscTask = isMiscTaskId(activeTaskId);

  const isPomodoro = timerMode === "pomodoro";
  const pomodoroLabel =
    pomodoroTargetSeconds != null
      ? formatDuration(Math.round(pomodoroTargetSeconds / 60))
      : null;
  const progress =
    isPomodoro && pomodoroTargetSeconds != null
      ? displaySeconds / pomodoroTargetSeconds
      : null;
  const taskTitle = isMiscTask ? MISC_TASK_TITLE : task.title;
  const statusLabel =
    status === "running" ? (isPomodoro ? "Focus" : "Tracking") : "Paused";

  const handleComplete = async () => {
    const date = activeFlowDate;
    const taskId = activeTaskId;
    await stopAndSave();
    if (isMiscTask) {
      closePopOut();
    } else if (date && taskId) {
      completeTask(taskId, date);
    }
  };

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden p-3.5 text-foreground"
      style={PIP_SURFACE_STYLE}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-primary/80" />

      <div className="flex min-h-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase text-muted-foreground">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                status === "running" ? "bg-primary" : "bg-muted-foreground"
              )}
            />
            {statusLabel}
          </div>
          <div className="truncate text-sm font-semibold leading-tight" title={taskTitle}>
            {taskTitle}
          </div>
        </div>
        {isPomodoro && (
          <span className="shrink-0 rounded-md border border-border/70 bg-card px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-[0_1px_2px_oklch(0_0_0/0.04)]">
            {pomodoroLabel ?? "Pomodoro"}
          </span>
        )}
      </div>

      <div className="flex flex-1 items-center justify-center py-2">
        <TimerProgressRing progress={progress} status={status}>
          <span className="text-[30px] font-semibold leading-none tabular-nums text-primary">
            {formatElapsed(displaySeconds)}
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase text-muted-foreground">
            {isPomodoro ? "left" : "elapsed"}
          </span>
        </TimerProgressRing>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {nextTask ? (
            <div
              className="truncate text-[11px] text-muted-foreground"
              title={nextTask.title}
            >
              <span className="opacity-60">Next </span>
              {nextTask.title}
              {nextTask.estimatedMins != null && (
                <span className="opacity-60">
                  {" "}
                  · {formatDuration(nextTask.estimatedMins)}
                </span>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">Last task</div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <PipIconButton
            onClick={() => (status === "running" ? pauseTimer() : resumeTimer())}
            title={status === "running" ? "Pause" : "Resume"}
            variant={status === "running" ? "neutral" : "primary"}
          >
            {status === "running" ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </PipIconButton>
          <PipIconButton
            onClick={() => void handleComplete()}
            title={isMiscTask ? "Save misc time" : "Complete task"}
            variant="success"
          >
            <Check className="h-4 w-4" />
          </PipIconButton>
        </div>
      </div>
    </div>
  );
}

function PomodoroFinishedPanel() {
  const finishedTaskId = useTimerStore((s) => s.pomodoroFinishedTaskId);
  const finishedFlowDate = useTimerStore((s) => s.pomodoroFinishedFlowDate);
  const entryRevision = useTimerStore((s) => s.entryRevision);
  const startPomodoro = useTimerStore((s) => s.startPomodoro);
  const dismiss = useTimerStore((s) => s.dismissPomodoroFinished);
  const completeTask = useFlowStore((s) => s.completeTask);
  const closePopOut = usePopOutStore((s) => s.close);
  const task = useTaskById(finishedTaskId ?? "");
  const loggedSeconds = useTaskLoggedSeconds(finishedTaskId ?? "", entryRevision);
  const [customMins, setCustomMins] = useState("");

  if (!finishedTaskId || !finishedFlowDate) return null;
  const isMiscTask = isMiscTaskId(finishedTaskId);

  const presets = buildPomodoroPresets(
    task?.estimatedMins,
    Math.floor(loggedSeconds / 60)
  );

  const handleRestart = (mins: number) => {
    if (!Number.isFinite(mins) || mins <= 0) return;
    void startPomodoro(finishedTaskId, finishedFlowDate, mins * 60);
    setCustomMins("");
  };

  const submitCustom = () => {
    const mins = Number.parseInt(customMins, 10);
    if (!Number.isFinite(mins) || mins <= 0) return;
    handleRestart(mins);
  };

  const handleComplete = () => {
    if (!isMiscTask) {
      completeTask(finishedTaskId, finishedFlowDate);
    } else {
      closePopOut();
    }
    dismiss();
  };

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden p-3.5 text-foreground"
      style={PIP_SURFACE_STYLE}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-green-500/75" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_24px_-18px_oklch(0_0_0/0.8)]">
            <Check className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase text-muted-foreground">
              Pomodoro done
            </div>
            <div
              className="truncate text-sm font-semibold leading-tight text-foreground"
              title={task?.title ?? ""}
            >
              {isMiscTask ? MISC_TASK_TITLE : task?.title ?? "Task"}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (isMiscTask) {
              closePopOut();
            }
            dismiss();
          }}
          title="Dismiss"
          aria-label="Dismiss"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 pt-1">
        {presets.map((preset) => (
          <button
            key={preset.mins}
            data-testid="pomodoro-finished-preset"
            data-mins={preset.mins}
            data-suggested={preset.suggested ? "true" : undefined}
            onClick={() => handleRestart(preset.mins)}
            title={
              preset.suggested
                ? `Restart · matches remaining estimate (${preset.label})`
                : `Restart ${preset.label}`
            }
            className={cn(
              "rounded-md border px-1.5 py-1.5 text-xs font-medium shadow-[0_1px_2px_oklch(0_0_0/0.04)] transition-colors",
              preset.suggested
                ? "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <form
        className="flex items-center gap-1.5 border-t border-border/60 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          submitCustom();
        }}
      >
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={600}
          value={customMins}
          onChange={(e) => setCustomMins(e.target.value)}
          placeholder="Custom"
          data-testid="pomodoro-finished-custom-input"
          aria-label="Custom Pomodoro minutes"
          className="h-7 w-20 rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-xs text-muted-foreground">min</span>
        <button
          type="submit"
          data-testid="pomodoro-finished-custom-start"
          disabled={!customMins || Number.parseInt(customMins, 10) <= 0}
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          title="Start custom Pomodoro"
          aria-label="Start custom Pomodoro"
        >
          <Play className="h-3 w-3" />
        </button>
      </form>

      <button
        onClick={handleComplete}
        className="mt-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-green-500/20 bg-green-500/10 px-3 text-xs font-medium text-green-700 transition-colors hover:bg-green-500/20 dark:text-green-300"
      >
        <Check className="h-3 w-3" />
        {isMiscTask ? "Done" : "Complete & next"}
      </button>
    </div>
  );
}
