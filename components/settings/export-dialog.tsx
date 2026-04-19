"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatLocalDate } from "@/lib/utils/time";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function todayStr() {
  return formatLocalDate();
}

function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return formatLocalDate(d);
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [startDate, setStartDate] = useState(weekAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [exportType, setExportType] = useState<"entries" | "flows">("entries");
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setStartDate(weekAgoStr());
      setEndDate(todayStr());
    }
    onOpenChange(nextOpen);
  };

  function handleDownload() {
    const params = new URLSearchParams({
      type: exportType,
      format: exportFormat,
      start: startDate,
      end: endDate,
    });
    const url = `/api/export?${params.toString()}`;

    const a = document.createElement("a");
    a.href = url;
    a.download = `flowday-${exportType}-${startDate}-to-${endDate}.${exportFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Export type */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Data type</label>
            <div className="flex gap-1 rounded-md border border-border bg-muted/50 p-0.5 w-fit">
              {(["entries", "flows"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setExportType(t)}
                  className={cn(
                    "rounded-sm px-3 py-1 text-sm font-medium transition-colors",
                    exportType === t
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "entries" ? "Time Entries" : "Flow History"}
                </button>
              ))}
            </div>
          </div>
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {/* Format */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Format</label>
            <div className="flex gap-1 rounded-md border border-border bg-muted/50 p-0.5 w-fit">
              {(["csv", "json"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setExportFormat(f)}
                  className={cn(
                    "rounded-sm px-3 py-1 text-sm font-medium transition-colors uppercase",
                    exportFormat === f
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button data-testid="download-export" onClick={handleDownload}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
