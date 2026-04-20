"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTodoistStore } from "@/lib/stores/todoist-store";
import { useFlowStore } from "@/lib/stores/flow-store";
import { ExportDialog } from "./export-dialog";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type IdlePermissionState = "granted" | "denied" | "prompt" | "unsupported";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capacityHours, setCapacityHours] = useState("6");
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [idleStatus, setIdleStatus] = useState<IdlePermissionState>("unsupported");
  const [requestingIdle, setRequestingIdle] = useState(false);

  const isSyncing = useTodoistStore((s) => s.isSyncing);
  const lastSyncAt = useTodoistStore((s) => s.lastSyncAt);
  const sync = useTodoistStore((s) => s.sync);
  const setDayCapacityMins = useFlowStore((s) => s.setDayCapacityMins);

  useEffect(() => {
    if (open) {
      setApiKey("");
      setMessage(null);
      fetch("/api/settings", { cache: "no-store" })
        .then((r) => r.json())
        .then((data) => {
          setHasExistingKey(data.has_api_key);
          if (data.day_capacity_mins != null) {
            setCapacityHours(String(data.day_capacity_mins / 60));
          }
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let permStatus: PermissionStatus | null = null;
    let onChange: (() => void) | null = null;

    async function check() {
      if (typeof window === "undefined" || !window.IdleDetector) {
        setIdleStatus("unsupported");
        return;
      }
      try {
        permStatus = await navigator.permissions.query({
          name: "idle-detection" as PermissionName,
        });
        if (cancelled) return;
        setIdleStatus(permStatus.state);
        onChange = () => setIdleStatus(permStatus!.state);
        permStatus.addEventListener("change", onChange);
      } catch {
        setIdleStatus("unsupported");
      }
    }
    void check();
    return () => {
      cancelled = true;
      if (permStatus && onChange) {
        permStatus.removeEventListener("change", onChange);
      }
    };
  }, [open]);

  async function handleGrantIdle() {
    if (!window.IdleDetector) return;
    setRequestingIdle(true);
    try {
      const result = await window.IdleDetector.requestPermission();
      setIdleStatus(result === "granted" ? "granted" : "denied");
    } catch {
      // user dismissed the prompt
    } finally {
      setRequestingIdle(false);
    }
  }

  async function handleSave() {
    if (!apiKey.trim()) {
      setMessage({ type: "error", text: "API key cannot be empty" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todoist_api_key: apiKey.trim() }),
      });
      if (res.ok) {
        setHasExistingKey(true);
        setApiKey("");
        setMessage({ type: "success", text: "API key saved. Click Sync Now to fetch tasks." });
      } else {
        setMessage({ type: "error", text: "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to save" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setMessage(null);
    await sync();
    setMessage({ type: "success", text: "Sync complete" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Todoist API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Todoist API Key
            </label>
            <p className="text-xs text-muted-foreground">
              Find your API key at{" "}
              <span className="font-medium">Settings → Integrations → Developer</span> in Todoist.
              FlowDay only reads your tasks — it never modifies your Todoist data.
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={hasExistingKey ? "••••••••  (key saved)" : "Enter your API key"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSave} disabled={saving}>
                Save
              </Button>
            </div>
          </div>

          {/* Sync */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Todoist Sync
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing || !hasExistingKey}
              >
                <RefreshCw
                  className={cn("mr-1.5 h-3.5 w-3.5", isSyncing && "animate-spin")}
                />
                Sync Now
              </Button>
            </div>
            {lastSyncAt && (
              <p className="text-xs text-muted-foreground">
                Last synced:{" "}
                {new Date(lastSyncAt).toLocaleString()}
              </p>
            )}
            {!hasExistingKey && (
              <p className="text-xs text-muted-foreground/60">
                Save an API key to enable syncing.
              </p>
            )}
            <p className="text-xs text-muted-foreground/60">
              Tasks sync automatically every minute when an API key is set.
            </p>
          </div>

          {/* Day Capacity */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Daily Work Capacity
            </label>
            <p className="text-xs text-muted-foreground">
              Set your daily focused work budget. You&apos;ll see a warning when your planned tasks exceed this.
            </p>
            <div className="flex items-center gap-2">
              <Input
                data-testid="capacity-input"
                type="number"
                min="0"
                step="0.5"
                value={capacityHours}
                onChange={(e) => setCapacityHours(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">hours</span>
              <Button
                data-testid="capacity-save"
                variant="outline"
                size="sm"
                disabled={savingCapacity}
                onClick={async () => {
                  const hrs = parseFloat(capacityHours);
                  if (isNaN(hrs) || hrs < 0) {
                    setMessage({ type: "error", text: "Invalid capacity value" });
                    return;
                  }
                  setSavingCapacity(true);
                  setMessage(null);
                  try {
                    const capMins = Math.round(hrs * 60);
                    const res = await fetch("/api/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ day_capacity_mins: capMins }),
                    });
                    if (res.ok) {
                      setDayCapacityMins(capMins);
                      setMessage({ type: "success", text: "Capacity saved" });
                    } else {
                      setMessage({ type: "error", text: "Failed to save capacity" });
                    }
                  } catch {
                    setMessage({ type: "error", text: "Failed to save capacity" });
                  } finally {
                    setSavingCapacity(false);
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>

          {/* Auto-pause when idle */}
          {idleStatus !== "unsupported" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Auto-pause when idle
              </label>
              <p className="text-xs text-muted-foreground">
                Allow FlowDay to detect when you lock your screen or have no
                input for ≥ 10 minutes, so the running timer pauses
                automatically. Without this, FlowDay falls back to a less
                precise window-visibility heuristic.
              </p>
              <div className="flex items-center gap-2">
                {idleStatus === "granted" && (
                  <span className="text-xs font-medium text-green-600">
                    Enabled
                  </span>
                )}
                {idleStatus === "denied" && (
                  <span className="text-xs text-muted-foreground">
                    Denied — re-enable from your browser&apos;s site settings
                    for this page.
                  </span>
                )}
                {idleStatus === "prompt" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGrantIdle}
                    disabled={requestingIdle}
                  >
                    Allow
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Export Data */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Export Data
            </label>
            <p className="text-xs text-muted-foreground">
              Download your time entries or flow history as CSV or JSON.
            </p>
            <Button data-testid="open-export-dialog" variant="outline" size="sm" onClick={() => setExportOpen(true)}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
          </div>

          <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />

          {/* Message */}
          {message && (
            <p
              className={cn(
                "text-xs",
                message.type === "success" ? "text-green-600" : "text-destructive"
              )}
            >
              {message.text}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
