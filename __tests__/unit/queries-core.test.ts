import { describe, it, expect } from "vitest";
import {
  getSetting,
  setSetting,
  getAllTasks,
  upsertTasks,
  softDeleteTask,
  restoreTask,
  getDeletedTasks,
  updateTaskEstimate,
  setFlowTaskIds,
  getAllFlows,
  addCompletedFlowTask,
  removeCompletedFlowTask,
  getAllCompletedFlowTasks,
} from "@/lib/db/queries";
import type { Task } from "@/lib/types/task";

describe("settings queries", () => {
  it("returns null for missing setting", () => {
    expect(getSetting("nonexistent")).toBeNull();
  });

  it("sets and gets a setting", () => {
    setSetting("day_capacity_mins", "480");
    expect(getSetting("day_capacity_mins")).toBe("480");
  });

  it("overwrites existing setting", () => {
    setSetting("key", "v1");
    setSetting("key", "v2");
    expect(getSetting("key")).toBe("v2");
  });
});

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t1",
    todoistId: null,
    title: "Test Task",
    description: null,
    projectName: null,
    projectColor: null,
    priority: 1,
    labels: [],
    estimatedMins: null,
    isCompleted: false,
    completedAt: null,
    dueDate: null,
    createdAt: null,
    syncedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe("task queries", () => {
  it("upserts and retrieves tasks", () => {
    upsertTasks([makeTask({ id: "t1", title: "Task 1" }), makeTask({ id: "t2", title: "Task 2" })]);
    const tasks = getAllTasks();
    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.title).sort()).toEqual(["Task 1", "Task 2"]);
  });

  it("updates existing task on upsert", () => {
    upsertTasks([makeTask({ id: "t1", title: "Original" })]);
    upsertTasks([makeTask({ id: "t1", title: "Updated" })]);
    const tasks = getAllTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Updated");
  });

  it("soft deletes and restores a task", () => {
    upsertTasks([makeTask({ id: "t1" })]);
    expect(softDeleteTask("t1")).toBe(true);

    // Not in regular tasks (filtered by deletedAt)
    const deleted = getDeletedTasks();
    expect(deleted).toHaveLength(1);
    expect(deleted[0].id).toBe("t1");

    expect(restoreTask("t1")).toBe(true);
    expect(getDeletedTasks()).toHaveLength(0);
    // Should be back in regular tasks
    expect(getAllTasks()).toHaveLength(1);
  });

  it("updates task estimate", () => {
    upsertTasks([makeTask({ id: "t1" })]);
    updateTaskEstimate("t1", 30);
    const tasks = getAllTasks();
    expect(tasks[0].estimatedMins).toBe(30);
  });

  it("clears task estimate with null", () => {
    upsertTasks([makeTask({ id: "t1", estimatedMins: 45 })]);
    updateTaskEstimate("t1", null);
    const tasks = getAllTasks();
    expect(tasks[0].estimatedMins).toBeNull();
  });
});

describe("flow queries", () => {
  it("sets and retrieves flow task ids", () => {
    setFlowTaskIds("2026-04-13", ["t1", "t2", "t3"]);
    const flows = getAllFlows();
    expect(flows["2026-04-13"]).toEqual(["t1", "t2", "t3"]);
  });

  it("replaces flow task ids", () => {
    setFlowTaskIds("2026-04-13", ["t1", "t2"]);
    setFlowTaskIds("2026-04-13", ["t3"]);
    const flows = getAllFlows();
    expect(flows["2026-04-13"]).toEqual(["t3"]);
  });

  it("handles multiple dates", () => {
    setFlowTaskIds("2026-04-13", ["t1"]);
    setFlowTaskIds("2026-04-14", ["t2"]);
    const flows = getAllFlows();
    expect(flows["2026-04-13"]).toEqual(["t1"]);
    expect(flows["2026-04-14"]).toEqual(["t2"]);
  });
});

describe("completed flow task queries", () => {
  it("adds and retrieves completed flow tasks", () => {
    addCompletedFlowTask("2026-04-13", "t1");
    addCompletedFlowTask("2026-04-13", "t2");
    const completed = getAllCompletedFlowTasks();
    expect(completed["2026-04-13"]?.sort()).toEqual(["t1", "t2"]);
  });

  it("removes a completed flow task", () => {
    addCompletedFlowTask("2026-04-13", "t1");
    addCompletedFlowTask("2026-04-13", "t2");
    removeCompletedFlowTask("2026-04-13", "t1");
    const completed = getAllCompletedFlowTasks();
    expect(completed["2026-04-13"]).toEqual(["t2"]);
  });

  it("handles duplicate add gracefully", () => {
    addCompletedFlowTask("2026-04-13", "t1");
    // Second add should not throw (ON CONFLICT)
    addCompletedFlowTask("2026-04-13", "t1");
    const completed = getAllCompletedFlowTasks();
    expect(completed["2026-04-13"]).toEqual(["t1"]);
  });
});
