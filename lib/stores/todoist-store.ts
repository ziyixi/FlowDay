import { create } from "zustand";
import { format, isBefore, startOfDay } from "date-fns";
import type { Task } from "@/lib/types/task";
import { MOCK_TASKS } from "@/lib/data/mock-tasks";

interface TodoistState {
  tasks: Task[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setTasks: (tasks: Task[]) => void;
  removeTask: (taskId: string) => void;
}

export const useTodoistStore = create<TodoistState>()((set) => ({
  tasks: MOCK_TASKS,
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  setTasks: (tasks) => set({ tasks }),
  removeTask: (taskId) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== taskId) })),
}));

interface TaskSections {
  today: Task[];
  overdue: Task[];
  projects: Record<string, Task[]>;
}

export function useTaskSections(): TaskSections {
  const tasks = useTodoistStore((s) => s.tasks);
  const searchQuery = useTodoistStore((s) => s.searchQuery);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayStart = startOfDay(new Date());
  const query = searchQuery.toLowerCase().trim();

  const filtered = tasks.filter((t) => {
    if (t.isCompleted) return false;
    if (!query) return true;
    return (
      t.title.toLowerCase().includes(query) ||
      (t.projectName && t.projectName.toLowerCase().includes(query))
    );
  });

  const today: Task[] = [];
  const overdue: Task[] = [];
  const projectMap: Record<string, Task[]> = {};

  for (const task of filtered) {
    if (task.dueDate === todayStr) {
      today.push(task);
    } else if (task.dueDate && isBefore(new Date(task.dueDate), todayStart)) {
      overdue.push(task);
    } else {
      const key = task.projectName ?? "No Project";
      if (!projectMap[key]) projectMap[key] = [];
      projectMap[key].push(task);
    }
  }

  return { today, overdue, projects: projectMap };
}
