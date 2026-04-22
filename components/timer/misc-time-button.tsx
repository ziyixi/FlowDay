"use client";

import { useState } from "react";
import { Check, Clock3, Hourglass, Pause, Play } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTimerStore } from "@/lib/stores/timer-store";
import { usePopOutStore } from "@/lib/stores/pop-out-store";
import { buildPomodoroPresets } from "@/lib/utils/pomodoro-presets";
import { formatDuration, formatElapsed, formatLocalDate } from "@/lib/utils/time";
import { buildMiscTaskId, getMiscTaskDate, isMiscTaskId, MISC_TASK_TITLE } from "@/lib/utils/misc-task";
import { cn } from "@/lib/utils";

export function MiscTimeButton() {
  const [open, setOpen] = useState(false);
  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  const status = useTimerStore((s) => s.status);
  const timerMode = useTimerStore((s) => s.timerMode);
  const pomodoroTargetSeconds = useTimerStore((s) => s.pomodoroTargetSeconds);
  const displaySeconds = useTimerStore((s) => s.displaySeconds);
  const startTimer = useTimerStore((s) => s.startTimer);
  const startPomodoro = useTimerStore((s) => s.startPomodoro);
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const resumeTimer = useTimerStore((s) => s.resumeTimer);
  const stopAndSave = useTimerStore((s) => s.stopAndSave);
  const dismissPomodoroFinished = useTimerStore((s) => s.dismissPomodoroFinished);
  const pomodoroFinishedTaskId = useTimerStore((s) => s.pomodoroFinishedTaskId);
  const pomodoroFinishedFlowDate = useTimerStore((s) => s.pomodoroFinishedFlowDate);
  const openPopOut = usePopOutStore((s) => s.open);
  const closePopOut = usePopOutStore((s) => s.close);

  const presets = buildPomodoroPresets(null);
  const today = formatLocalDate();
  const todayMiscTaskId = buildMiscTaskId(today);
  const isActiveMisc = isMiscTaskId(activeTaskId);
  const isFinishedMisc = isMiscTaskId(pomodoroFinishedTaskId);
  const isPomodoro = isActiveMisc && timerMode === "pomodoro";
  const pomodoroLabel =
    pomodoroTargetSeconds != null
      ? formatDuration(Math.round(pomodoroTargetSeconds / 60))
      : null;

  const handleStartTimer = async () => {
    await startTimer(todayMiscTaskId, today);
    setOpen(false);
  };

  const handleStartPomodoro = async (mins: number) => {
    const flowDate = today;
    const taskId = buildMiscTaskId(flowDate);
    void openPopOut();
    await startPomodoro(taskId, flowDate, mins * 60);
    setOpen(false);
  };

  const handleSave = async () => {
    await stopAndSave();
    closePopOut();
    setOpen(false);
  };

  const handleRestartFinishedPomodoro = async (mins: number) => {
    const taskId = pomodoroFinishedTaskId;
    const flowDate =
      pomodoroFinishedFlowDate ?? getMiscTaskDate(pomodoroFinishedTaskId) ?? today;
    if (!taskId) return;
    dismissPomodoroFinished();
    void openPopOut();
    await startPomodoro(taskId, flowDate, mins * 60);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<button />}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium transition-colors sm:h-7 sm:px-2 sm:text-xs",
          isActiveMisc || isFinishedMisc
            ? "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        title="Track misc time"
        aria-label="Track misc time"
        data-testid="misc-time-trigger"
      >
        <Clock3 className="h-3.5 w-3.5" />
        <span>Misc</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        {isFinishedMisc ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pomodoro done
              </div>
              <div className="text-sm font-medium text-foreground">
                {MISC_TASK_TITLE}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1">
              {presets.map((preset) => (
                <button
                  key={preset.mins}
                  onClick={() => void handleRestartFinishedPomodoro(preset.mins)}
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
                onClick={() => {
                  dismissPomodoroFinished();
                  closePopOut();
                  setOpen(false);
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
              <Check className="h-3 w-3" />
              Done
            </button>
          </div>
        ) : isActiveMisc ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {status === "running" ? "Tracking" : "Paused"}
              </div>
              <div className="text-sm font-medium text-foreground">
                {MISC_TASK_TITLE}
              </div>
              <div className="text-sm font-semibold tabular-nums text-primary">
                {isPomodoro
                  ? `${formatElapsed(displaySeconds)} left`
                  : formatElapsed(displaySeconds)}
              </div>
              {isPomodoro && (
                <div className="text-xs text-muted-foreground">
                  Pomodoro{pomodoroLabel ? ` ${pomodoroLabel}` : ""}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => (status === "running" ? pauseTimer() : resumeTimer())}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                {status === "running" ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                {status === "running" ? "Pause" : "Resume"}
              </button>
              <button
                onClick={() => void handleSave()}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-green-500/20 hover:text-green-600"
              >
                <Check className="h-3 w-3" />
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium text-foreground">
                {MISC_TASK_TITLE}
              </div>
              <p className="text-xs text-muted-foreground">
                Track unplanned work without adding a flow task.
              </p>
            </div>

            <button
              onClick={() => void handleStartTimer()}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              data-testid="misc-start-timer"
            >
              <Play className="h-3 w-3" />
              Start timer
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 px-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Hourglass className="h-3 w-3" />
                Pomodoro
              </div>
              <div className="grid grid-cols-3 gap-1">
                {presets.map((preset) => (
                  <button
                    key={preset.mins}
                    onClick={() => void handleStartPomodoro(preset.mins)}
                    data-testid="misc-pomodoro-preset"
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
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
