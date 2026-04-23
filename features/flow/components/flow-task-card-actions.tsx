"use client";

import { Check, ChevronsDown, Pause, Play, StickyNote, X } from "lucide-react";
import { PomodoroPicker } from "@/components/timer/pomodoro-picker";
import { ManualEntry } from "@/features/timer/components/manual-entry";
import { cn } from "@/lib/utils";

interface FlowTaskCardActionsProps {
  taskId: string;
  flowDate: string;
  estimatedMins: number | null;
  loggedSeconds: number;
  isActive: boolean;
  isRunning: boolean;
  showNote: boolean;
  hasNote: boolean;
  onToggleNote: () => void;
  onEntriesChanged: () => void;
  onPlayPause: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onRemove: () => void;
}

export function FlowTaskCardActions({
  taskId,
  flowDate,
  estimatedMins,
  loggedSeconds,
  isActive,
  isRunning,
  showNote,
  hasNote,
  onToggleNote,
  onEntriesChanged,
  onPlayPause,
  onComplete,
  onSkip,
  onRemove,
}: FlowTaskCardActionsProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          "h-8 w-8 sm:h-7 sm:w-7",
          isActive
            ? "text-primary hover:bg-primary/10"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        onClick={onPlayPause}
        aria-label={isRunning ? "Pause timer" : isActive ? "Resume timer" : "Start timer"}
      >
        {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <PomodoroPicker
        taskId={taskId}
        flowDate={flowDate}
        estimatedMins={estimatedMins}
        loggedMins={Math.floor(loggedSeconds / 60)}
      />
      <ManualEntry
        taskId={taskId}
        flowDate={flowDate}
        onEntriesChanged={onEntriesChanged}
      />
      <button
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
          "h-8 w-8 sm:h-7 sm:w-7",
          showNote || hasNote
            ? "text-primary hover:bg-primary/10"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        onClick={onToggleNote}
        title="Toggle notes"
        aria-label="Toggle notes"
      >
        <StickyNote className="h-3.5 w-3.5" />
      </button>
      <button
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-green-500/20 hover:text-green-600 sm:h-7 sm:w-7"
        onClick={onComplete}
        aria-label="Complete task"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-7 sm:w-7"
        onClick={onSkip}
        aria-label="Skip task"
      >
        <ChevronsDown className="h-3.5 w-3.5" />
      </button>
      <button
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/20 hover:text-red-600 sm:h-7 sm:w-7"
        onClick={onRemove}
        title="Return to pool"
        aria-label="Return to pool"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
