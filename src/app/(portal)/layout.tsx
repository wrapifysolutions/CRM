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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-6">
            <div>
              <Link href="/portal" className="text-lg font-extrabold text-brand">
                {APP_NAME}
              </Link>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
                {clientName} portal
              </p>
            </div>
            <nav className="hidden items-center gap-1 sm:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href="/portal">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/portal/projects">
                  <FolderKanban className="h-4 w-4" /> Projects
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/portal/meetings">
                  <CalendarDays className="h-4 w-4" /> Meetings
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/portal/documents">
                  <FileText className="h-4 w-4" /> Documents
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/portal/feedback">
                  <MessageSquarePlus className="h-4 w-4" /> Feedback
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/portal/groups">
                  <MessagesSquare className="h-4 w-4" /> Groups
                </Link>
              </Button>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <p className="hidden text-sm text-muted md:block">
              {profile.full_name}
            </p>
            <ThemeToggle />
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 lg:px-6">{children}</main>
    </div>
  );
}
