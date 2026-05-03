"use client";

import { useState } from "react";
import { format, addDays } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Monitor,
  Settings,
  BarChart3,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/components/theme-provider";
import { useFlowStore, type ViewMode } from "@/features/flow/store";
import { MiscTimeButton } from "@/components/timer/misc-time-button";
import { TimerDisplay } from "@/components/timer/timer-display";
import { PopOutTimerButton } from "@/components/timer/pop-out-timer";
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
import { AnalyticsDashboard } from "@/features/analytics/components/analytics-dashboard";

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
        className="fd-icon-button h-8 w-8 sm:h-7 sm:w-7"
        onClick={onClick}
        aria-label={tooltip}
        title={tooltip}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function TopBar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const currentDateStr = useFlowStore((s) => s.currentDate);
  const setCurrentDate = useFlowStore((s) => s.setCurrentDate);
  const viewMode = useFlowStore((s) => s.viewMode);
  const setViewMode = useFlowStore((s) => s.setViewMode);
  const currentDate = new Date(currentDateStr + "T00:00:00");
  const { theme, setTheme } = useTheme();

  const navigateDate = (direction: -1 | 1) => {
    setCurrentDate(format(addDays(currentDate, direction), "yyyy-MM-dd"));
  };

  const goToToday = () => setCurrentDate(format(new Date(), "yyyy-MM-dd"));

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
    <header className="fd-topbar flex h-12 shrink-0 items-center justify-between px-4 backdrop-blur-md">
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-foreground">FlowDay</h1>
      </div>

      {/* Center: Date navigation + View toggle */}
      <div className="flex items-center gap-2 rounded-md bg-background/25 p-0.5">
        <IconButton onClick={() => navigateDate(-1)} tooltip="Previous day">
          <ChevronLeft className="h-4 w-4" />
        </IconButton>

        <button
          onClick={goToToday}
          className="min-w-[148px] rounded-md px-2 py-1 text-center text-sm font-semibold text-foreground transition-colors hover:bg-accent/70"
        >
          {format(currentDate, "EEE, MMM d")}
          {!isToday && (
            <span className="ml-1.5 text-sm text-muted-foreground sm:text-xs">
              {format(currentDate, "yyyy")}
            </span>
          )}
        </button>

        <IconButton onClick={() => navigateDate(1)} tooltip="Next day">
          <ChevronRight className="h-4 w-4" />
        </IconButton>

        <div className="ml-1 w-[54px]">
          {!isToday && (
            <button
              onClick={goToToday}
              className="fd-control-cluster w-full px-2 py-0.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:text-xs"
            >
              Today
            </button>
          )}
        </div>

        <div className="fd-control-cluster ml-3 flex items-center p-0.5">
          {([1, 3, 5] as ViewMode[]).map((mode) => (
            <Toggle
              key={mode}
              pressed={viewMode === mode}
              onPressedChange={() => setViewMode(mode)}
              aria-label={`${mode}-day view`}
              title={`${mode}-day view`}
              className="h-7 w-8 rounded-sm px-0 text-sm font-medium text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm sm:h-6 sm:w-7 sm:text-xs"
            >
              {mode}
            </Toggle>
          ))}
        </div>
      </div>

      {/* Right: Timer + Theme toggle + Settings */}
      <div className="flex items-center gap-1.5">
        <MiscTimeButton />
        <TimerDisplay />
        <PopOutTimerButton />

        <IconButton onClick={() => setAnalyticsOpen(true)} tooltip="Analytics">
          <BarChart3 className="h-4 w-4" />
        </IconButton>

        <IconButton onClick={cycleTheme} tooltip={`Theme: ${theme}`}>
          {themeIcon}
        </IconButton>

        <IconButton onClick={() => setSettingsOpen(true)} tooltip="Settings">
          <Settings className="h-4 w-4" />
        </IconButton>

        <AnalyticsDashboard open={analyticsOpen} onOpenChange={setAnalyticsOpen} />
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    </header>
  );
}
