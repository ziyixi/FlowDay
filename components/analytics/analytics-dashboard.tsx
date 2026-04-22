"use client";

import { useState, useEffect, useMemo } from "react";
import { format, addDays, addWeeks } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFlowStore } from "@/lib/stores/flow-store";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils/time";

interface AnalyticsDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// --- API response types ---

interface DailyTaskData {
  id: string;
  title: string;
  projectName: string | null;
  projectColor: string | null;
  estimatedMins: number | null;
  loggedMins: number;
  completed: boolean;
}

interface DailyData {
  date: string;
  tasksPlanned: number;
  tasksCompleted: number;
  totalEstimatedMins: number;
  totalLoggedMins: number;
  dayCapacityMins: number;
  tasks: DailyTaskData[];
  hourlyMins: number[];
}

interface WeeklyDayData {
  date: string;
  dayOfWeek: string;
  tasksPlanned: number;
  tasksCompleted: number;
  loggedMins: number;
}

interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  days: WeeklyDayData[];
  byProject: {
    projectName: string;
    projectColor: string | null;
    loggedMins: number;
    tasksCompleted: number;
  }[];
  stuckTasks: {
    id: string;
    title: string;
    daysAppeared: number;
    dates: string[];
  }[];
  estimationAccuracy: {
    id: string;
    title: string;
    estimatedMins: number;
    actualMins: number;
  }[];
  heatmap: number[][];
  totals: {
    tasksCompleted: number;
    totalLoggedMins: number;
    avgTasksPerDay: number;
    overallAccuracy: number | null;
  };
}

const TASK_BREAKDOWN_CHUNK_MINS = 30;
const TASK_BREAKDOWN_VISIBLE_CHUNKS = 8;
const TASK_BREAKDOWN_VISIBLE_MINS =
  TASK_BREAKDOWN_CHUNK_MINS * TASK_BREAKDOWN_VISIBLE_CHUNKS;
const TASK_BREAKDOWN_SCALE_LABEL = `${formatDuration(
  TASK_BREAKDOWN_CHUNK_MINS
)} chunks · capped at ${formatDuration(TASK_BREAKDOWN_VISIBLE_MINS)}`;
const TASK_BREAKDOWN_SEGMENTS = Array.from(
  { length: TASK_BREAKDOWN_VISIBLE_CHUNKS },
  (_, index) => index
);

function analyticsUrl(type: "daily" | "weekly" | "stats", date?: string) {
  const params = new URLSearchParams({ type });
  if (date) params.set("date", date);
  const timeZone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "";
  if (timeZone) params.set("tz", timeZone);
  return `/api/analytics?${params.toString()}`;
}

