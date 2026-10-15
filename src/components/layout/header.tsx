"use client";

import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import type { Profile } from "@/types/database";
import { Badge } from "@/components/ui/badge";

export function Header({
  profile,
  unreadCount,
}: {
  profile: Profile;
  unreadCount: number;
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-card/80 backdrop-blur-2xl supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:h-[4.25rem] sm:gap-4 sm:px-5 lg:px-8">
        <div className="min-w-0 flex-1 pl-11 lg:pl-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            {greeting}
          </p>
          <p className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-[15px]">
            {profile.full_name}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Badge
            variant="secondary"
            className="hidden capitalize md:inline-flex rounded-lg border border-border/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide"
          >
            {profile.role.replace(/_/g, " ")}
          </Badge>

          <ThemeToggle />

          <Button
            variant="ghost"
            size="icon"
            asChild
            className="relative h-9 w-9 rounded-xl"
          >
            <Link href="/notifications" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white shadow-sm">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          </Button>

          <form action={logoutAction}>
            <Button
              variant="outline"
              size="sm"
              type="submit"
              className="h-9 rounded-xl px-2.5 sm:px-3"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
