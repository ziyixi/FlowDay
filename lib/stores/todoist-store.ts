import { create } from "zustand";
import { format, isBefore, startOfDay } from "date-fns";
import type { Task } from "@/lib/types/task";
import { useCurrentFlowTaskIds, useCurrentCompletedTaskIds } from "./flow-store";

interface TodoistState {
  tasks: Task[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setTasks: (tasks: Task[]) => void;
  removeTask: (taskId: string) => void;
  updateEstimate: (taskId: string, estimatedMins: number | null) => void;
  hydrate: () => Promise<void>;
  sync: () => Promise<void>;
}

export const useTodoistStore = create<TodoistState>()((set, get) => ({
  tasks: [],
  isLoading: false,
  isSyncing: false,
  lastSyncAt: null,
  searchQuery: "",

  setSearchQuery: (query) => set({ searchQuery: query }),
  setTasks: (tasks) => set({ tasks }),
  removeTask: (taskId) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== taskId) })),

  updateEstimate: (taskId, estimatedMins) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, estimatedMins } : t
      ),
    }));
    fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, estimatedMins }),
    }).catch(() => {});
  },

  hydrate: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
      if (res.ok) {
        const tasks: Task[] = await res.json();
        set({ tasks });
      }
      // Also load last sync time
      const settingsRes = await fetch("/api/settings", { cache: "no-store" });
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        set({ lastSyncAt: settings.last_sync_at });
      }
    } catch {
      // Silently fail — tasks stay empty until sync
    } finally {
      set({ isLoading: false });
    }
  },

  sync: async () => {
    if (get().isSyncing) return;
    set({ isSyncing: true });
    try {
      const res = await fetch("/api/sync", { method: "POST", cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        set({ lastSyncAt: data.lastSyncAt });
      }
      // Reload tasks from DB
      await get().hydrate();
    } catch {
      // Silently fail
    } finally {
      set({ isSyncing: false });
    }
  },
}));

interface TaskSections {
  today: Task[];
  overdue: Task[];
}

export function useTaskSections(): TaskSections {
  const tasks = useTodoistStore((s) => s.tasks);
  const searchQuery = useTodoistStore((s) => s.searchQuery);
  const flowTaskIds = useCurrentFlowTaskIds();
  const completedTaskIds = useCurrentCompletedTaskIds();

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayStart = startOfDay(new Date());
  const query = searchQuery.toLowerCase().trim();
  const inFlow = new Set([...flowTaskIds, ...completedTaskIds]);

  const filtered = tasks.filter((t) => {
    if (t.isCompleted) return false;
    if (inFlow.has(t.id)) return false;
    if (!query) return true;
    return (
      t.title.toLowerCase().includes(query) ||
      (t.projectName && t.projectName.toLowerCase().includes(query))
    );
  });

  const today: Task[] = [];
  const overdue: Task[] = [];

  for (const task of filtered) {
    if (task.dueDate && isBefore(new Date(task.dueDate + "T00:00:00"), todayStart)) {
      overdue.push(task);
    } else {
      // API filter guarantees all tasks are today-or-overdue;
      // anything not strictly overdue belongs in today
      today.push(task);
    }
  }

  return { today, overdue };
}

export function useTaskById(id: string): Task | undefined {
  return useTodoistStore((s) => s.tasks.find((t) => t.id === id));
}
