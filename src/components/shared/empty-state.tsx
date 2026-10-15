import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3.5 px-6 py-16 text-center",
        className
      )}
    >
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface text-brand shadow-[var(--shadow-sm)]">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <p className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </p>
        {description ? (
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
