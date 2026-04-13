"use client";

import { useMemo } from "react";
import { format, addDays } from "date-fns";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { DayFlow } from "@/components/flow/day-flow";
import { TaskCardOverlay } from "@/components/todoist/task-card-overlay";
import { useFlowStore } from "@/lib/stores/flow-store";
import type { Task } from "@/lib/types/task";

export function AppShell() {
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
      onDragEnd={(event) => {
        if (event.canceled) return;

        const { source, target } = event.operation;
        if (!source) return;

        if (isSortable(source)) {
          // Reorder within a day's flow
          const { initialIndex, index } = source;
          const date = (source.data as { date?: string })?.date;
          if (date && initialIndex !== index) {
            useFlowStore.getState().reorderTasks(initialIndex, index, date);
          }
        } else if (target) {
          // External drop from pool into a day flow
          const task = source.data?.task as Task | undefined;
          if (!task) return;

          // Extract date from target data
          let targetDate: string | undefined;
          let insertIndex: number | undefined;

          if (isSortable(target)) {
            targetDate = (target.data as { date?: string })?.date;
            insertIndex = target.index as number;
          } else {
            targetDate = (target.data as { date?: string })?.date;
          }

          if (targetDate) {
            useFlowStore.getState().addTask(task.id, targetDate, insertIndex);
          }
        }
      }}
    >
      <div className="flex h-screen flex-col">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex flex-1 overflow-hidden bg-background">
            {viewMode === 1 ? (
              <div className="flex flex-1 flex-col overflow-y-auto">
                <DayFlow date={dates[0]} />
              </div>
            ) : (
              <div className="flex flex-1 divide-x divide-border overflow-hidden">
                {dates.map((date) => (
                  <div key={date} className="flex flex-1 flex-col overflow-hidden min-w-0">
                    <div className="shrink-0 border-b border-border px-3 py-2 text-center">
                      <p className="text-xs font-medium text-muted-foreground">
                        {format(new Date(date + "T00:00:00"), "EEE")}
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        {format(new Date(date + "T00:00:00"), "MMM d")}
                      </p>
                    </div>
                    <div className="flex flex-1 flex-col overflow-y-auto">
                      <DayFlow date={date} readOnly />
                    </div>
                  </div>
                ))}
              </div>
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
