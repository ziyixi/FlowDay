"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTaskSections } from "@/lib/stores/todoist-store";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";

export function TaskPool() {
  const { today, overdue, projects } = useTaskSections();

  const sortedProjectNames = Object.keys(projects).sort((a, b) =>
    a.localeCompare(b)
  );

  return (
    <div className="space-y-1">
      {overdue.length > 0 && (
        <TaskPoolSection
          title="Overdue"
          tasks={overdue}
          defaultOpen
          accentClass="text-destructive"
        />
      )}
      <TaskPoolSection title="Today" tasks={today} defaultOpen />
      {sortedProjectNames.map((name) => (
        <TaskPoolSection
          key={name}
          title={name}
          tasks={projects[name]}
          defaultOpen={false}
        />
      ))}
    </div>
  );
}

function TaskPoolSection({
  title,
  tasks,
  defaultOpen = false,
  accentClass,
}: {
  title: string;
  tasks: Task[];
  defaultOpen?: boolean;
  accentClass?: string;
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
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
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
