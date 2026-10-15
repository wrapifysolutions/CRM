"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function AnimatedStat({
  value,
  label,
  icon,
  accent,
  href,
}: {
  value: number | string;
  label: string;
  icon: React.ReactNode;
  accent: string;
  href?: string;
}) {
  const body = (
    <>
      <div className={cn("absolute inset-x-0 top-0 h-[3px]", accent)} />
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </p>
        <div className="rounded-xl bg-brand-soft p-2.5 text-brand shadow-[var(--shadow-sm)]">
          {icon}
        </div>
      </div>
      <p className="text-[1.75rem] font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
        {value}
      </p>
      {href && (
        <p className="mt-3 text-xs font-semibold text-brand opacity-0 transition group-hover:opacity-100">
          View details →
        </p>
      )}
    </>
  );

  const className = cn(
    "group relative overflow-hidden rounded-[1.1rem] border border-border bg-card p-5 shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
    href && "block cursor-pointer hover:border-brand/30"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
