"use client";

import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Monitor,
  Settings,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme-provider";
import { useState } from "react";

type ViewMode = 1 | 3 | 5;

function IconButton({
  onClick,
  children,
  tooltip,
  tooltipSide,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  tooltip: string;
  tooltipSide?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        onClick={onClick}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function TopBar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(1);
  const { theme, setTheme } = useTheme();

  const navigateDate = (direction: -1 | 1) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + direction);
      return next;
    });
  };

  const goToToday = () => setCurrentDate(new Date());

  const cycleTheme = () => {
    const order: Array<"light" | "dark" | "system"> = [
      "light",
      "dark",
      "system",
    ];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  const themeIcon =
    theme === "dark" ? (
      <Moon className="h-4 w-4" />
    ) : theme === "light" ? (
      <Sun className="h-4 w-4" />
    ) : (
      <Monitor className="h-4 w-4" />
    );

  const isToday =
    format(currentDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm">
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold tracking-tight">FlowDay</h1>
      </div>

      {/* Center: Date navigation + View toggle */}
      <div className="flex items-center gap-2">
        <IconButton onClick={() => navigateDate(-1)} tooltip="Previous day">
          <ChevronLeft className="h-4 w-4" />
        </IconButton>

        <button
          onClick={goToToday}
          className="min-w-[140px] text-center text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
        >
          {isToday ? "Today" : format(currentDate, "EEE, MMM d")}
          {!isToday && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              {format(currentDate, "yyyy")}
            </span>
          )}
        </button>

        <IconButton onClick={() => navigateDate(1)} tooltip="Next day">
          <ChevronRight className="h-4 w-4" />
        </IconButton>

        <div className="ml-3 flex items-center rounded-md border border-border bg-muted/50 p-0.5">
          {([1, 3, 5] as ViewMode[]).map((mode) => (
            <Toggle
              key={mode}
              pressed={viewMode === mode}
              onPressedChange={() => setViewMode(mode)}
              className="h-6 w-7 rounded-sm px-0 text-xs font-medium data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              {mode}
            </Toggle>
          ))}
        </div>
      </div>

      {/* Right: Theme toggle + Settings */}
      <div className="flex items-center gap-1">
        <IconButton onClick={cycleTheme} tooltip={`Theme: ${theme}`}>
          {themeIcon}
        </IconButton>

        <IconButton tooltip="Settings">
          <Settings className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  );
}
