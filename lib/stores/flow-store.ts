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
  skipTask: (taskId: string, date: string) => void;
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

export const useFlowStore = create<FlowState>()((set) => ({
  currentDate: todayStr(),
  viewMode: 1,
  flows: {},
  completedTasks: {},
  sortableGen: 0,
  sortableKeys: {},

  setCurrentDate: (date) => set({ currentDate: date }),
  setViewMode: (mode) => set({ viewMode: mode }),

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
      return {
        flows: { ...state.flows, [date]: ids },
        sortableGen: nextGen,
        sortableKeys: { ...state.sortableKeys, [taskId]: nextGen },
      };
    }),

  removeTask: (taskId, date) =>
    set((state) => ({
      flows: {
        ...state.flows,
        [date]: flowForDate(state, date).filter((id) => id !== taskId),
      },
    })),

  reorderTasks: (fromIndex, toIndex, date) =>
    set((state) => {
      const ids = [...flowForDate(state, date)];
      const [removed] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, removed);
      return { flows: { ...state.flows, [date]: ids } };
    }),

  completeTask: (taskId, date) =>
    set((state) => ({
      flows: {
        ...state.flows,
        [date]: flowForDate(state, date).filter((id) => id !== taskId),
      },
      completedTasks: {
        ...state.completedTasks,
        [date]: [...completedForDate(state, date), taskId],
      },
    })),

  uncompleteTask: (taskId, date) =>
    set((state) => ({
      flows: {
        ...state.flows,
        [date]: [...flowForDate(state, date), taskId],
      },
      completedTasks: {
        ...state.completedTasks,
        [date]: completedForDate(state, date).filter((id) => id !== taskId),
      },
    })),

  skipTask: (taskId, date) =>
    set((state) => {
      const ids = flowForDate(state, date).filter((id) => id !== taskId);
      ids.push(taskId);
      return { flows: { ...state.flows, [date]: ids } };
    }),
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
