import { fetchNoStore, jsonRequestInit } from "@/lib/client/http";
import { formatLocalDate } from "@/lib/utils/time";
import type { Task } from "@/lib/types/task";
import type { SettingsResponse } from "@/features/settings/contracts";
import type { SyncResponse } from "@/features/todoist/contracts";

export async function deleteTaskOnServer(taskId: string) {
  return fetch("/api/tasks", jsonRequestInit("DELETE", { taskId }));
}

export function persistTaskPatch(body: {
  taskId: string;
  estimatedMins?: number | null;
  title?: string;
}) {
  return fetch("/api/tasks", jsonRequestInit("PATCH", body));
}

export async function loadTasksAndSettings(): Promise<{
  tasks: Task[] | null;
  settings: SettingsResponse | null;
}> {
  const [tasksResponse, settingsResponse] = await Promise.all([
    fetchNoStore("/api/tasks"),
    fetchNoStore("/api/settings"),
  ]);

  const tasks = tasksResponse.ok ? ((await tasksResponse.json()) as Task[]) : null;
  const settings = settingsResponse.ok
    ? ((await settingsResponse.json()) as SettingsResponse)
    : null;

  return { tasks, settings };
}

export async function syncTasksOnServer(): Promise<SyncResponse | null> {
  const response = await fetch("/api/sync", {
    method: "POST",
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as SyncResponse;
}

export async function createLocalTaskOnServer(title: string): Promise<Task | null> {
  const response = await fetch(
    "/api/tasks",
    jsonRequestInit("POST", {
      title,
      dueDate: formatLocalDate(),
    })
  );
  if (!response.ok) return null;
  return (await response.json()) as Task;
}
