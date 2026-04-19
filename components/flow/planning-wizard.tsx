"use client";

import { useState, useMemo } from "react";
import { format, subDays } from "date-fns";
import {
  Sunrise,
  Plus,
  Check,
  ArrowRight,
  AlertTriangle,
  X,
  Minus,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowStore, useFlowTasksForDate } from "@/lib/stores/flow-store";
import { useTodoistStore, useTaskSections } from "@/lib/stores/todoist-store";
import { PRIORITY_CONFIG } from "@/lib/types/task";
import { EstimateEditor } from "@/components/shared/estimate-editor";
import { formatDuration } from "@/lib/utils/time";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types/task";

interface PlanningWizardProps {
  date: string;
  onDismiss: () => void;
  onComplete: () => void;
}

export function PlanningWizard({ date, onDismiss, onComplete }: PlanningWizardProps) {
  const flows = useFlowStore((s) => s.flows);
  const completedTasks = useFlowStore((s) => s.completedTasks);
  const rolloverSelectedTasks = useFlowStore((s) => s.rolloverSelectedTasks);
  const setPlanningCompleted = useFlowStore((s) => s.setPlanningCompleted);
  const addTask = useFlowStore((s) => s.addTask);
  const removeTask = useFlowStore((s) => s.removeTask);
  const tasks = useTodoistStore((s) => s.tasks);
  const flowTasks = useFlowTasksForDate(date);
  const { today: todayTasks, overdue: overdueTasks } = useTaskSections();
  const capacityMins = useFlowStore((s) => s.dayCapacityMins);

  // Yesterday's incomplete tasks
  const yesterday = format(subDays(new Date(date + "T00:00:00"), 1), "yyyy-MM-dd");
  const yesterdayFlow = flows[yesterday] ?? [];
  const yesterdayCompleted = new Set(completedTasks[yesterday] ?? []);
  const incompleteIds = yesterdayFlow.filter((id) => !yesterdayCompleted.has(id));
  const incompleteTaskObjects = incompleteIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => t != null);
  const hasRollover = incompleteTaskObjects.length > 0;

  // Dynamic steps
  const steps = useMemo(() => {
    const s: { id: string; label: string }[] = [];
    if (hasRollover) s.push({ id: "rollover", label: "Roll Over" });
    s.push({ id: "add", label: "Add Tasks" });
    s.push({ id: "review", label: "Review" });
    s.push({ id: "confirm", label: "Ready" });
    return s;
  }, [hasRollover]);

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex];

  // Roll-over selection state
  const [selectedRollover, setSelectedRollover] = useState<Set<string>>(
    () => new Set(incompleteIds)
  );
  const [isRolling, setIsRolling] = useState(false);

  const handleDismiss = () => {
    setPlanningCompleted(date);
    onDismiss();
  };

  const handleNext = () => {
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
  };

  const handleBack = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const handleRollover = async () => {
    const selected = Array.from(selectedRollover);
    if (selected.length > 0) {
      setIsRolling(true);
      await rolloverSelectedTasks(yesterday, date, selected);
      setIsRolling(false);
    }
    handleNext();
  };

  const handleComplete = () => {
    setPlanningCompleted(date);
    onComplete();
  };

  const toggleRollover = (taskId: string) => {
    setSelectedRollover((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Capacity calculations
  const estimatedTotalMins = flowTasks.reduce(
    (sum, t) => sum + (t.estimatedMins ?? 0),
    0
  );
  const overCapacity = capacityMins > 0 && estimatedTotalMins > capacityMins;

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sunrise className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-foreground">
              Start Your Day
            </h2>
          </div>
          <button
            onClick={handleDismiss}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="mb-5 flex items-center gap-1">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1">
              {i > 0 && <div className="mx-1 h-px w-6 bg-border" />}
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium",
                  i < stepIndex
                    ? "text-primary"
                    : i === stepIndex
                      ? "text-foreground"
                      : "text-muted-foreground/40"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    i < stepIndex
                      ? "bg-primary text-primary-foreground"
                      : i === stepIndex
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground/60"
                  )}
                >
                  {i < stepIndex ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Step content card */}
        <div className="rounded-lg border border-border bg-card">
          {currentStep.id === "rollover" && (
            <StepRollover
              tasks={incompleteTaskObjects}
              selected={selectedRollover}
              onToggle={toggleRollover}
              onRollover={handleRollover}
              onSkip={handleNext}
              isRolling={isRolling}
            />
          )}
          {currentStep.id === "add" && (
            <StepAddTasks
              todayTasks={todayTasks}
              overdueTasks={overdueTasks}
              flowCount={flowTasks.length}
              onAdd={(id) => addTask(id, date)}
              onNext={handleNext}
              onBack={hasRollover ? handleBack : undefined}
            />
          )}
          {currentStep.id === "review" && (
            <StepReview
              tasks={flowTasks}
              onRemove={(id) => removeTask(id, date)}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
          {currentStep.id === "confirm" && (
            <StepConfirm
              taskCount={flowTasks.length}
              estimatedMins={estimatedTotalMins}
              capacityMins={capacityMins}
              overCapacity={overCapacity}
              onConfirm={handleComplete}
              onBack={handleBack}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Step 1: Roll Over ---

function StepRollover({
  tasks,
  selected,
  onToggle,
  onRollover,
  onSkip,
  isRolling,
}: {
  tasks: Task[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onRollover: () => void;
  onSkip: () => void;
  isRolling: boolean;
}) {
  return (
    <div className="p-5">
      <p className="text-sm font-medium text-foreground">
        You have {tasks.length} unfinished task{tasks.length !== 1 ? "s" : ""}{" "}
        from yesterday
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Select which tasks to carry forward to today.
      </p>
      <div className="mt-4 max-h-56 space-y-1.5 overflow-y-auto">
        {tasks.map((task) => {
          const checked = selected.has(task.id);
          const priorityColor = PRIORITY_CONFIG[task.priority].color;
          return (
            <label
              key={task.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 transition-colors hover:bg-accent/50"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(task.id)}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  priorityColor
                )}
              />
              <span className="flex-1 truncate text-sm text-foreground">
                {task.title}
              </span>
              {task.estimatedMins != null && task.estimatedMins > 0 && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDuration(task.estimatedMins)}
                </span>
              )}
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          onClick={onRollover}
          disabled={isRolling || selected.size === 0}
        >
          <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
          {isRolling
            ? "Rolling over…"
            : `Roll Over ${selected.size} Task${selected.size !== 1 ? "s" : ""}`}
        </Button>
        <Button size="sm" variant="ghost" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}

// --- Step 2: Add Tasks ---

function StepAddTasks({
  todayTasks,
  overdueTasks,
  flowCount,
  onAdd,
  onNext,
  onBack,
}: {
  todayTasks: Task[];
  overdueTasks: Task[];
  flowCount: number;
  onAdd: (id: string) => void;
  onNext: () => void;
  onBack?: () => void;
}) {
  const available = [...overdueTasks, ...todayTasks];

  return (
    <div className="p-5">
      <p className="text-sm font-medium text-foreground">
        Add tasks to your day
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Pick from your Todoist tasks, or skip to add later via drag &amp; drop.
      </p>
      {available.length > 0 ? (
        <div className="mt-4 max-h-64 space-y-1.5 overflow-y-auto">
          {available.map((task) => {
            const priorityColor = PRIORITY_CONFIG[task.priority].color;
            return (
              <div
                key={task.id}
                data-testid={`planning-add-row-${task.id}`}
                className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2"
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    priorityColor
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    {task.title}
                  </p>
                  {task.projectName && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {task.projectName}
                    </p>
                  )}
                </div>
                {task.estimatedMins != null && task.estimatedMins > 0 && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatDuration(task.estimatedMins)}
                  </span>
                )}
                <button
                  data-testid={`planning-add-task-${task.id}`}
                  onClick={() => onAdd(task.id)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary/10 transition-colors"
                  aria-label={`Add ${task.title}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 flex h-20 items-center justify-center rounded-md border border-dashed border-border/60">
          <p className="text-xs text-muted-foreground/60">
            {flowCount > 0
              ? "All available tasks added to flow"
              : "No tasks available — sync Todoist first"}
          </p>
        </div>
      )}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {flowCount} task{flowCount !== 1 ? "s" : ""} in flow
        </span>
        <div className="flex items-center gap-2">
          {onBack && (
            <Button size="sm" variant="ghost" onClick={onBack}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={onNext}>
            Continue
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- Step 3: Review ---

function StepReview({
  tasks,
  onRemove,
  onNext,
  onBack,
}: {
  tasks: Task[];
  onRemove: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="p-5">
      <p className="text-sm font-medium text-foreground">Review your plan</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Adjust estimates or remove tasks. You can reorder via drag &amp; drop
        after setup.
      </p>
      {tasks.length > 0 ? (
        <div className="mt-4 max-h-64 space-y-1.5 overflow-y-auto">
          {tasks.map((task, i) => {
            const priorityColor = PRIORITY_CONFIG[task.priority].color;
            return (
              <div
                key={task.id}
                className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2"
              >
                <span className="w-4 text-right text-xs tabular-nums text-muted-foreground/50">
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    priorityColor
                  )}
                />
                <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {task.title}
                </p>
                <EstimateEditor task={task} variant="inline" />
                <button
                  onClick={() => onRemove(task.id)}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-red-500/20 hover:text-red-600 transition-colors"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 flex h-20 items-center justify-center rounded-md border border-dashed border-border/60">
          <p className="text-xs text-muted-foreground/60">
            No tasks in flow yet
          </p>
        </div>
      )}
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button size="sm" onClick={onNext}>
          Continue
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// --- Step 4: Confirm ---

function StepConfirm({
  taskCount,
  estimatedMins,
  capacityMins,
  overCapacity,
  onConfirm,
  onBack,
}: {
  taskCount: number;
  estimatedMins: number;
  capacityMins: number;
  overCapacity: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const fraction =
    capacityMins > 0 ? Math.min(estimatedMins / capacityMins, 1) : 0;

  return (
    <div className="p-5">
      <p className="text-sm font-medium text-foreground">
        You&apos;re all set!
      </p>
      <div className="mt-4 space-y-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Tasks</span>
          <span className="font-medium text-foreground">{taskCount}</span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Estimated time</span>
          <span className="font-medium tabular-nums text-foreground">
            {estimatedMins > 0 ? `~${formatDuration(estimatedMins)}` : "—"}
          </span>
        </div>
        {capacityMins > 0 && (
          <>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Day capacity</span>
              <span className="tabular-nums text-muted-foreground">
                {formatDuration(capacityMins)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  overCapacity ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${Math.round(fraction * 100)}%` }}
              />
            </div>
          </>
        )}
        {overCapacity && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>
              You&apos;ve planned ~{formatDuration(estimatedMins)} for a{" "}
              {formatDuration(capacityMins)} day
            </span>
          </div>
        )}
        {!overCapacity && estimatedMins > 0 && capacityMins > 0 && (
          <p className="text-xs text-green-600 dark:text-green-400">
            Looks good — you have room in your day.
          </p>
        )}
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button size="sm" onClick={onConfirm}>
          <Sunrise className="mr-1.5 h-3.5 w-3.5" />
          Start My Day
        </Button>
      </div>
    </div>
  );
}
