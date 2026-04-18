"use client";

import { useState, useEffect } from "react";
import { ChevronRight, Check } from "lucide-react";
import { useTaskSections } from "@/lib/stores/todoist-store";
import { useFlowStore, useFlowTasksForDate, useCompletedTasksForDate } from "@/lib/stores/flow-store";
import { PRIORITY_CONFIG } from "@/lib/types/task";
import { formatDuration, formatElapsed } from "@/lib/utils/time";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";

interface EntryRow {
  taskId: string;
  durationS: number | null;
}

function useLoggedByTaskForDate(date: string): Record<string, number> {
  const [secondsByTask, setSecondsByTask] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entries?date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((entries: EntryRow[]) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        for (const entry of entries) {
          next[entry.taskId] = (next[entry.taskId] ?? 0) + (entry.durationS ?? 0);
        }
        setSecondsByTask(next);
      })
      .catch(() => {
        if (!cancelled) setSecondsByTask({});
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  return secondsByTask;
}

export function TaskPool() {
  const { today, overdue } = useTaskSections();
  const currentDate = useFlowStore((s) => s.currentDate);
  const arrangedTasks = useFlowTasksForDate(currentDate);
  const completedTasks = useCompletedTasksForDate(currentDate);
  const loggedByTask = useLoggedByTaskForDate(currentDate);

  return (
    <div className="space-y-1">
      {arrangedTasks.length > 0 && (
        <TaskPoolSection
          title="Arranged"
          tasks={arrangedTasks}
          defaultOpen
          accentClass="text-primary"
          variant="arranged"
        />
      )}
      {completedTasks.length > 0 && (
        <TaskPoolSection
          title="Completed"
          tasks={completedTasks}
          defaultOpen={false}
          accentClass="text-green-500"
          variant="completed"
          loggedByTask={loggedByTask}
        />
      )}
      {overdue.length > 0 && (
        <TaskPoolSection
          title="Overdue"
          tasks={overdue}
          defaultOpen
          accentClass="text-destructive"
        />
      )}
      <TaskPoolSection title="Today" tasks={today} defaultOpen />
    </div>
  );
}

function TaskPoolSection({
  title,
  tasks,
  defaultOpen = false,
  accentClass,
  variant = "pool",
  loggedByTask = {},
}: {
  title: string;
  tasks: Task[];
  defaultOpen?: boolean;
  accentClass?: string;
  variant?: "pool" | "arranged" | "completed";
  loggedByTask?: Record<string, number>;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 transition-transform duration-150",
            open && "rotate-90"
          )}
        />
        <span className={cn("flex-1 text-left", accentClass)}>{title}</span>
        <span className={cn("tabular-nums", accentClass)}>{tasks.length}</span>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-150",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          {tasks.length > 0 ? (
            <div className="space-y-1 pb-1">
              {variant === "pool"
                ? tasks.map((task) => <TaskCard key={task.id} task={task} />)
                : variant === "arranged"
                  ? tasks.map((task) => <ArrangedRow key={task.id} task={task} />)
                  : tasks.map((task) => (
                      <CompletedRow
                        key={task.id}
                        task={task}
                        loggedSeconds={loggedByTask[task.id] ?? 0}
                      />
                    ))}
            </div>
          ) : (
            <div className="mb-1 flex h-16 items-center justify-center rounded-md border border-dashed border-border/60 text-sm text-muted-foreground/60 sm:text-xs">
              No tasks
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArrangedRow({ task }: { task: Task }) {
  const priorityColor = PRIORITY_CONFIG[task.priority].color;

  return (
    <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", priorityColor)} />
      <p className="flex-1 truncate text-sm font-medium text-foreground sm:text-xs">{task.title}</p>
      {task.estimatedMins != null && task.estimatedMins > 0 && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground sm:text-[10px]">
          {formatDuration(task.estimatedMins)}
        </span>
      )}
    </div>
  );
}

function CompletedRow({ task, loggedSeconds }: { task: Task; loggedSeconds: number }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 opacity-60">
      <Check className="h-3 w-3 shrink-0 text-green-500" />
      <p className="flex-1 truncate text-sm text-muted-foreground line-through sm:text-xs">{task.title}</p>
      <div className="flex items-center gap-1.5 shrink-0 text-xs tabular-nums text-muted-foreground/60 sm:text-[10px]">
        {task.estimatedMins != null && task.estimatedMins > 0 && (
          <span>{formatDuration(task.estimatedMins)}</span>
        )}
        {loggedSeconds > 0 && (
          <span>{formatElapsed(loggedSeconds)}</span>
        )}
      </div>
    </div>
  );
}
