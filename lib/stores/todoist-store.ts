import { create } from "zustand";
import type { Task } from "@/lib/types/task";
import { useFlowStore } from "./flow-store";
import { useTimerStore } from "./timer-store";
import { formatLocalDate } from "@/lib/utils/time";
import { partitionTasksByDueDate } from "@/lib/utils/task-sections";

interface TodoistState {
  tasks: Task[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setTasks: (tasks: Task[]) => void;
  removeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => Promise<void>;
  updateEstimate: (taskId: string, estimatedMins: number | null) => void;
  updateTitle: (taskId: string, title: string) => void;
  hydrate: () => Promise<void>;
  sync: () => Promise<void>;
  addLocalTask: (title: string) => Promise<Task | null>;
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

  deleteTask: async (taskId) => {
    // Remove from client tasks
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== taskId) }));

    // Remove from all flows and completed flows
    const flowState = useFlowStore.getState();
    for (const [date, ids] of Object.entries(flowState.flows)) {
      if (ids.includes(taskId)) {
        flowState.removeTask(taskId, date);
      }
    }
    for (const [date, ids] of Object.entries(flowState.completedTasks)) {
      if (ids.includes(taskId)) {
        flowState.removeCompletedTask(taskId, date);
      }
    }

    // Stop timer if active for this task
    const timerState = useTimerStore.getState();
    if (timerState.activeTaskId === taskId) {
      timerState.stopWithoutSaving();
    }

    // Persist to server
    try {
      const res = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (!res.ok) {
        throw new Error("Failed to delete task");
      }
    } catch {
      // Recover server state if optimistic delete fails
      await Promise.all([
        get().hydrate(),
        useFlowStore.getState().hydrate(),
      ]);
    }
  },

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
    })
      .then((res) => {
        if (!res.ok) {
          void get().hydrate();
        }
      })
      .catch(() => {
        void get().hydrate();
      });
  },

  updateTitle: (taskId, title) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, title } : t
      ),
    }));
    fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, title }),
    })
      .then((res) => {
        if (!res.ok) {
          void get().hydrate();
        }
      })
      .catch(() => {
        void get().hydrate();
      });
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

  addLocalTask: async (title) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          dueDate: formatLocalDate(),
        }),
      });
      if (!res.ok) return null;
      const task: Task = await res.json();
      set((state) => ({ tasks: [...state.tasks, task] }));
      return task;
    } catch {
      return null;
    }
  },
}));

interface TaskSections {
  dueOnDate: Task[];
  overdue: Task[];
}

const EMPTY_IDS: string[] = [];

export function useTaskSections(date?: string): TaskSections {
  const tasks = useTodoistStore((s) => s.tasks);
  const searchQuery = useTodoistStore((s) => s.searchQuery);
  const currentDate = useFlowStore((s) => s.currentDate);
  const targetDate = date ?? currentDate;
  const flowTaskIds = useFlowStore((s) => s.flows[targetDate] ?? EMPTY_IDS);
  const completedTaskIds = useFlowStore(
    (s) => s.completedTasks[targetDate] ?? EMPTY_IDS
  );

  const query = searchQuery.toLowerCase().trim();
  const inFlow = new Set([...flowTaskIds, ...completedTaskIds]);

  const filtered = tasks.filter((t) => {
    if (t.deletedAt) return false;
    if (t.isCompleted) return false;
    if (inFlow.has(t.id)) return false;
    if (!query) return true;
    return (
      t.title.toLowerCase().includes(query) ||
      (t.projectName && t.projectName.toLowerCase().includes(query))
    );
  });

  return partitionTasksByDueDate(filtered, targetDate);
}

export function useTaskById(id: string): Task | undefined {
  return useTodoistStore((s) => s.tasks.find((t) => t.id === id));
}
