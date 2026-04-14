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

export function TaskPool() {
  const { today, overdue } = useTaskSections();
  const currentDate = useFlowStore((s) => s.currentDate);
  const arrangedTasks = useFlowTasksForDate(currentDate);
  const completedTasks = useCompletedTasksForDate(currentDate);

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
}: {
  title: string;
  tasks: Task[];
  defaultOpen?: boolean;
  accentClass?: string;
  variant?: "pool" | "arranged" | "completed";
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
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
                  : tasks.map((task) => <CompletedRow key={task.id} task={task} />)}
            </div>
          ) : (
            <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground/60 mb-1">
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
      <p className="flex-1 truncate text-xs font-medium text-foreground">{task.title}</p>
      {task.estimatedMins != null && task.estimatedMins > 0 && (
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {formatDuration(task.estimatedMins)}
        </span>
      )}
    </div>
  );
}

function CompletedRow({ task }: { task: Task }) {
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

  return (
    <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 opacity-60">
      <Check className="h-3 w-3 shrink-0 text-green-500" />
      <p className="flex-1 truncate text-xs text-muted-foreground line-through">{task.title}</p>
      <div className="flex items-center gap-1.5 shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
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
