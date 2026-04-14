"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useDroppable } from "@dnd-kit/react";
import { Check, RotateCcw, Sunrise, StickyNote } from "lucide-react";
import { useFlowTasksForDate, useCompletedTasksForDate, useFlowStore } from "@/lib/stores/flow-store";
import { PRIORITY_CONFIG } from "@/lib/types/task";
import { formatDuration, formatElapsed } from "@/lib/utils/time";
import { FlowTaskCard } from "./flow-task-card";
import { ProgressBar } from "./progress-bar";
import { RolloverPrompt } from "./rollover-prompt";
import { PlanningWizard } from "./planning-wizard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";

interface DayFlowProps {
  date: string;
  readOnly?: boolean;
}

export function DayFlow({ date, readOnly = false }: DayFlowProps) {
  const flowTasks = useFlowTasksForDate(date);
  const completedTasks = useCompletedTasksForDate(date);
  const isEmpty = flowTasks.length === 0 && completedTasks.length === 0;

  if (readOnly) {
    return <ReadOnlyDayFlow flowTasks={flowTasks} completedTasks={completedTasks} date={date} />;
  }

  return <EditableDayFlow flowTasks={flowTasks} completedTasks={completedTasks} date={date} isEmpty={isEmpty} />;
}

// --- Read-only view for multi-day mode ---

function ReadOnlyDayFlow({ flowTasks, completedTasks, date }: { flowTasks: Task[]; completedTasks: Task[]; date: string }) {
  if (flowTasks.length === 0 && completedTasks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-xs text-muted-foreground/60">No tasks</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <div className="space-y-1.5">
          {flowTasks.map((task, index) => (
            <ReadOnlyTaskRow key={task.id} task={task} isNext={index === 0} date={date} />
          ))}
        </div>
        {completedTasks.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">
              Done ({completedTasks.length})
            </p>
            <div className="space-y-1">
              {completedTasks.map((task) => (
                <ReadOnlyCompletedRow key={task.id} task={task} date={date} />
              ))}
            </div>
          </div>
        )}
      </div>
      <ProgressBar date={date} />
    </div>
  );
}

function ReadOnlyTaskRow({ task, isNext, date }: { task: Task; isNext: boolean; date: string }) {
  const priorityColor = PRIORITY_CONFIG[task.priority].color;
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/notes?taskId=${encodeURIComponent(task.id)}&date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data?.content) setNoteText(data.content); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [task.id, date]);

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md border bg-card px-2.5 py-1.5 shadow-[0_1px_2px_oklch(0_0_0/0.04)]",
        isNext
          ? "border-l-4 border-l-primary border-t-border border-r-border border-b-border"
          : "border-border"
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", priorityColor)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{task.title}</p>
          {task.estimatedMins != null && task.estimatedMins > 0 && (
            <p className="text-[10px] tabular-nums text-muted-foreground">
              {formatDuration(task.estimatedMins)}
            </p>
          )}
        </div>
        {noteText && <StickyNote className="mt-1 h-2.5 w-2.5 shrink-0 text-primary/50" />}
      </div>
      {noteText && (
        <p className="ml-4 truncate text-[10px] text-muted-foreground/70">{noteText}</p>
      )}
    </div>
  );
}

function ReadOnlyCompletedRow({ task, date }: { task: Task; date: string }) {
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/notes?taskId=${encodeURIComponent(task.id)}&date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data?.content) setNoteText(data.content); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [task.id, date]);

  return (
    <div className="rounded-md bg-muted/30 px-2.5 py-1">
      <div className="flex items-center gap-2">
        <Check className="h-2.5 w-2.5 shrink-0 text-green-500" />
        <p className="truncate text-[11px] text-muted-foreground line-through decoration-muted-foreground/40">{task.title}</p>
        {noteText && <StickyNote className="h-2.5 w-2.5 shrink-0 text-primary/40" />}
      </div>
      {noteText && (
        <p className="ml-4 truncate text-[10px] text-muted-foreground/60">{noteText}</p>
      )}
    </div>
  );
}

// --- Editable view for single-day mode ---

