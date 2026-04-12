"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeft, Search, RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

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
              <TooltipTrigger className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <RefreshCw className="h-3 w-3" />
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
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>

        {/* Task sections (placeholder for Session 2) */}
        <div className="flex-1 overflow-y-auto px-3 py-1">
          <TaskSection title="Today" count={0} />
          <TaskSection title="Overdue" count={0} />
          <TaskSection title="Projects" count={0} />
        </div>
      </aside>
    </>
  );
}

function TaskSection({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-3">
      <button className="flex w-full items-center justify-between py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        <span>{title}</span>
        <span className="tabular-nums">{count}</span>
      </button>
      <div className="space-y-1">
        <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground/60">
          No tasks
        </div>
      </div>
    </div>
  );
}
