"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const PLANNING_STEPS = [
  { id: "add", label: "Add Tasks" },
  { id: "review", label: "Review" },
  { id: "confirm", label: "Ready" },
] as const;

export function PlanningStepIndicator({
  stepIndex,
}: {
  stepIndex: number;
}) {
  return (
    <div className="mb-5 flex items-center gap-1">
      {PLANNING_STEPS.map((step, index) => (
        <div key={step.id} className="flex items-center gap-1">
          {index > 0 && <div className="mx-1 h-px w-6 bg-border" />}
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              index < stepIndex
                ? "text-primary"
                : index === stepIndex
                  ? "text-foreground"
                  : "text-muted-foreground/40"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                index < stepIndex
                  ? "bg-primary text-primary-foreground"
                  : index === stepIndex
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground/60"
              )}
            >
              {index < stepIndex ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
