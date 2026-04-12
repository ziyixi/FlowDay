"use client";

import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";

export function AppShell() {
  return (
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
  );
}
