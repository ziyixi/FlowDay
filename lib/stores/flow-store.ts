import { create } from "zustand";
import { format } from "date-fns";
import { useTodoistStore } from "./todoist-store";
import type { Task } from "@/lib/types/task";

export type ViewMode = 1 | 3 | 5;

interface FlowState {
  currentDate: string;
  viewMode: ViewMode;
  flows: Record<string, string[]>;
  completedTasks: Record<string, string[]>;
  // Monotonic counter to generate unique sortable ids (prevents stale dnd-kit state on re-add)
  sortableGen: number;
  // Maps taskId → generation number for unique sortable ids
  sortableKeys: Record<string, number>;
  setCurrentDate: (date: string) => void;
  setViewMode: (mode: ViewMode) => void;
  addTask: (taskId: string, date: string, index?: number) => void;
  removeTask: (taskId: string, date: string) => void;
  reorderTasks: (fromIndex: number, toIndex: number, date: string) => void;
  completeTask: (taskId: string, date: string) => void;
  uncompleteTask: (taskId: string, date: string) => void;
  removeCompletedTask: (taskId: string, date: string) => void;
  skipTask: (taskId: string, date: string) => void;
  rolloverTasks: (fromDate: string, toDate: string) => Promise<void>;
  rolloverSelectedTasks: (fromDate: string, toDate: string, taskIds: string[]) => Promise<void>;
  dayCapacityMins: number;
  setDayCapacityMins: (mins: number) => void;
  hydrated: boolean;
  planningCompletedDates: Record<string, boolean>;
  setPlanningCompleted: (date: string) => void;
  hydrate: () => Promise<void>;
}

function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

function flowForDate(state: FlowState, date: string): string[] {
  return state.flows[date] ?? [];
}

function completedForDate(state: FlowState, date: string): string[] {
  return state.completedTasks[date] ?? [];
}

// Fire-and-forget persistence helpers
function persistFlow(date: string, taskIds: string[]) {
  fetch("/api/flows", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "setFlow", date, taskIds }),
  }).catch(() => {});
}

function persistAddCompleted(date: string, taskId: string) {
  fetch("/api/flows", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addCompleted", date, taskId }),
  }).catch(() => {});
}

function persistRemoveCompleted(date: string, taskId: string) {
  fetch("/api/flows", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "removeCompleted", date, taskId }),
  }).catch(() => {});
}

