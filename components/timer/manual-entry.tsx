"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Clock, Pencil, Trash2, Plus, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TimeEntry {
  id: string;
  taskId: string;
  flowDate: string;
  startTime: string;
  endTime: string | null;
  durationS: number | null;
  source: string;
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatTimeRange(start: string, end: string | null): string {
  const s = new Date(start);
  const startStr = format(s, "HH:mm");
  if (!end) return `${startStr} – …`;
  const e = new Date(end);
  const endStr = format(e, "HH:mm");
  return `${startStr} – ${endStr}`;
}

function formatDurationShort(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

// --- Edit Dialog ---

function EditEntryDialog({
  entry,
  open,
  onOpenChange,
  onSaved,
}: {
  entry: TimeEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStartTime(toLocalDatetime(entry.startTime));
      setEndTime(entry.endTime ? toLocalDatetime(entry.endTime) : "");
      setError("");
    }
  }, [open, entry]);

  async function handleSave() {
    if (!startTime || !endTime) {
      setError("Both times required");
      return;
    }
    const start = new Date(startTime).toISOString();
    const end = new Date(endTime).toISOString();
    if (new Date(end) <= new Date(start)) {
      setError("End must be after start");
      return;
    }

    setSaving(true);
    try {
      await fetch(`/api/entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: start, endTime: end }),
      });
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Time Entry</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Start
            </label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              End
            </label>
            <Input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Add Dialog ---

function AddEntryDialog({
  taskId,
  flowDate,
  open,
  onOpenChange,
  onCreated,
}: {
  taskId: string;
  flowDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const now = toLocalDatetime(new Date().toISOString());
      setStartTime(now.slice(0, 11) + "09:00");
      setEndTime(now);
      setError("");
    }
  }, [open]);

  async function handleSubmit() {
    if (!startTime || !endTime) {
      setError("Both times required");
      return;
    }
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      setError("End must be after start");
      return;
    }

    const durationS = Math.floor((end.getTime() - start.getTime()) / 1000);
    setSaving(true);
    setError("");

    try {
      await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          flowDate,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          durationS,
          source: "manual",
        }),
      });
      onOpenChange(false);
      onCreated();
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Time Entry</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Start
            </label>
            <Input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              End
            </label>
            <Input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Entry Row (display only, actions open dialogs) ---

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  async function handleDelete() {
    await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
    onDelete();
  }

  const entryDate = format(new Date(entry.startTime), "MMM d");

  return (
    <div className="group flex items-center justify-between rounded px-1.5 py-1 hover:bg-accent/50">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground/60 text-[10px] w-10 shrink-0">
          {entryDate}
        </span>
        <span className="text-foreground">
          {formatTimeRange(entry.startTime, entry.endTime)}
        </span>
        {entry.durationS != null && entry.durationS > 0 && (
          <span className="text-muted-foreground">
            ({formatDurationShort(entry.durationS)})
          </span>
        )}
        <span className="text-muted-foreground/60 text-[10px] uppercase">
          {entry.source}
        </span>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
        <button
          onClick={handleDelete}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-red-600"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

// --- Main ManualEntry popover ---

export function ManualEntry({
  taskId,
  flowDate,
  onEntriesChanged,
}: {
  taskId: string;
  flowDate: string;
  onEntriesChanged?: () => void;
}) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/entries?taskId=${encodeURIComponent(taskId)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        setEntries(await res.json());
      }
    } catch {
      // ignore
    }
  }, [taskId]);

  useEffect(() => {
    if (isOpen) fetchEntries();
  }, [isOpen, fetchEntries]);

  const handleChanged = useCallback(() => {
    fetchEntries();
    onEntriesChanged?.();
  }, [fetchEntries, onEntriesChanged]);

  const totalSeconds = entries.reduce((sum, e) => sum + (e.durationS ?? 0), 0);

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors relative"
          title="Time entries"
        >
          <Clock className="h-3.5 w-3.5" />
          {entries.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
              {entries.length}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1.5">
              <h4 className="text-xs font-medium text-muted-foreground">
                Time Entries
              </h4>
              {totalSeconds > 0 && (
                <span className="text-xs font-medium text-primary tabular-nums">
                  Total: {formatDurationShort(totalSeconds)}
                </span>
              )}
            </div>

            {entries.length === 0 && (
              <p className="text-xs text-muted-foreground/60 px-1.5 py-1">
                No entries yet
              </p>
            )}

            <div className="max-h-48 overflow-y-auto">
              {entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onEdit={() => setEditingEntry(entry)}
                  onDelete={handleChanged}
                />
              ))}
            </div>

            <button
              onClick={() => setAddDialogOpen(true)}
              className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add time entry
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Edit dialog — rendered outside the popover to avoid z-index issues */}
      {editingEntry && (
        <EditEntryDialog
          entry={editingEntry}
          open={!!editingEntry}
          onOpenChange={(open) => {
            if (!open) setEditingEntry(null);
          }}
          onSaved={handleChanged}
        />
      )}

      {/* Add dialog */}
      <AddEntryDialog
        taskId={taskId}
        flowDate={flowDate}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCreated={handleChanged}
      />
    </>
  );
}
