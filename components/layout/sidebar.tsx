"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeft, Search, RefreshCw, Pause, Play } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTodoistStore } from "@/lib/stores/todoist-store";
import { useTaskById } from "@/lib/stores/todoist-store";
import { useTimerStore } from "@/lib/stores/timer-store";
import { formatElapsed } from "@/lib/utils/time";
import { TaskPool } from "@/components/todoist/task-pool";

function SidebarTimer() {
  const activeTaskId = useTimerStore((s) => s.activeTaskId);
  const status = useTimerStore((s) => s.status);
  const displaySeconds = useTimerStore((s) => s.displaySeconds);
  const pauseTimer = useTimerStore((s) => s.pauseTimer);
  const resumeTimer = useTimerStore((s) => s.resumeTimer);
  const task = useTaskById(activeTaskId ?? "");

  if (!activeTaskId || !task) return null;

  return (
    <div className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5">
      <div className="relative flex h-2 w-2 shrink-0">
        {status === "running" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/75" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            status === "running" ? "bg-primary" : "bg-muted-foreground"
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {task.title}
        </p>
      </div>
      <span className="shrink-0 tabular-nums text-xs font-semibold text-primary">
        {formatElapsed(displaySeconds)}
      </span>
      <button
        onClick={() => (status === "running" ? pauseTimer() : resumeTimer())}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
      >
        {status === "running" ? (
          <Pause className="h-3 w-3" />
        ) : (
          <Play className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const searchQuery = useTodoistStore((s) => s.searchQuery);
  const setSearchQuery = useTodoistStore((s) => s.setSearchQuery);
  const isSyncing = useTodoistStore((s) => s.isSyncing);
  const sync = useTodoistStore((s) => s.sync);

  return (
    <>
      {/* Expand button when collapsed */}
      {collapsed && (
        <div className="relative shrink-0">
          <Tooltip>
            <TooltipTrigger
              className="absolute left-1 top-1 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              onClick={() => setCollapsed(false)}
            >
              <PanelLeft className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        </div>
      )}

      <aside
        className={cn(
          "relative flex h-full shrink-0 flex-col border-r border-border bg-sidebar transition-all duration-200 ease-in-out",
          collapsed ? "w-0 overflow-hidden border-r-0" : "w-[280px]"
        )}
      >
        {/* Sidebar header */}
        <div className="flex h-10 items-center justify-between px-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Todoist
          </span>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={() => sync()}
              >
                <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
              </TooltipTrigger>
              <TooltipContent>Sync tasks</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                onClick={() => setCollapsed(true)}
              >
                <PanelLeftClose className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent>Collapse sidebar</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>

        {/* Active timer indicator */}
        <SidebarTimer />

        {/* Task pool */}
        <div className="flex-1 overflow-y-auto px-3 py-1">
          <TaskPool />
        </div>
      </aside>
    </>
  );
}
