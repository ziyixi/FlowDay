"use client";

import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/lib/stores/flow-store";
import { useTodoistStore } from "@/lib/stores/todoist-store";
import type { Task } from "@/lib/types/task";

interface RolloverPromptProps {
  date: string;
}

export function RolloverPrompt({ date }: RolloverPromptProps) {
  const flows = useFlowStore((s) => s.flows);
  const completedTasks = useFlowStore((s) => s.completedTasks);
  const rolloverTasks = useFlowStore((s) => s.rolloverTasks);
  const planningCompleted = useFlowStore((s) => s.planningCompletedDates[date]);
  const tasks = useTodoistStore((s) => s.tasks);

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [rolling, setRolling] = useState(false);

  // Check yesterday for incomplete tasks
  const yesterday = format(subDays(new Date(date + "T00:00:00"), 1), "yyyy-MM-dd");
  const yesterdayFlow = flows[yesterday] ?? [];
  const yesterdayCompleted = new Set(completedTasks[yesterday] ?? []);
  const incompleteTasks = yesterdayFlow.filter((id) => !yesterdayCompleted.has(id));

  // Resolve task objects
  const incompleteTaskObjects = incompleteTasks
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => t != null);

  // Don't show if planning completed, dismissed, no incomplete tasks, or already rolled over
  if (planningCompleted || dismissed.has(yesterday) || incompleteTaskObjects.length === 0) {
    return null;
  }

  async function handleRollover() {
    setRolling(true);
    await rolloverTasks(yesterday, date);
    setRolling(false);
    setDismissed((prev) => new Set(prev).add(yesterday));
  }

  function handleDismiss() {
    setDismissed((prev) => new Set(prev).add(yesterday));
  }

  return (
    <div className="mx-auto mb-3 max-w-2xl rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            You have {incompleteTaskObjects.length} unfinished task
            {incompleteTaskObjects.length !== 1 ? "s" : ""} from yesterday
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {incompleteTaskObjects.slice(0, 5).map((task) => (
              <li key={task.id} className="text-xs text-muted-foreground truncate">
                • {task.title}
              </li>
            ))}
            {incompleteTaskObjects.length > 5 && (
              <li className="text-xs text-muted-foreground/60">
                …and {incompleteTaskObjects.length - 5} more
              </li>
            )}
          </ul>
        </div>
        <button
          onClick={handleDismiss}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Button size="sm" onClick={handleRollover} disabled={rolling}>
          <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
          {rolling ? "Rolling over…" : "Roll over to today"}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
