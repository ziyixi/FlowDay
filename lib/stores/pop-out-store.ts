import { create } from "zustand";

interface DocumentPictureInPicture {
  requestWindow: (options?: {
    width?: number;
    height?: number;
  }) => Promise<Window>;
  window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

interface PopOutState {
  pipWindow: Window | null;
  container: HTMLElement | null;
  open: () => Promise<void>;
  close: () => void;
}

function copyStylesToPipWindow(pipWindow: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const cssText = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n");
      const style = pipWindow.document.createElement("style");
      style.textContent = cssText;
      pipWindow.document.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = pipWindow.document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        pipWindow.document.head.appendChild(link);
      }
    }
  }
}

export const usePopOutStore = create<PopOutState>()((set, get) => ({
  pipWindow: null,
  container: null,

  open: async () => {
    const existing = get().pipWindow;
    if (existing && !existing.closed) {
      existing.focus();
      return;
    }
    if (typeof window === "undefined" || !("documentPictureInPicture" in window)) {
      return;
    }

    const win = await window.documentPictureInPicture!.requestWindow({
      width: 280,
      height: 200,
    });

    copyStylesToPipWindow(win);

    win.document.documentElement.style.height = "100%";
    win.document.documentElement.style.overflow = "hidden";
    win.document.body.style.margin = "0";
    win.document.body.style.height = "100%";
    win.document.body.style.overflow = "hidden";

    const root = win.document.createElement("div");
    root.className =
      "h-full w-full overflow-hidden font-sans antialiased bg-background text-foreground";
    win.document.body.appendChild(root);

    win.addEventListener("pagehide", () => {
      set({ pipWindow: null, container: null });
    });

    set({ pipWindow: win, container: root });
  },

  close: () => {
    const win = get().pipWindow;
    if (win && !win.closed) win.close();
    set({ pipWindow: null, container: null });
  },
}));
