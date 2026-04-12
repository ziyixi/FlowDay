"use client";

import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { TaskCardOverlay } from "@/components/todoist/task-card-overlay";
import type { Task } from "@/lib/types/task";

export function AppShell() {
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        // TODO Session 3: handle drop into DayFlow
        // const target = event.operation.target;
      }}
    >
      <div className="flex h-screen flex-col">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex flex-1 flex-col overflow-y-auto bg-background">
            {/* Day Flow placeholder for Session 3 */}
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <h2 className="text-lg font-medium text-foreground/80">
                  Your day flow will appear here
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Drag tasks from the sidebar to start planning your day
                </p>
              </div>
            </div>
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
