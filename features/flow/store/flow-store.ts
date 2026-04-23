import { create } from "zustand";
import { useTodoistStore } from "@/features/todoist/store/todoist-store";
import type { Task } from "@/lib/types/task";
import { jsonRequestInit } from "@/lib/client/http";
import type { FlowState } from "./types";
import {
  loadFlowState,
  loadHydrationData,
  persistFlowMutation,
  persistPlanningCompleted,
  todayStr,
} from "./persistence";

function flowForDate(state: FlowState, date: string): string[] {
  return state.flows[date] ?? [];
}

function completedForDate(state: FlowState, date: string): string[] {
  return state.completedTasks[date] ?? [];
}

function recoverFlowState() {
  void useFlowStore.getState().hydrate();
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
    persistPlanningCompleted(date);
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
      persistFlowMutation({ action: "setFlow", date, taskIds: ids }, recoverFlowState);
      return {
        flows: { ...state.flows, [date]: ids },
        sortableGen: nextGen,
        sortableKeys: { ...state.sortableKeys, [taskId]: nextGen },
      };
    }),

  removeTask: (taskId, date) =>
    set((state) => {
      const ids = flowForDate(state, date).filter((id) => id !== taskId);
      persistFlowMutation({ action: "setFlow", date, taskIds: ids }, recoverFlowState);
      return {
        flows: { ...state.flows, [date]: ids },
      };
    }),

  reorderTasks: (fromIndex, toIndex, date) =>
    set((state) => {
      const ids = [...flowForDate(state, date)];
      const [removed] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, removed);
      persistFlowMutation({ action: "setFlow", date, taskIds: ids }, recoverFlowState);
      return { flows: { ...state.flows, [date]: ids } };
    }),

  completeTask: (taskId, date) =>
    set((state) => {
      const flowIds = flowForDate(state, date).filter((id) => id !== taskId);
      persistFlowMutation({ action: "setFlow", date, taskIds: flowIds }, recoverFlowState);
      persistFlowMutation({ action: "addCompleted", date, taskId }, recoverFlowState);
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
      persistFlowMutation({ action: "setFlow", date, taskIds: flowIds }, recoverFlowState);
      persistFlowMutation(
        { action: "removeCompleted", date, taskId },
        recoverFlowState
      );
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
      persistFlowMutation(
        { action: "removeCompleted", date, taskId },
        recoverFlowState
      );
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
      persistFlowMutation({ action: "setFlow", date, taskIds: ids }, recoverFlowState);
      return { flows: { ...state.flows, [date]: ids } };
    }),

  rolloverTasks: async (fromDate, toDate) => {
    await fetch(
      "/api/flows",
      jsonRequestInit("PUT", {
        action: "rollover",
        date: fromDate,
        fromDate,
        toDate,
      })
    );
    const flowState = await loadFlowState();
    if (flowState) {
      set({
        flows: flowState.flows ?? {},
        completedTasks: flowState.completedTasks ?? {},
      });
    }
  },

  rolloverSelectedTasks: async (fromDate, toDate, taskIds) => {
    await fetch(
      "/api/flows",
      jsonRequestInit("PUT", {
        action: "rolloverSelected",
        date: fromDate,
        fromDate,
        toDate,
        taskIds,
      })
    );
    const flowState = await loadFlowState();
    if (flowState) {
      set({
        flows: flowState.flows ?? {},
        completedTasks: flowState.completedTasks ?? {},
      });
    }
  },

  hydrate: async () => {
    try {
      const today = todayStr();
      const { flowState, settings } = await loadHydrationData(today);
      if (flowState) {
        set({
          flows: flowState.flows ?? {},
          completedTasks: flowState.completedTasks ?? {},
        });
      }
      if (settings) {
        if (settings.day_capacity_mins != null) {
          set({ dayCapacityMins: settings.day_capacity_mins });
        }
        if (settings.planning_completed_today) {
          set((state) => ({
            planningCompletedDates: { ...state.planningCompletedDates, [today]: true },
          }));
        }
      }
    } catch {
      // Hydration failures should not block the app; the empty state is still usable.
    }
    set({ hydrated: true });
  },
}));

export function useCurrentFlowTaskIds(): string[] {
  const currentDate = useFlowStore((state) => state.currentDate);
  const flows = useFlowStore((state) => state.flows);
  return flows[currentDate] ?? [];
}

export function useCurrentCompletedTaskIds(): string[] {
  const currentDate = useFlowStore((state) => state.currentDate);
  const completedTasks = useFlowStore((state) => state.completedTasks);
  return completedTasks[currentDate] ?? [];
}

export function useFlowTasksForDate(date: string): Task[] {
  const flows = useFlowStore((state) => state.flows);
  const tasks = useTodoistStore((state) => state.tasks);
  const ids = flows[date] ?? [];

  return ids
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is Task => task != null);
}

export function useCompletedTasksForDate(date: string): Task[] {
  const completedTasks = useFlowStore((state) => state.completedTasks);
  const tasks = useTodoistStore((state) => state.tasks);
  const ids = completedTasks[date] ?? [];

  return ids
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is Task => task != null);
}
