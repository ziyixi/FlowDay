"use client";

import { useEffect } from "react";
import { usePopOutStore } from "@/lib/stores/pop-out-store";
import { useTimerStore } from "@/features/timer/store";
import { _getChimeCount, _resetChime } from "@/lib/utils/chime";

declare global {
  interface Window {
    __FLOWDAY_E2E__?: {
      setRunningTimerElapsed: (seconds: number) => void;
      getTimerState: () => {
        activeTaskId: string | null;
        status: "idle" | "running" | "paused";
        timerMode: "countup" | "pomodoro";
        displaySeconds: number;
        pomodoroFinishedTaskId: string | null;
      };
      getChimeCount: () => number;
      resetChimeCount: () => void;
      simulateIdleAway: (secondsAgo: number) => void;
      primeFakePopOutWindow: () => void;
      getPopOutState: () => {
        isOpen: boolean;
        fakeClosed: boolean;
      };
    };
  }
}

export function useFlowdayE2EBridge(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let fakePopOutClosed = false;

    window.__FLOWDAY_E2E__ = {
      setRunningTimerElapsed: (seconds: number) => {
        const state = useTimerStore.getState();
        if (state.status !== "running" || state.segmentStartedAt == null) {
          throw new Error("No running timer available for E2E time control");
        }

        useTimerStore.setState({
          segmentStartedAt: Date.now() - seconds * 1000,
        });
        useTimerStore.getState().tick();
      },
      getTimerState: () => {
        const state = useTimerStore.getState();
        return {
          activeTaskId: state.activeTaskId,
          status: state.status,
          timerMode: state.timerMode,
          displaySeconds: state.displaySeconds,
          pomodoroFinishedTaskId: state.pomodoroFinishedTaskId,
        };
      },
      getChimeCount: () => _getChimeCount(),
      resetChimeCount: () => _resetChime(),
      simulateIdleAway: (secondsAgo: number) => {
        const state = useTimerStore.getState();
        if (state.status !== "running") {
          throw new Error("No running timer to backdate");
        }
        void state.pauseTimer(Date.now() - secondsAgo * 1000);
      },
      primeFakePopOutWindow: () => {
        fakePopOutClosed = false;
        const fakeDocument = {
          visibilityState: "visible",
          addEventListener() {},
          removeEventListener() {},
          documentElement: {
            classList: {
              toggle() {},
            },
          },
        };
        usePopOutStore.setState({
          pipWindow: {
            document: fakeDocument,
            close() {
              fakePopOutClosed = true;
            },
          } as unknown as Window,
          container: null,
        });
      },
      getPopOutState: () => {
        const state = usePopOutStore.getState();
        return {
          isOpen: Boolean(state.pipWindow),
          fakeClosed: fakePopOutClosed,
        };
      },
    };

    return () => {
      usePopOutStore.getState().close();
      delete window.__FLOWDAY_E2E__;
    };
  }, [enabled]);
}