function EditableDayFlow({
  flowTasks,
  completedTasks,
  date,
  isEmpty,
}: {
  flowTasks: Task[];
  completedTasks: Task[];
  date: string;
  isEmpty: boolean;
}) {
  const planningCompleted = useFlowStore((s) => s.planningCompletedDates[date]);
  const hydrated = useFlowStore((s) => s.hydrated);

  const isToday = date === format(new Date(), "yyyy-MM-dd");
  const autoShowWizard = hydrated && isEmpty && isToday && !planningCompleted;

  // Track user dismissals and manual opens separately from derived auto-show state.
  // Reset when date changes using React's "adjust state from props" pattern.
  const [dismissed, setDismissed] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [trackedDate, setTrackedDate] = useState(date);
  if (trackedDate !== date) {
    setTrackedDate(date);
    setDismissed(false);
    setManualOpen(false);
  }

  const showWizard = manualOpen || (autoShowWizard && !dismissed);
  const dismissWizard = () => { setDismissed(true); setManualOpen(false); };

  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `day-flow-${date}`,
    accept: "task-pool-card",
    data: { date },
  });

  if (showWizard) {
    return (
      <PlanningWizard
        date={date}
        onDismiss={dismissWizard}
        onComplete={dismissWizard}
      />
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col">
        <div
          ref={dropRef}
          className={cn(
            "flex flex-1 flex-col rounded-lg border-2 border-dashed m-4 transition-colors",
            isDropTarget ? "border-primary/40 bg-primary/5" : "border-transparent"
          )}
        >
          <div className="px-6 pt-4">
            <RolloverPrompt date={date} />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <h2 className="text-lg font-medium text-foreground/80">
                Your day flow will appear here
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag tasks from the sidebar to start planning your day
              </p>
              {isToday && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setManualOpen(true)}
                >
                  <Sunrise className="mr-2 h-4 w-4" />
                  Plan My Day
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div ref={dropRef} className="flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <RolloverPrompt date={date} />
        </div>
        <div className="mx-auto max-w-2xl space-y-2">
          {flowTasks.map((task, index) => (
            <FlowTaskCard
              key={task.id}
              task={task}
              index={index}
              isNext={index === 0}
              date={date}
            />
          ))}
        </div>

        {/* Bottom drop area — easier target for dropping at the end */}
        <div
          className={cn(
            "mx-auto mt-2 max-w-2xl rounded-lg border-2 border-dashed transition-all duration-200",
            isDropTarget
              ? "border-primary/40 bg-primary/5 py-8"
              : "border-transparent py-4"
          )}
        >
          {isDropTarget && (
            <p className="text-center text-xs text-primary/60">
              Drop here to add to end
            </p>
          )}
        </div>

        {completedTasks.length > 0 && (
          <div className="mx-auto mt-6 max-w-2xl">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Completed ({completedTasks.length})
            </p>
            <div className="space-y-1.5">
              {completedTasks.map((task) => (
                <CompletedTaskRow key={task.id} task={task} date={date} />
              ))}
            </div>
          </div>
        )}
      </div>
      <ProgressBar date={date} />
    </div>
  );
}

function CompletedTaskRow({ task, date }: { task: Task; date: string }) {
  const uncompleteTask = useFlowStore((s) => s.uncompleteTask);

  const [loggedSeconds, setLoggedSeconds] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entries?taskId=${encodeURIComponent(task.id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((entries: { durationS: number | null }[]) => {
        if (!cancelled) {
          setLoggedSeconds(entries.reduce((s, e) => s + (e.durationS ?? 0), 0));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [task.id]);

  const [noteText, setNoteText] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/notes?taskId=${encodeURIComponent(task.id)}&date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data?.content) setNoteText(data.content); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [task.id, date]);

  return (
    <div className="group rounded-md border border-border/50 bg-muted/30 px-4 py-2">
      <div className="flex items-center gap-2.5">
        <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
        <p className="flex-1 truncate text-sm text-muted-foreground line-through decoration-muted-foreground/40">
          {task.title}
        </p>
        <div className="flex items-center gap-2 shrink-0 text-xs tabular-nums text-muted-foreground/60">
          {task.estimatedMins != null && task.estimatedMins > 0 && (
            <span>{formatDuration(task.estimatedMins)} est</span>
          )}
          {loggedSeconds > 0 && (
            <span className="text-foreground/50">{formatElapsed(loggedSeconds)}</span>
          )}
        </div>
        <button
          onClick={() => uncompleteTask(task.id, date)}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>
      {noteText && (
        <p className="mt-1 ml-[18px] text-xs text-muted-foreground/60 line-clamp-2">
          {noteText}
        </p>
      )}
    </div>
  );
}
