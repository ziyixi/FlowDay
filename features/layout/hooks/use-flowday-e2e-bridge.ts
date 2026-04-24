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
      mountFakePopOutWindow: () => void;
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
    let fakePopOutContainer: HTMLElement | null = null;
    const hadDocumentPictureInPicture = "documentPictureInPicture" in window;
    const originalDocumentPictureInPicture = window.documentPictureInPicture;

    const restoreDocumentPictureInPicture = () => {
      if (hadDocumentPictureInPicture) {
        Object.defineProperty(window, "documentPictureInPicture", {
          configurable: true,
          value: originalDocumentPictureInPicture,
        });
        return;
      }
      delete window.documentPictureInPicture;
    };

    const setFakePopOutWindow = (renderPortal: boolean) => {
      fakePopOutClosed = false;
      fakePopOutContainer?.remove();
      fakePopOutContainer = null;

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
      let fakeWindowClosed = false;
      const fakeWindow = {
        get closed() {
          return fakeWindowClosed;
        },
        document: fakeDocument,
        focus() {},
        close() {
          fakeWindowClosed = true;
          fakePopOutClosed = true;
          fakePopOutContainer?.remove();
          fakePopOutContainer = null;
        },
      } as unknown as Window;

      if (renderPortal) {
        fakePopOutContainer = document.createElement("div");
        fakePopOutContainer.setAttribute("data-testid", "fake-pop-out-root");
        document.body.appendChild(fakePopOutContainer);
        Object.defineProperty(window, "documentPictureInPicture", {
          configurable: true,
          value: {
            requestWindow: async () => fakeWindow,
            window: fakeWindow,
          } satisfies DocumentPictureInPicture,
        });
      }

      usePopOutStore.setState({
        pipWindow: fakeWindow,
        container: fakePopOutContainer,
      });
    };

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
      primeFakePopOutWindow: () => setFakePopOutWindow(false),
      mountFakePopOutWindow: () => setFakePopOutWindow(true),
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
      fakePopOutContainer?.remove();
      restoreDocumentPictureInPicture();
      delete window.__FLOWDAY_E2E__;
    };
  }, [enabled]);
}
