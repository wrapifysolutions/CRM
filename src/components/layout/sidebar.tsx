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
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, COMPANY_NAME } from "@/lib/constants";
import { useUIStore } from "@/stores/ui-store";
import { useIsDesktop } from "@/hooks/use-media-query";
import { hasPermission, type Permission } from "@/lib/rbac";
import type { UserRole } from "@/types/database";
import { Button } from "@/components/ui/button";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  roles?: UserRole[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "CRM",
    items: [
      {
        href: "/clients",
        label: "Clients",
        icon: Users,
        permission: "clients.view",
      },
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
    ],
  },
  {
    label: "Work",
    items: [
      {
        href: "/groups",
        label: "Groups",
        icon: MessagesSquare,
        permission: "projects.view",
      },
      {
        href: "/tasks",
        label: "Tasks",
        icon: CheckSquare,
        permission: "tasks.view",
      },
      {
        href: "/documents",
        label: "Documents",
        icon: FileText,
        permission: "documents.upload",
      },
    ],
  },
  {
    label: "Insights",
    items: [
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
    ],
  },
  {
    label: "Admin",
    items: [
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
    ],
  },
];

function canSeeItem(item: NavItem, role: UserRole) {
  if (item.roles && !item.roles.includes(role)) return false;
  if (item.permission && !hasPermission(role, item.permission)) return false;
  return true;
}

function roleLabel(role: UserRole) {
  return role.replace(/_/g, " ");
}

export function Sidebar({
  role,
  fullName,
  unreadCount = 0,
}: {
  role: UserRole;
  fullName?: string;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const isDesktop = useIsDesktop();
  const {
    sidebarOpen,
    sidebarCollapsed,
    toggleSidebar,
    setSidebarOpen,
    toggleSidebarCollapsed,
  } = useUIStore();

  const groups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSeeItem(item, role)),
    }))
    .filter((group) => group.items.length > 0);

  // Icon-rail only on desktop; mobile drawer always shows full labels
  const collapsed = isDesktop && sidebarCollapsed;

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed left-2.5 top-2.5 z-50 h-10 w-10 rounded-xl border-border/80 bg-card shadow-sm lg:hidden"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? "Close menu" : "Open menu"}
      >
        {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "app-sidebar fixed inset-y-0 left-0 z-40 flex w-[min(19rem,88vw)] flex-col text-slate-200 transition-[width,transform] duration-300 ease-out lg:static lg:translate-x-0",
          collapsed ? "lg:w-[4.5rem]" : "lg:w-64",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div
          className={cn(
            "flex h-[4.25rem] shrink-0 items-center border-b border-white/[0.08]",
            collapsed ? "justify-center px-2" : "gap-3 px-4"
          )}
        >
          <Link
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "group flex min-w-0 items-center gap-3",
              collapsed && "justify-center"
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-700 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(13,148,136,0.85)] ring-1 ring-white/20">
              W
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold tracking-tight text-white">
                  {APP_NAME}
                </span>
                <span className="block truncate text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  {COMPANY_NAME}
                </span>
              </span>
            )}
          </Link>
        </div>

        <nav className="app-sidebar-scroll flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed ? (
                <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {group.label}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                  const showBadge =
                    item.href === "/notifications" && unreadCount > 0;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[13px] font-medium transition-all",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-teal-500/15 text-white shadow-[inset_0_0_0_1px_rgba(45,212,191,0.2)]"
                            : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-teal-400" />
                        )}
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                            active
                              ? "bg-teal-600/90 text-white"
                              : "bg-white/[0.04] text-slate-400 group-hover:text-slate-200"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {showBadge ? (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
                                {unreadCount > 99 ? "99+" : unreadCount}
                              </span>
                            ) : active ? (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                            ) : null}
                          </>
                        )}
                        {collapsed && showBadge && (
                          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#121a26]" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/[0.08] p-2.5">
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className={cn(
              "mb-2 hidden w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[12px] font-medium text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200 lg:flex",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>

          {(fullName || role) && (
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-2.5 py-2.5 ring-1 ring-white/[0.06]",
                collapsed && "justify-center px-2"
              )}
              title={fullName}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-[11px] font-semibold uppercase text-white">
                {(fullName || role).slice(0, 1)}
              </span>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-slate-100">
                    {fullName || "User"}
                  </p>
                  <p className="truncate text-[10px] capitalize tracking-wide text-slate-500">
                    {roleLabel(role)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
