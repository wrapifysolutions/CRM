"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  CheckSquare,
  FileText,
  Bell,
  Activity,
  BarChart3,
  Settings,
  UserCog,
  Menu,
  X,
  UserCheck,
  CalendarDays,
  MessageSquarePlus,
  MessagesSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { useUIStore } from "@/stores/ui-store";
import { hasPermission, type Permission } from "@/lib/rbac";
import type { UserRole } from "@/types/database";
import { Button } from "@/components/ui/button";

const navItems: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  roles?: UserRole[];
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users, permission: "clients.view" },
  {
    href: "/companies",
    label: "Companies",
    icon: Building2,
    permission: "companies.manage",
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
    permission: "projects.view",
  },
  {
    href: "/meetings",
    label: "Meetings",
    icon: CalendarDays,
    permission: "clients.view",
  },
  {
    href: "/feedback",
    label: "Feedback",
    icon: MessageSquarePlus,
    permission: "clients.view",
  },
  {
    href: "/groups",
    label: "Groups",
    icon: MessagesSquare,
    permission: "projects.view",
  },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, permission: "tasks.view" },
  {
    href: "/documents",
    label: "Documents",
    icon: FileText,
    permission: "documents.upload",
  },
  { href: "/notifications", label: "Notifications", icon: Bell },
  {
    href: "/activity",
    label: "Activity",
    icon: Activity,
    permission: "activity.view",
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    permission: "reports.view",
  },
  {
    href: "/approvals",
    label: "Approvals",
    icon: UserCheck,
    roles: ["super_admin", "admin", "manager"],
  },
  {
    href: "/users",
    label: "Users",
    icon: UserCog,
    permission: "users.manage",
  },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();

  const items = navItems.filter((item) => {
    if (item.roles && !item.roles.includes(role)) return false;
    if (item.permission && !hasPermission(role, item.permission)) return false;
    return true;
  });

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={toggleSidebar}
      >
        {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#243044] bg-[#1a2332] text-[#e6ebf2] transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center border-b border-white/10 px-6">
          <Link href="/dashboard" className="text-xl font-extrabold tracking-tight text-[#d4deea]">
            {APP_NAME}
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-[#2c5282] text-[#e6ebf2]"
                    : "text-[#9aa8b8] hover:bg-white/5 hover:text-[#d4deea]"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
