"use client";

import { useEffect, useRef } from "react";
import { useTodoistStore } from "@/lib/stores/todoist-store";
import { useFlowStore } from "@/lib/stores/flow-store";

export function useHydration() {
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    Promise.all([
      useTodoistStore.getState().hydrate(),
      useFlowStore.getState().hydrate(),
    ]);
  }, []);
}
