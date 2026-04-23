"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useDroppable } from "@dnd-kit/react";
import { Check, RotateCcw, Sunrise } from "lucide-react";
import { useFlowStore } from "@/features/flow/store";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/flow/progress-bar";
import { PlanningWizard } from "@/features/flow/planning/planning-wizard";
import { FlowTaskCard } from "./flow-task-card";
import { useDayLoggedSecondsMap, useDayNotesMap } from "../hooks/use-day-flow-data";
import { cn } from "@/lib/utils";
import { formatDuration, formatElapsed } from "@/lib/utils/time";
import type { Task } from "@/lib/types/task";

export function EditableDayFlow({
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
  const planningCompleted = useFlowStore((state) => state.planningCompletedDates[date]);
  const hydrated = useFlowStore((state) => state.hydrated);
  const notesByTask = useDayNotesMap(date);
  const loggedByTask = useDayLoggedSecondsMap(date);

  const isToday = date === format(new Date(), "yyyy-MM-dd");
  const autoShowWizard = hydrated && isEmpty && isToday && !planningCompleted;

  const [dismissed, setDismissed] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [trackedDate, setTrackedDate] = useState(date);

  if (trackedDate !== date) {
    setTrackedDate(date);
    setDismissed(false);
    setWizardOpen(false);
  }

  if (autoShowWizard && !dismissed && !wizardOpen) {
    setWizardOpen(true);
  }

  const dismissWizard = () => {
    setDismissed(true);
    setWizardOpen(false);
  };

  const { ref: dropRef, isDropTarget } = useDroppable({
    id: `day-flow-${date}`,
    accept: "task-pool-card",
    data: { date },
  });

  if (wizardOpen) {
    return <PlanningWizard date={date} onDismiss={dismissWizard} onComplete={dismissWizard} />;
  }

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col">
        <div
          ref={dropRef}
          data-testid="day-flow-empty-state"
          className={cn(
            "m-4 flex flex-1 flex-col rounded-lg border-2 border-dashed transition-colors",
            isDropTarget ? "border-primary/40 bg-primary/5" : "border-transparent"
          )}
        >
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <h2 className="text-lg font-medium text-foreground/80">
                Your day flow will appear here
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag tasks from the sidebar to start planning your day
              </p>
              {isToday && (
                <Button variant="outline" className="mt-4" onClick={() => setWizardOpen(true)}>
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

        <div
          className={cn(
            "mx-auto mt-2 max-w-2xl rounded-lg border-2 border-dashed transition-all duration-200",
            isDropTarget
              ? "border-primary/40 bg-primary/5 py-8"
              : "border-transparent py-4"
          )}
        >
          {isDropTarget && (
            <p className="text-center text-sm text-primary/60 sm:text-xs">
              Drop here to add to end
            </p>
          )}
        </div>

        {completedTasks.length > 0 && (
          <div className="mx-auto mt-6 max-w-2xl">
            <p className="mb-2 text-sm font-medium text-muted-foreground sm:text-xs">
              Completed ({completedTasks.length})
            </p>
            <div className="space-y-1.5">
              {completedTasks.map((task) => (
                <CompletedTaskRow
                  key={task.id}
                  task={task}
                  date={date}
                  loggedSeconds={loggedByTask[task.id] ?? 0}
                  noteText={notesByTask[task.id] ?? ""}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <ProgressBar date={date} />
    </div>
  );
}

function CompletedTaskRow({
  task,
  date,
  loggedSeconds,
  noteText,
}: {
  task: Task;
  date: string;
  loggedSeconds: number;
  noteText: string;
}) {
  const uncompleteTask = useFlowStore((state) => state.uncompleteTask);

  return (
    <div
      data-testid="completed-task-row"
      className="group rounded-md border border-border/50 bg-muted/30 px-4 py-2"
    >
      <div className="flex items-center gap-2.5">
        <Check className="h-3.5 w-3.5 shrink-0 text-green-500" />
        <p className="flex-1 truncate text-sm text-muted-foreground line-through decoration-muted-foreground/40">
          {task.title}
        </p>
        <div className="flex shrink-0 items-center gap-2 text-sm tabular-nums text-muted-foreground/60 sm:text-xs">
          {task.estimatedMins != null && task.estimatedMins > 0 && (
            <span>{formatDuration(task.estimatedMins)} est</span>
          )}
          {loggedSeconds > 0 && <span className="text-foreground/50">{formatElapsed(loggedSeconds)}</span>}
        </div>
        <button
          onClick={() => uncompleteTask(task.id, date)}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 sm:h-6 sm:w-6"
          aria-label="Undo complete task"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>
      {noteText && (
        <p className="ml-[18px] mt-1 line-clamp-2 text-sm text-muted-foreground/60 sm:text-xs">
          {noteText}
        </p>
      )}
    </div>
  );
}
