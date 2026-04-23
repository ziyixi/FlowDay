"use client";

import { useMemo, useState } from "react";
import { format, addDays } from "date-fns";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { DayFlow } from "@/features/flow/components/day-flow";
import { TaskCardOverlay } from "@/components/todoist/task-card-overlay";
import { IdlePermissionPrompt } from "@/components/shared/idle-permission-prompt";
import { useFlowStore } from "@/features/flow/store";
import { useHydration } from "@/lib/hooks/use-hydration";
import { useAutoSync } from "@/lib/hooks/use-auto-sync";
import { useAutoIdlePause } from "@/lib/hooks/use-auto-idle-pause";
import type { Task } from "@/lib/types/task";
import { MultiDayFlowColumns } from "@/features/layout/components/multi-day-flow-columns";
import { useFlowdayE2EBridge } from "@/features/layout/hooks/use-flowday-e2e-bridge";
import { handleAppDragEnd } from "@/features/layout/utils/handle-app-drag-end";

export function AppShell({ e2eEnabled = false }: { e2eEnabled?: boolean }) {
  useHydration();
  useAutoSync();
  useAutoIdlePause();
  useFlowdayE2EBridge(e2eEnabled);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const currentDateStr = useFlowStore((s) => s.currentDate);
  const viewMode = useFlowStore((s) => s.viewMode);

  const dates = useMemo(() => {
    const base = new Date(currentDateStr + "T00:00:00");
    return Array.from({ length: viewMode }, (_, i) =>
      format(addDays(base, i), "yyyy-MM-dd")
    );
  }, [currentDateStr, viewMode]);

  return (
    <DragDropProvider
      key={sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}
      onDragEnd={handleAppDragEnd}
    >
      <IdlePermissionPrompt />
      <div className="flex h-screen flex-col">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
          <main className="flex flex-1 overflow-hidden bg-background">
            {viewMode === 1 ? (
              <div className="flex flex-1 flex-col overflow-y-auto">
                <DayFlow date={dates[0]} />
              </div>
            ) : (
              <MultiDayFlowColumns dates={dates} />
            )}
          </main>
        </div>
      </div>
      <DragOverlay>
        {(source) => {
          const task = source?.data?.task as Task | undefined;
          if (!task) return null;
          return <TaskCardOverlay task={task} />;
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}
