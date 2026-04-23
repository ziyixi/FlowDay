"use client";

import { useEffect, useState } from "react";
import { useTimerStore } from "@/features/timer/store";

interface NoteRow {
  taskId: string;
  content: string;
}

interface EntryRow {
  taskId: string;
  durationS: number | null;
}

export function useDayNotesMap(date: string): Record<string, string> {
  const [notesByTask, setNotesByTask] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/notes?date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: NoteRow[]) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const row of rows) {
          next[row.taskId] = row.content ?? "";
        }
        setNotesByTask(next);
      })
      .catch(() => {
        if (!cancelled) setNotesByTask({});
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  return notesByTask;
}

export function useDayLoggedSecondsMap(date: string): Record<string, number> {
  const [secondsByTask, setSecondsByTask] = useState<Record<string, number>>({});
  const entryRevision = useTimerStore((state) => state.entryRevision);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entries?date=${encodeURIComponent(date)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((entries: EntryRow[]) => {
        if (cancelled) return;
        const next: Record<string, number> = {};
        for (const entry of entries) {
          next[entry.taskId] = (next[entry.taskId] ?? 0) + (entry.durationS ?? 0);
        }
        setSecondsByTask(next);
      })
      .catch(() => {
        if (!cancelled) setSecondsByTask({});
      });

    return () => {
      cancelled = true;
    };
  }, [date, entryRevision]);

  return secondsByTask;
}