export function AnalyticsDashboard({
  open,
  onOpenChange,
}: AnalyticsDashboardProps) {
  const [tab, setTab] = useState<"daily" | "weekly" | "stats">("daily");
  const currentDate = useFlowStore((s) => s.currentDate);
  const [dailyDate, setDailyDate] = useState(currentDate);
  const [weeklyDate, setWeeklyDate] = useState(currentDate);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDailyDate(currentDate);
      setWeeklyDate(currentDate);
      setRefreshKey((k) => k + 1);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Analytics</DialogTitle>
        </DialogHeader>

        {/* Tab toggle */}
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted/50 p-0.5 w-fit shrink-0">
          <button
            onClick={() => setTab("daily")}
            className={cn(
              "rounded-sm px-3 py-1 text-sm font-medium transition-colors",
              tab === "daily"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Daily Review
          </button>
          <button
            onClick={() => setTab("weekly")}
            className={cn(
              "rounded-sm px-3 py-1 text-sm font-medium transition-colors",
              tab === "weekly"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Weekly Review
          </button>
          <button
            onClick={() => setTab("stats")}
            className={cn(
              "rounded-sm px-3 py-1 text-sm font-medium transition-colors",
              tab === "stats"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Work Patterns
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          {tab === "daily" ? (
            <DailyReview key={`daily-${refreshKey}`} date={dailyDate} onDateChange={setDailyDate} />
          ) : tab === "weekly" ? (
            <WeeklyReview key={`weekly-${refreshKey}`} date={weeklyDate} onDateChange={setWeeklyDate} />
          ) : (
            <StatsView key={`stats-${refreshKey}`} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ================================================
// Date navigation
// ================================================

function DateNav({
  label,
  onPrev,
  onNext,
  onToday,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={onToday}
        className="min-w-[180px] text-center text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
      >
        {label}
      </button>
      <button
        onClick={onNext}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ================================================
// Daily Review
// ================================================

function DailyReview({
  date,
  onDateChange,
}: {
  date: string;
  onDateChange: (d: string) => void;
}) {
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [prevDate, setPrevDate] = useState(date);

  if (prevDate !== date) {
    setPrevDate(date);
    setLoading(true);
    setData(null);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(analyticsUrl("daily", date), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  const dateLabel = format(new Date(date + "T00:00:00"), "EEEE, MMM d, yyyy");

  if (loading)
    return (
      <div className="space-y-4">
        <DateNav
          label={dateLabel}
          onPrev={() =>
            onDateChange(format(addDays(new Date(date + "T00:00:00"), -1), "yyyy-MM-dd"))
          }
          onNext={() =>
            onDateChange(format(addDays(new Date(date + "T00:00:00"), 1), "yyyy-MM-dd"))
          }
          onToday={() => onDateChange(format(new Date(), "yyyy-MM-dd"))}
        />
        <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
      </div>
    );

  if (!data)
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">No data</div>
    );

  const accuracy =
    data.totalEstimatedMins > 0 && data.totalLoggedMins > 0
      ? Math.round(
          (Math.min(data.totalEstimatedMins, data.totalLoggedMins) /
            Math.max(data.totalEstimatedMins, data.totalLoggedMins)) *
            100
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Date navigation */}
      <DateNav
        label={dateLabel}
        onPrev={() =>
          onDateChange(format(addDays(new Date(date + "T00:00:00"), -1), "yyyy-MM-dd"))
        }
        onNext={() =>
          onDateChange(format(addDays(new Date(date + "T00:00:00"), 1), "yyyy-MM-dd"))
        }
        onToday={() => onDateChange(format(new Date(), "yyyy-MM-dd"))}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Tasks"
          value={`${data.tasksCompleted}/${data.tasksPlanned}`}
        />
        <StatCard label="Logged" value={formatDuration(data.totalLoggedMins)} />
        <StatCard label="Estimated" value={formatDuration(data.totalEstimatedMins)} />
        <StatCard
          label="Accuracy"
          value={accuracy != null ? `${accuracy}%` : "—"}
        />
      </div>

      {/* Capacity bar */}
      {data.dayCapacityMins > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Capacity</span>
            <span>
              {formatDuration(data.totalLoggedMins)} / {formatDuration(data.dayCapacityMins)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                data.totalLoggedMins > data.dayCapacityMins
                  ? "bg-amber-500"
                  : "bg-primary"
              )}
              style={{
                width: `${Math.min(
                  (data.totalLoggedMins / data.dayCapacityMins) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Hourly activity */}
      {data.hourlyMins && (
        <HourlyChart hourlyMins={data.hourlyMins} title="Hourly Activity" />
      )}

      {/* Per-task breakdown */}
      {data.tasks.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">Task Breakdown</h3>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
              {TASK_BREAKDOWN_SCALE_LABEL}
            </span>
          </div>
          <div className="space-y-3">
            {data.tasks.map((task) => (
              <TaskBar key={task.id} task={task} />
            ))}
          </div>
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground/60">
          No tasks planned for this day
        </p>
      )}

      {/* Estimation table for daily view */}
      {data.tasks.filter((t) => t.estimatedMins && t.loggedMins > 0).length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium">Estimation vs Actual</h3>
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">
                    Task
                  </th>
                  <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">
                    Est.
                  </th>
                  <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">
                    Actual
                  </th>
                  <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">
                    Diff
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.tasks
                  .filter((t) => t.estimatedMins && t.loggedMins > 0)
                  .map((task) => {
                    const est = task.estimatedMins!;
                    const diff = task.loggedMins - est;
                    return (
                      <tr
                        key={task.id}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="max-w-[200px] truncate px-3 py-1.5">
                          {task.title}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {formatDuration(est)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatDuration(task.loggedMins)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-1.5 text-right tabular-nums font-medium",
                            diff > 0
                              ? "text-red-500"
                              : diff < 0
                                ? "text-green-500"
                                : "text-muted-foreground"
                          )}
                        >
                          {diff > 0 ? "+" : ""}
                          {formatDuration(Math.abs(diff))}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ================================================
// Weekly Review
// ================================================

function WeeklyReview({
  date,
  onDateChange,
}: {
  date: string;
  onDateChange: (d: string) => void;
}) {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [prevDate, setPrevDate] = useState(date);

  if (prevDate !== date) {
    setPrevDate(date);
    setLoading(true);
    setData(null);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(analyticsUrl("weekly", date), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  const weekLabel = useMemo(() => {
    if (!data) return format(new Date(date + "T00:00:00"), "MMM d, yyyy");
    return `${format(new Date(data.weekStart + "T00:00:00"), "MMM d")} – ${format(
      new Date(data.weekEnd + "T00:00:00"),
      "MMM d, yyyy"
    )}`;
  }, [data, date]);

  return (
    <div className="space-y-6">
      {/* Week navigation */}
      <DateNav
        label={weekLabel}
        onPrev={() =>
          onDateChange(
            format(addWeeks(new Date(date + "T00:00:00"), -1), "yyyy-MM-dd")
          )
        }
        onNext={() =>
          onDateChange(
            format(addWeeks(new Date(date + "T00:00:00"), 1), "yyyy-MM-dd")
          )
        }
        onToday={() => onDateChange(format(new Date(), "yyyy-MM-dd"))}
      />

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
      ) : !data ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No data</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Done"
              value={String(data.totals.tasksCompleted)}
              sub="tasks"
            />
            <StatCard
              label="Hours"
              value={formatDuration(data.totals.totalLoggedMins)}
            />
            <StatCard
              label="Avg/Day"
              value={String(data.totals.avgTasksPerDay)}
              sub="tasks"
            />
            <StatCard
              label="Accuracy"
              value={
                data.totals.overallAccuracy != null
                  ? `${data.totals.overallAccuracy}%`
                  : "—"
              }
            />
          </div>

          {/* Daily trend */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Daily Trend</h3>
            <div className="flex items-end gap-1.5" style={{ height: 128 }}>
              {data.days.map((day) => {
                const maxMins = Math.max(
                  ...data.days.map((d) => d.loggedMins),
                  1
                );
                const height = (day.loggedMins / maxMins) * 100;
                return (
                  <div
                    key={day.date}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <div
                      className="flex w-full flex-col justify-end"
                      style={{ height: 96 }}
                    >
                      {day.loggedMins > 0 ? (
                        <div
                          className="w-full rounded-t-sm bg-primary/80 transition-all"
                          style={{ height: `${height}%` }}
                          title={`${formatDuration(day.loggedMins)} logged`}
                        />
                      ) : (
                        <div
                          className="w-full rounded-t-sm bg-muted"
                          style={{ height: 2 }}
                        />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {day.dayOfWeek}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60">
                      {day.tasksCompleted > 0 ? `${day.tasksCompleted}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Work Time Heatmap */}
          {data.heatmap && <Heatmap heatmap={data.heatmap} />}

          {/* Time by Project */}
          {data.byProject.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium">Time by Project</h3>
              <div className="space-y-2.5">
                {data.byProject.map((project) => {
                  const maxMins = Math.max(
                    ...data.byProject.map((p) => p.loggedMins),
                    1
                  );
                  return (
                    <div key={project.projectName} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {project.projectColor && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{
                                backgroundColor: project.projectColor,
                              }}
                            />
                          )}
                          <span className="truncate">{project.projectName}</span>
                        </span>
                        <span className="shrink-0 ml-2 text-muted-foreground">
                          {formatDuration(project.loggedMins)} ·{" "}
                          {project.tasksCompleted} tasks
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(project.loggedMins / maxMins) * 100}%`,
                            backgroundColor:
                              project.projectColor ?? "var(--primary)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stuck Tasks */}
          {data.stuckTasks.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium">Stuck Tasks</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Tasks planned on multiple days but not completed
              </p>
              <div className="space-y-1.5">
                {data.stuckTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-md border border-border/50 px-3 py-1.5"
                  >
                    <span className="truncate text-sm">{task.title}</span>
                    <span className="ml-2 shrink-0 text-xs text-amber-500">
                      {task.daysAppeared} days
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Estimation Accuracy Table */}
          {data.estimationAccuracy.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-medium">Estimation Accuracy</h3>
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">
                        Task
                      </th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">
                        Est.
                      </th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">
                        Actual
                      </th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">
                        Acc.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.estimationAccuracy.map((item) => {
                      const acc = Math.round(
                        (Math.min(item.estimatedMins, item.actualMins) /
                          Math.max(item.estimatedMins, item.actualMins)) *
                          100
                      );
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="max-w-[200px] truncate px-3 py-1.5">
                            {item.title}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                            {formatDuration(item.estimatedMins)}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {formatDuration(item.actualMins)}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-1.5 text-right tabular-nums font-medium",
                              acc >= 80
                                ? "text-green-500"
                                : acc >= 50
                                  ? "text-amber-500"
                                  : "text-red-500"
                            )}
                          >
                            {acc}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ================================================
// Shared sub-components
// ================================================

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card px-3 py-2">
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-lg font-semibold tabular-nums text-foreground">
        {value}
        {sub && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {sub}
          </span>
        )}
      </p>
    </div>
  );
}

function getTaskBreakdownPercent(mins: number) {
  if (mins <= 0) return 0;
  return Math.min((mins / TASK_BREAKDOWN_VISIBLE_MINS) * 100, 100);
}

function TaskBar({ task }: { task: DailyTaskData }) {
  const estimated = task.estimatedMins ?? 0;
  const logged = task.loggedMins;
  const overflowMins = Math.max(
    Math.max(estimated, logged) - TASK_BREAKDOWN_VISIBLE_MINS,
    0
  );

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "min-w-0 truncate text-xs",
            task.completed && "text-muted-foreground line-through"
          )}
        >
          {task.projectColor && (
            <span
              className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
              style={{ backgroundColor: task.projectColor }}
            />
          )}
          {task.title}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {overflowMins > 0 && (
            <span
              data-testid={`analytics-task-overflow-${task.id}`}
              className="rounded-full border border-border/60 bg-background px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
              title={`Beyond the visible ${formatDuration(TASK_BREAKDOWN_VISIBLE_MINS)} cap`}
            >
              +{formatDuration(overflowMins)}
            </span>
          )}
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {estimated > 0 && <span>{formatDuration(estimated)} est</span>}
            {estimated > 0 && logged > 0 && <span className="mx-1">→</span>}
            {logged > 0 && <span>{formatDuration(logged)}</span>}
          </span>
        </div>
      </div>
      {/* Fixed 30m scale so bar lengths represent effort consistently across days. */}
      <div
        className="relative h-2 overflow-hidden rounded-full"
        data-testid={`analytics-task-track-${task.id}`}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 grid gap-px"
          style={{
            gridTemplateColumns: `repeat(${TASK_BREAKDOWN_VISIBLE_CHUNKS}, minmax(0, 1fr))`,
          }}
        >
          {TASK_BREAKDOWN_SEGMENTS.map((segment) => (
            <span key={segment} className="bg-muted" />
          ))}
        </div>
        {estimated > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/15"
            data-testid={`analytics-task-estimate-fill-${task.id}`}
            style={{ width: `${getTaskBreakdownPercent(estimated)}%` }}
          />
        )}
        {logged > 0 && (
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full",
              task.completed ? "bg-primary/70" : "bg-amber-500/70"
            )}
            data-testid={`analytics-task-actual-fill-${task.id}`}
            style={{ width: `${getTaskBreakdownPercent(logged)}%` }}
          />
        )}
      </div>
    </div>
  );
}

function HourlyChart({
  hourlyMins,
  title,
}: {
  hourlyMins: number[];
  title: string;
}) {
  const maxMins = Math.max(...hourlyMins, 1);
  const hasData = hourlyMins.some((m) => m > 0);
  if (!hasData) return null;

  // Only show hours 6-23 (typical work range)
  const startHour = 6;
  const endHour = 23;
  const hours = hourlyMins.slice(startHour, endHour + 1);

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <div className="flex items-end gap-px" style={{ height: 80 }}>
        {hours.map((mins, i) => {
          const hour = startHour + i;
          const height = maxMins > 0 ? (mins / maxMins) * 100 : 0;
          return (
            <div
              key={hour}
              className="flex flex-1 flex-col items-center justify-end"
              style={{ height: 64 }}
            >
              {mins > 0 ? (
                <div
                  className="w-full rounded-t-[2px] bg-primary/60"
                  style={{ height: `${height}%`, minHeight: 2 }}
                  title={`${hour}:00 — ${mins}m`}
                />
              ) : (
                <div className="w-full bg-muted/50" style={{ height: 1 }} />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex">
        {hours.map((_, i) => {
          const hour = startHour + i;
          const showLabel = hour % 3 === 0;
          return (
            <div
              key={hour}
              className="flex-1 text-center text-[8px] text-muted-foreground/60"
            >
              {showLabel ? `${hour}` : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Heatmap({ heatmap }: { heatmap: number[][] }) {
  const maxMins = Math.max(...heatmap.flat(), 1);
  const hasData = heatmap.some((row) => row.some((m) => m > 0));
  if (!hasData) return null;

  // Show hours 6-22
  const startHour = 6;
  const endHour = 22;

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">Work Time Heatmap</h3>
      <div>
        <div>
          {/* Hour labels */}
          <div className="flex gap-px ml-10 mb-1">
            {Array.from({ length: endHour - startHour + 1 }, (_, i) => {
              const hour = startHour + i;
              return (
                <div
                  key={hour}
                  className="flex-1 text-center text-[8px] text-muted-foreground/60"
                >
                  {hour % 3 === 0 ? `${hour}` : ""}
                </div>
              );
            })}
          </div>
          {/* Grid rows */}
          {heatmap.map((row, dayIdx) => (
            <div key={dayIdx} className="flex items-center gap-px mb-px">
              <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground pr-1.5">
                {DAY_LABELS[dayIdx]}
              </span>
              {row.slice(startHour, endHour + 1).map((mins, i) => {
                const intensity = maxMins > 0 ? mins / maxMins : 0;
                const alpha = Math.round((0.15 + intensity * 0.85) * 100);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-[2px]"
                    style={{
                      height: 16,
                      backgroundColor:
                        mins === 0
                          ? "var(--muted)"
                          : `color-mix(in oklch, var(--primary) ${alpha}%, transparent)`,
                    }}
                    title={`${DAY_LABELS[dayIdx]} ${startHour + i}:00 — ${mins}m`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ================================================
// Stats View — All-time work pattern heatmap
// ================================================

interface StatsData {
  weekCount: number[][];
  totalMins: number[][];
  totalWeeks: number;
}

function StatsView() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"frequency" | "duration">("frequency");

  useEffect(() => {
    fetch(analyticsUrl("stats"), { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
    );
  if (!data)
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">No data</div>
    );

  const startHour = 6;
  const endHour = 22;
  const grid = mode === "frequency" ? data.weekCount : data.totalMins;
  const maxVal = Math.max(...grid.flatMap((row) => row.slice(startHour, endHour + 1)), 1);
  const hasData = grid.some((row) => row.some((v) => v > 0));

  if (!hasData)
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No work data recorded yet. Start using the timer to build your pattern!
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Work Patterns</h3>
          <p className="text-xs text-muted-foreground">
            Across {data.totalWeeks} week{data.totalWeeks !== 1 ? "s" : ""} of data
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted/50 p-0.5">
          <button
            onClick={() => setMode("frequency")}
            className={cn(
              "rounded-sm px-2.5 py-0.5 text-xs font-medium transition-colors",
              mode === "frequency"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Frequency
          </button>
          <button
            onClick={() => setMode("duration")}
            className={cn(
              "rounded-sm px-2.5 py-0.5 text-xs font-medium transition-colors",
              mode === "duration"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Duration
          </button>
        </div>
      </div>

      {/* Heatmap: rows = hours, columns = days */}
      <div>
        <div>
          {/* Day column headers */}
          <div className="flex gap-px ml-10 mb-1">
            {DAY_LABELS.map((day) => (
              <div
                key={day}
                className="flex-1 text-center text-[10px] font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>
          {/* Hour rows */}
          {Array.from({ length: endHour - startHour + 1 }, (_, i) => {
            const hour = startHour + i;
            return (
              <div key={hour} className="flex items-center gap-px mb-px">
                <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground pr-1.5">
                  {hour}:00
                </span>
                {DAY_LABELS.map((day, dayIdx) => {
                  const val = grid[dayIdx][hour];
                  const intensity = maxVal > 0 ? val / maxVal : 0;
                  const alpha = Math.round((0.15 + intensity * 0.85) * 100);
                  const tooltip =
                    mode === "frequency"
                      ? `${day} ${hour}:00 — ${val} week${val !== 1 ? "s" : ""}`
                      : `${day} ${hour}:00 — ${val}m total`;
                  return (
                    <div
                      key={dayIdx}
                      className="flex-1 rounded-[2px]"
                      style={{
                        height: 20,
                        backgroundColor:
                          val === 0
                            ? "var(--muted)"
                            : `color-mix(in oklch, var(--primary) ${alpha}%, transparent)`,
                      }}
                      title={tooltip}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((intensity) => {
          const alpha = Math.round((0.15 + intensity * 0.85) * 100);
          return (
            <div
              key={intensity}
              className="h-3 w-3 rounded-[2px]"
              style={{
                backgroundColor:
                  intensity === 0
                    ? "var(--muted)"
                    : `color-mix(in oklch, var(--primary) ${alpha}%, transparent)`,
              }}
            />
          );
        })}
        <span>More</span>
      </div>

      {/* Peak hours summary */}
      <PeakHoursSummary weekCount={data.weekCount} totalWeeks={data.totalWeeks} />
    </div>
  );
}

function PeakHoursSummary({
  weekCount,
  totalWeeks,
}: {
  weekCount: number[][];
  totalWeeks: number;
}) {
  // Find the top 5 (day, hour) slots by frequency
  const slots: { dayIdx: number; hour: number; count: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (weekCount[d][h] > 0) {
        slots.push({ dayIdx: d, hour: h, count: weekCount[d][h] });
      }
    }
  }
  slots.sort((a, b) => b.count - a.count);
  const top = slots.slice(0, 5);

  if (top.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Peak Work Hours</h3>
      <div className="space-y-1.5">
        {top.map((slot, i) => {
          const pct = totalWeeks > 0 ? Math.round((slot.count / totalWeeks) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {DAY_LABELS[slot.dayIdx]} {slot.hour}:00
              </span>
              <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {slot.count}/{totalWeeks} wks
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
