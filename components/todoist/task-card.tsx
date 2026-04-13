"use client";

import { useDraggable } from "@dnd-kit/react";
import { Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Task } from "@/lib/types/task";
import { PRIORITY_CONFIG } from "@/lib/types/task";
import { useTodoistStore } from "@/lib/stores/todoist-store";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { EstimateEditor } from "@/components/shared/estimate-editor";
import { cn } from "@/lib/utils";

export function TaskCard({ task }: { task: Task }) {
  const { ref, isDragSource } = useDraggable({
    id: task.id,
    type: "task-pool-card",
    data: { task },
  });
  const deleteTask = useTodoistStore((s) => s.deleteTask);

  const priorityColor = PRIORITY_CONFIG[task.priority].color;
  const hasDescription = task.description && task.description.trim().length > 0;
  const hasLabels = task.labels.length > 0;
  const hasTooltipContent = hasDescription || hasLabels;

  const cardContent = (
    <>
      <span
        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", priorityColor)}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {task.title}
        </p>
        {task.projectName && (
          <p className="truncate text-xs text-muted-foreground">
            {task.projectName}
          </p>
        )}
      </div>
      <EstimateEditor task={task} variant="inline" />
      <button
        onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
        className="shrink-0 opacity-0 group-hover:opacity-100 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 hover:text-red-500 transition-all"
        title="Delete task"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </>
  );

  const cardClassName = cn(
    "group flex items-start gap-2.5 rounded-md border border-border bg-card px-2.5 py-2 transition-colors hover:bg-accent cursor-grab active:cursor-grabbing",
    isDragSource && "opacity-50"
  );

  if (!hasTooltipContent) {
    return (
      <div ref={ref} className={cardClassName}>
        {cardContent}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<div />} className="w-full">
        <div ref={ref} className={cardClassName}>
          {cardContent}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <div className="space-y-1.5">
          {hasLabels && (
            <div className="flex flex-wrap gap-1">
              {task.labels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
          {hasDescription && (
            <div className="text-xs leading-relaxed [&_p]:my-0.5 [&_ul]:ml-3 [&_ul]:list-disc [&_ol]:ml-3 [&_ol]:list-decimal [&_a]:underline [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-background/20 [&_code]:px-1 [&_code]:text-[11px] [&_h1]:text-sm [&_h1]:font-bold [&_h2]:text-xs [&_h2]:font-bold [&_h3]:text-xs [&_h3]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-background/30 [&_blockquote]:pl-2 [&_blockquote]:italic">
              <ReactMarkdown>{task.description!}</ReactMarkdown>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
