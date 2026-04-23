"use client";

import { useCallback, useState } from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import type { Task } from "@/lib/types/task";
import { PRIORITY_CONFIG } from "@/lib/types/task";
import { formatElapsed } from "@/lib/utils/time";
import { derivePomodoroLoggedSeconds } from "@/lib/utils/pomodoro-progress";
import { useFlowStore } from "@/features/flow/store";
import { useTodoistStore } from "@/features/todoist/store";
import { useTimerStore } from "@/features/timer/store";
import { useTaskLoggedSeconds } from "@/lib/hooks/use-task-logged-seconds";
import { EstimateEditor } from "@/components/shared/estimate-editor";
import { EditableLocalTitle } from "@/components/shared/editable-local-title";
import { cn } from "@/lib/utils";
import { useTaskNote } from "../hooks/use-task-note";
import { FlowTaskCardActions } from "./flow-task-card-actions";

interface FlowTaskCardProps {
  task: Task;
  index: number;
  isNext: boolean;
  date: string;
}

export function FlowTaskCard({ task, index, isNext, date }: FlowTaskCardProps) {
  const completeTask = useFlowStore((state) => state.completeTask);
  const skipTask = useFlowStore((state) => state.skipTask);
  const removeTask = useFlowStore((state) => state.removeTask);
  const sortableKey = useFlowStore((state) => state.sortableKeys[task.id] ?? 0);
  const updateTitle = useTodoistStore((state) => state.updateTitle);

  const activeTaskId = useTimerStore((state) => state.activeTaskId);
  const timerStatus = useTimerStore((state) => state.status);
  const displaySeconds = useTimerStore((state) => state.displaySeconds);
  const timerMode = useTimerStore((state) => state.timerMode);
  const pomodoroTargetSeconds = useTimerStore((state) => state.pomodoroTargetSeconds);
  const priorSeconds = useTimerStore((state) => state.priorSeconds);
  const startTimer = useTimerStore((state) => state.startTimer);
  const pauseTimer = useTimerStore((state) => state.pauseTimer);
  const resumeTimer = useTimerStore((state) => state.resumeTimer);
  const stopAndSave = useTimerStore((state) => state.stopAndSave);
  const stopWithoutSaving = useTimerStore((state) => state.stopWithoutSaving);
  const entryRevision = useTimerStore((state) => state.entryRevision);

  const isActive = activeTaskId === task.id;
  const isRunning = isActive && timerStatus === "running";
  const isPaused = isActive && timerStatus === "paused";

  const [localRevision, setLocalRevision] = useState(0);
  const onEntriesChanged = useCallback(() => {
    setLocalRevision((revision) => revision + 1);
  }, []);
  const combinedRevision = localRevision + entryRevision;

  const loggedSeconds = useTaskLoggedSeconds(task.id, combinedRevision);
  const shownSeconds = isActive ? displaySeconds : loggedSeconds;
  const isActivePomodoro = isActive && timerMode === "pomodoro";
  const activePomodoroLoggedSeconds =
    isActivePomodoro && pomodoroTargetSeconds != null
      ? derivePomodoroLoggedSeconds(priorSeconds, pomodoroTargetSeconds, displaySeconds)
      : null;

  const { note, showNote, hasNote, updateNote, toggle: toggleNote } = useTaskNote(
    task.id,
    date
  );

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
      void pauseTimer();
    } else if (isPaused) {
      resumeTimer();
    } else {
      void startTimer(task.id, date);
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
      data-testid="flow-task-card"
      data-task-id={task.id}
      className={cn("relative cursor-grab active:cursor-grabbing", isDragSource && "opacity-50")}
    >
      <div
        className={cn(
          "pointer-events-none absolute -top-1.5 left-0 right-0 h-0.5 rounded-full transition-all duration-150",
          isDropTarget
            ? "scale-x-100 bg-primary opacity-100"
            : "scale-x-0 bg-transparent opacity-0"
        )}
      />

      <div
        className={cn(
          "group rounded-lg border bg-card px-4 py-3 shadow-[0_1px_2px_oklch(0_0_0/0.04)] transition-all",
          isNext
            ? "border-b-border border-l-4 border-l-primary border-r-border border-t-border"
            : "border-border",
          isActive &&
            "border-l-4 border-l-primary shadow-[0_0_12px_-3px_oklch(from_var(--color-primary)_l_c_h/0.35)]",
          isDropTarget && !isDragSource && "border-primary/40"
        )}
      >
        <div className="flex items-start gap-3">
          <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", priorityColor)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isNext && (
                <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wider text-primary sm:text-[10px]">
                  Next
                </span>
              )}
              <EditableLocalTitle
                title={task.title}
                isLocal={!task.todoistId}
                onCommit={(title) => updateTitle(task.id, title)}
              />
            </div>
            {task.projectName && (
              <p className="mt-0.5 truncate text-sm text-muted-foreground sm:text-xs">
                {task.projectName}
              </p>
            )}
            {task.labels.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {task.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground sm:text-[10px]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground sm:text-xs">
            <EstimateEditor task={task} variant="flow" />
            {shownSeconds > 0 ? (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "tabular-nums font-medium",
                    isActive ? "text-primary" : "text-foreground"
                  )}
                >
                  {isActivePomodoro
                    ? `${formatElapsed(shownSeconds)} left`
                    : formatElapsed(shownSeconds)}
                </span>
                {isActivePomodoro &&
                  activePomodoroLoggedSeconds != null &&
                  activePomodoroLoggedSeconds > 0 && (
                    <span className="tabular-nums text-muted-foreground">
                      {formatElapsed(activePomodoroLoggedSeconds)} logged
                    </span>
                  )}
              </div>
            ) : (
              <span className="tabular-nums text-muted-foreground/60">&mdash;</span>
            )}
          </div>

          <FlowTaskCardActions
            taskId={task.id}
            flowDate={date}
            estimatedMins={task.estimatedMins}
            loggedSeconds={loggedSeconds}
            isActive={isActive}
            isRunning={isRunning}
            showNote={showNote}
            hasNote={hasNote}
            onToggleNote={toggleNote}
            onEntriesChanged={onEntriesChanged}
            onPlayPause={handlePlayPause}
            onComplete={() => void handleComplete()}
            onSkip={() => skipTask(task.id, date)}
            onRemove={handleRemove}
          />
        </div>

        {showNote && (
          <div className="mt-2 border-t border-border/50 pt-2">
            <textarea
              value={note}
              onChange={(event) => updateNote(event.target.value)}
              onMouseDown={(event) => event.stopPropagation()}
              placeholder="Jot notes while working…"
              className="w-full resize-none rounded-md bg-muted/50 px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-primary/30 sm:text-xs"
              rows={2}
            />
          </div>
        )}
      </div>
    </div>
  );
}