export const useFlowStore = create<FlowState>()((set) => ({
  currentDate: todayStr(),
  viewMode: 1,
  flows: {},
  completedTasks: {},
  sortableGen: 0,
  sortableKeys: {},
  dayCapacityMins: 360,
  hydrated: false,
  planningCompletedDates: {},

  setCurrentDate: (date) => set({ currentDate: date }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setDayCapacityMins: (mins) => set({ dayCapacityMins: mins }),

  setPlanningCompleted: (date) => {
    set((state) => ({
      planningCompletedDates: { ...state.planningCompletedDates, [date]: true },
    }));
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planning_completed_date: date }),
    }).catch(() => {});
  },

  addTask: (taskId, date, index) =>
    set((state) => {
      const flow = flowForDate(state, date);
      if (flow.includes(taskId)) return state;
      const ids = [...flow];
      if (index != null) {
        ids.splice(index, 0, taskId);
      } else {
        ids.push(taskId);
      }
      const nextGen = state.sortableGen + 1;
      persistFlow(date, ids);
      return {
        flows: { ...state.flows, [date]: ids },
        sortableGen: nextGen,
        sortableKeys: { ...state.sortableKeys, [taskId]: nextGen },
      };
    }),

  removeTask: (taskId, date) =>
    set((state) => {
      const ids = flowForDate(state, date).filter((id) => id !== taskId);
      persistFlow(date, ids);
      return {
        flows: { ...state.flows, [date]: ids },
      };
    }),

  reorderTasks: (fromIndex, toIndex, date) =>
    set((state) => {
      const ids = [...flowForDate(state, date)];
      const [removed] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, removed);
      persistFlow(date, ids);
      return { flows: { ...state.flows, [date]: ids } };
    }),

  completeTask: (taskId, date) =>
    set((state) => {
      const flowIds = flowForDate(state, date).filter((id) => id !== taskId);
      persistFlow(date, flowIds);
      persistAddCompleted(date, taskId);
      return {
        flows: { ...state.flows, [date]: flowIds },
        completedTasks: {
          ...state.completedTasks,
          [date]: [...completedForDate(state, date), taskId],
        },
      };
    }),

  uncompleteTask: (taskId, date) =>
    set((state) => {
      const flowIds = [...flowForDate(state, date), taskId];
      persistFlow(date, flowIds);
      persistRemoveCompleted(date, taskId);
      return {
        flows: { ...state.flows, [date]: flowIds },
        completedTasks: {
          ...state.completedTasks,
          [date]: completedForDate(state, date).filter((id) => id !== taskId),
        },
      };
    }),

  removeCompletedTask: (taskId, date) =>
    set((state) => {
      persistRemoveCompleted(date, taskId);
      return {
        completedTasks: {
          ...state.completedTasks,
          [date]: completedForDate(state, date).filter((id) => id !== taskId),
        },
      };
    }),

  skipTask: (taskId, date) =>
    set((state) => {
      const ids = flowForDate(state, date).filter((id) => id !== taskId);
      ids.push(taskId);
      persistFlow(date, ids);
      return { flows: { ...state.flows, [date]: ids } };
    }),

  rolloverTasks: async (fromDate, toDate) => {
    // Call API to do the rollover in DB
    await fetch("/api/flows", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rollover", date: fromDate, fromDate, toDate }),
    });
    // Re-hydrate to get the updated state from DB
    const res = await fetch("/api/flows", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      set({
        flows: data.flows ?? {},
        completedTasks: data.completedTasks ?? {},
      });
    }
  },

  rolloverSelectedTasks: async (fromDate, toDate, taskIds) => {
    await fetch("/api/flows", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rolloverSelected", date: fromDate, fromDate, toDate, taskIds }),
    });
    const res = await fetch("/api/flows", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      set({
        flows: data.flows ?? {},
        completedTasks: data.completedTasks ?? {},
      });
    }
  },

  hydrate: async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const [flowRes, settingsRes] = await Promise.all([
        fetch("/api/flows", { cache: "no-store" }),
        fetch(`/api/settings?today=${encodeURIComponent(today)}`, { cache: "no-store" }),
      ]);
      if (flowRes.ok) {
        const data = await flowRes.json();
        set({
          flows: data.flows ?? {},
          completedTasks: data.completedTasks ?? {},
        });
      }
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings.day_capacity_mins != null) {
          set({ dayCapacityMins: settings.day_capacity_mins });
        }
        if (settings.planning_completed_today) {
          const today = format(new Date(), "yyyy-MM-dd");
          set((state) => ({
            planningCompletedDates: { ...state.planningCompletedDates, [today]: true },
          }));
        }
      }
    } catch {
      // Silently fail — use empty state
    }
    set({ hydrated: true });
  },
}));

// --- Hooks for current date (used by sidebar filtering) ---

export function useCurrentFlowTaskIds(): string[] {
  const currentDate = useFlowStore((s) => s.currentDate);
  const flows = useFlowStore((s) => s.flows);
  return flows[currentDate] ?? [];
}

export function useCurrentCompletedTaskIds(): string[] {
  const currentDate = useFlowStore((s) => s.currentDate);
  const completedTasks = useFlowStore((s) => s.completedTasks);
  return completedTasks[currentDate] ?? [];
}

// --- Hooks parameterized by date (used by DayFlow columns) ---

export function useFlowTasksForDate(date: string): Task[] {
  const flows = useFlowStore((s) => s.flows);
  const tasks = useTodoistStore((s) => s.tasks);
  const ids = flows[date] ?? [];

  return ids
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => t != null);
}

export function useCompletedTasksForDate(date: string): Task[] {
  const completedTasks = useFlowStore((s) => s.completedTasks);
  const tasks = useTodoistStore((s) => s.tasks);
  const ids = completedTasks[date] ?? [];

  return ids
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => t != null);
}
