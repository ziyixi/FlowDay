"use client";

import { useState, useRef, useEffect } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { formatDuration } from "@/lib/utils/time";
import { useTodoistStore } from "@/lib/stores/todoist-store";
import type { Task } from "@/lib/types/task";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "30m", mins: 30 },
  { label: "45m", mins: 45 },
  { label: "1h", mins: 60 },
  { label: "1.5h", mins: 90 },
  { label: "2h", mins: 120 },
  { label: "2.5h", mins: 150 },
  { label: "3h", mins: 180 },
];

interface EstimateEditorProps {
  task: Task;
  variant: "inline" | "flow";
}

export function EstimateEditor({ task, variant }: EstimateEditorProps) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const updateEstimate = useTodoistStore((s) => s.updateEstimate);

  useEffect(() => {
    if (open) {
      setCustomValue(task.estimatedMins?.toString() ?? "");
    }
  }, [open, task.estimatedMins]);

  const commit = (mins: number | null) => {
    if (mins !== task.estimatedMins) {
      updateEstimate(task.id, mins);
    }
    setOpen(false);
  };

  const commitCustom = () => {
    const trimmed = customValue.trim();
    if (trimmed === "") {
      commit(null);
      return;
    }
    const mins = parseInt(trimmed, 10);
    if (isNaN(mins) || mins < 0) return;
    commit(mins);
  };

  const displayText =
    task.estimatedMins != null && task.estimatedMins > 0
      ? variant === "flow"
        ? `${formatDuration(task.estimatedMins)} est`
        : formatDuration(task.estimatedMins)
      : variant === "flow"
        ? "— est"
        : "—";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<button />}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "tabular-nums transition-colors cursor-pointer hover:text-foreground",
          variant === "inline" && "mt-0.5 shrink-0 text-xs text-muted-foreground",
          variant === "flow" && "text-muted-foreground"
        )}
        title="Click to edit estimate"
      >
        {displayText}
      </PopoverTrigger>
      <PopoverContent
        side={variant === "inline" ? "bottom" : "top"}
        align="start"
        className="w-auto p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-4 gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.mins}
              onClick={() => commit(p.mins)}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                task.estimatedMins === p.mins
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => commit(null)}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium bg-muted text-muted-foreground hover:bg-red-500/20 hover:text-red-600 transition-colors"
          >
            Clear
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="number"
            min="0"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitCustom();
              if (e.key === "Escape") setOpen(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-16 rounded border border-border bg-background px-2 py-1 text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
            placeholder="mins"
          />
          <span className="text-[10px] text-muted-foreground">min</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
