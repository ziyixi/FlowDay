"use client";

import { useEffect, useMemo, useState } from "react";
import { format, addDays } from "date-fns";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { DayFlow } from "@/components/flow/day-flow";
import { TaskCardOverlay } from "@/components/todoist/task-card-overlay";
import { IdlePermissionPrompt } from "@/components/shared/idle-permission-prompt";
import { useFlowStore } from "@/lib/stores/flow-store";
import { useHydration } from "@/lib/hooks/use-hydration";
import { useAutoSync } from "@/lib/hooks/use-auto-sync";
import { useAutoIdlePause } from "@/lib/hooks/use-auto-idle-pause";
import { useTimerStore } from "@/lib/stores/timer-store";
import { usePopOutStore } from "@/lib/stores/pop-out-store";
import { _getChimeCount, _resetChime } from "@/lib/utils/chime";
import type { Task } from "@/lib/types/task";

declare global {
  interface Window {
    __FLOWDAY_E2E__?: {
      setRunningTimerElapsed: (seconds: number) => void;
      getTimerState: () => {
        activeTaskId: string | null;
        status: "idle" | "running" | "paused";
        timerMode: "countup" | "pomodoro";
        displaySeconds: number;
        pomodoroFinishedTaskId: string | null;
      };
      getChimeCount: () => number;
      resetChimeCount: () => void;
      simulateIdleAway: (secondsAgo: number) => void;
      primeFakePopOutWindow: () => void;
      getPopOutState: () => {
        isOpen: boolean;
        fakeClosed: boolean;
      };
    };
  }
}

export function AppShell({ e2eEnabled = false }: { e2eEnabled?: boolean }) {
  useHydration();
  useAutoSync();
  useAutoIdlePause();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const currentDateStr = useFlowStore((s) => s.currentDate);
  const viewMode = useFlowStore((s) => s.viewMode);

  useEffect(() => {
    if (!e2eEnabled || typeof window === "undefined") return;
    let fakePopOutClosed = false;

    window.__FLOWDAY_E2E__ = {
      setRunningTimerElapsed: (seconds: number) => {
        const state = useTimerStore.getState();
        if (state.status !== "running" || state.segmentStartedAt == null) {
          throw new Error("No running timer available for E2E time control");
        }

        useTimerStore.setState({
          segmentStartedAt: Date.now() - seconds * 1000,
        });
        useTimerStore.getState().tick();
      },
      getTimerState: () => {
        const state = useTimerStore.getState();
        return {
          activeTaskId: state.activeTaskId,
          status: state.status,
          timerMode: state.timerMode,
          displaySeconds: state.displaySeconds,
          pomodoroFinishedTaskId: state.pomodoroFinishedTaskId,
        };
      },
      getChimeCount: () => _getChimeCount(),
      resetChimeCount: () => _resetChime(),
      simulateIdleAway: (secondsAgo: number) => {
        const state = useTimerStore.getState();
        if (state.status !== "running") {
          throw new Error("No running timer to backdate");
        }
        void state.pauseTimer(Date.now() - secondsAgo * 1000);
      },
      primeFakePopOutWindow: () => {
        fakePopOutClosed = false;
        const fakeDocument = {
          visibilityState: "visible",
          addEventListener() {},
          removeEventListener() {},
          documentElement: {
            classList: {
              toggle() {},
            },
          },
        };
        usePopOutStore.setState({
          pipWindow: {
            document: fakeDocument,
            close() {
              fakePopOutClosed = true;
            },
          } as unknown as Window,
          container: null,
        });
      },
      getPopOutState: () => {
        const state = usePopOutStore.getState();
        return {
          isOpen: Boolean(state.pipWindow),
          fakeClosed: fakePopOutClosed,
        };
      },
    };

    return () => {
      usePopOutStore.getState().close();
      delete window.__FLOWDAY_E2E__;
    };
  }, [e2eEnabled]);

  const dates = useMemo(() => {
    const base = new Date(currentDateStr + "T00:00:00");
    return Array.from({ length: viewMode }, (_, i) =>
      format(addDays(base, i), "yyyy-MM-dd")
    );
  }, [currentDateStr, viewMode]);

  return (
    <DragDropProvider
      key={sidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}
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
              <div className="flex flex-1 divide-x divide-border overflow-hidden">
                {dates.map((date) => (
                  <div
                    key={date}
                    data-testid="day-column"
                    data-date={date}
                    className="flex flex-1 flex-col overflow-hidden min-w-0"
                  >
                    <div className="shrink-0 border-b border-border px-3 py-2 text-center">
                      <p className="text-sm font-medium text-muted-foreground sm:text-xs">
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
