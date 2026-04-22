"use client";

import { useEffect, useState } from "react";

export function useTaskLoggedSeconds(taskId: string, revision: number): number {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    fetch(`/api/entries?taskId=${encodeURIComponent(taskId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((entries: { durationS: number | null }[]) => {
        if (!cancelled) {
          setSeconds(entries.reduce((s, e) => s + (e.durationS ?? 0), 0));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [taskId, revision]);

  return seconds;
}
