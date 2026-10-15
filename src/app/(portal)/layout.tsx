import Link from "next/link";
import {
  LayoutDashboard,
  FolderKanban,
  LogOut,
  CalendarDays,
  FileText,
  MessageSquarePlus,
  MessagesSquare,
} from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { getPortalClient } from "@/actions/portal";
import { requireProfile } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { redirect } from "next/navigation";

const portalLinks = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/projects", label: "Projects", icon: FolderKanban },
  { href: "/portal/meetings", label: "Meetings", icon: CalendarDays },
  { href: "/portal/documents", label: "Documents", icon: FileText },
  { href: "/portal/feedback", label: "Feedback", icon: MessageSquarePlus },
  { href: "/portal/groups", label: "Groups", icon: MessagesSquare },
] as const;

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  if (profile.role !== "client") {
    redirect("/dashboard");
  }

  let clientName = profile.full_name;
  try {
    const client = await getPortalClient();
    clientName = client.name;
  } catch {
    // Linked client may be missing; still show portal shell
  }

  return (
    <div className="min-h-dvh overflow-x-clip bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:px-6">
          <div className="min-w-0">
            <Link
              href="/portal"
              className="text-base font-extrabold text-brand sm:text-lg"
            >
              {APP_NAME}
            </Link>
            <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted sm:text-[11px]">
              {clientName} portal
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <p className="hidden text-sm text-muted lg:block">
              {profile.full_name}
            </p>
            <ThemeToggle />
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm" className="rounded-xl">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </form>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="mx-auto hidden max-w-6xl items-center gap-1 px-4 pb-3 sm:flex lg:px-6">
          {portalLinks.map(({ href, label, icon: Icon }) => (
            <Button key={href} asChild variant="ghost" size="sm" className="rounded-lg">
              <Link href={href}>
                <Icon className="h-4 w-4" /> {label}
              </Link>
            </Button>
          ))}
        </nav>

        {/* Mobile horizontal nav */}
        <nav className="flex gap-1 overflow-x-auto overscroll-x-contain px-3 pb-3 sm:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {portalLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface/60 px-3 py-1.5 text-xs font-semibold text-foreground"
            >
              <Icon className="h-3.5 w-3.5 text-brand" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-4 sm:py-8 lg:px-6">
        {children}
      </main>
    </div>
  );
}
