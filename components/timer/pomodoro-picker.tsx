"use client";

import { useState } from "react";
import { Hourglass } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTimerStore } from "@/lib/stores/timer-store";
import { usePopOutStore } from "@/lib/stores/pop-out-store";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "5m", mins: 5 },
  { label: "30m", mins: 30 },
  { label: "45m", mins: 45 },
  { label: "1h", mins: 60 },
  { label: "1h 30m", mins: 90 },
  { label: "2h", mins: 120 },
];

interface PomodoroPickerProps {
  taskId: string;
  flowDate: string;
}

export function PomodoroPicker({ taskId, flowDate }: PomodoroPickerProps) {
  const [open, setOpen] = useState(false);
  const startPomodoro = useTimerStore((s) => s.startPomodoro);
  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  const timerMode = useTimerStore((s) => s.timerMode);
  const pomodoroTargetSeconds = useTimerStore((s) => s.pomodoroTargetSeconds);
  const openPopOut = usePopOutStore((s) => s.open);

  const isActivePomodoro = activeTaskId === taskId && timerMode === "pomodoro";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<button />}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors sm:h-7 sm:w-7",
          isActivePomodoro
            ? "text-primary hover:bg-primary/10"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
        title="Start Pomodoro"
      >
        <Hourglass className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-auto p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
          Pomodoro
        </p>
        <div className="grid grid-cols-2 gap-1">
          {PRESETS.map((preset) => {
            const selected =
              isActivePomodoro && pomodoroTargetSeconds === preset.mins * 60;
            return (
              <button
                key={preset.mins}
                onClick={() => {
                  // Open pop-out FIRST (synchronous-ish call) so the user gesture
                  // is still active when documentPictureInPicture.requestWindow runs.
                  void openPopOut();
                  void startPomodoro(taskId, flowDate, preset.mins * 60);
                  setOpen(false);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
