"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Search } from "lucide-react";

export function ListFilters({
  statusOptions,
  priorityOptions,
  searchPlaceholder = "Search…",
}: {
  statusOptions?: { value: string; label: string }[];
  priorityOptions?: { value: string; label: string }[];
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      className={`flex flex-col gap-2.5 md:flex-row md:items-center ${pending ? "opacity-70" : ""}`}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          className="h-10 w-full rounded-xl border-border/80 bg-card pl-9 shadow-none"
          placeholder={searchPlaceholder}
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            const id = setTimeout(() => update("search", value), 350);
            return () => clearTimeout(id);
          }}
          onBlur={(e) => update("search", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              update("search", (e.target as HTMLInputElement).value);
            }
          }}
        />
      </div>
      {statusOptions && (
        <Select
          defaultValue={searchParams.get("status") ?? ""}
          onChange={(e) => update("status", e.target.value)}
          className="h-10 w-full rounded-xl border-border/80 md:w-44"
        >
          <option value="">All statuses</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
      {priorityOptions && (
        <Select
          defaultValue={searchParams.get("priority") ?? ""}
          onChange={(e) => update("priority", e.target.value)}
          className="h-10 w-full rounded-xl border-border/80 md:w-44"
        >
          <option value="">All priorities</option>
          {priorityOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
