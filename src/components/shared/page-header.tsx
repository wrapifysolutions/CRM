import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card px-4 py-4 shadow-[var(--shadow-sm)] sm:rounded-[1.25rem] sm:px-6 sm:py-6",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 70% 90% at 0% 0%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 55%)",
        }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand sm:text-[11px]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-[1.85rem]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-[13px] leading-relaxed text-muted sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
